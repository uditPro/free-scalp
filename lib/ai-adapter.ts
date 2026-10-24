import type { CandidateProfile } from './candidate-workflow';

type Job = { title: string; company?: string | null; description: string };
type Draft = { coverLetter: string; resume: string; interviewQuestions: string[]; mode: 'byok' | 'managed' | 'deterministic' };
export function aiStatus(env: NodeJS.ProcessEnv = process.env) { const managed = !!(env.AI_MANAGED_BASE_URL && env.AI_MANAGED_MODEL && env.AI_MANAGED_API_KEY); return { enabled: managed, mode: managed ? 'managed' as const : 'deterministic' as const }; }
export function deterministicDrafts(profile: CandidateProfile, job: Job) {
  const name = profile.fullName || 'the candidate'; const skills = (profile.skills ?? []).slice(0, 8).join(', ') || 'relevant experience';
  const summary = profile.summary ? `\n\n${profile.summary}` : '';
  return { coverLetter: `Dear Hiring Team,\n\nI am excited to apply for the ${job.title}${job.company ? ` role at ${job.company}` : ''}. My background in ${skills} and my experience described in my profile align with the needs of this position.${summary}\n\nThank you,\n${name}`, resume: `${name}\n${profile.headline ?? ''}${summary}\n\nSkills: ${skills}\n\nExperience\n${profile.experience ?? ''}\n\nEducation\n${profile.education ?? ''}`.trim(), interviewQuestions: [`What would success look like in the first 90 days of the ${job.title} role?`, `Which skills from the posting are most important to the team?`, 'How does the team collaborate and give feedback?'] };
}
function parseDraft(content: string): Omit<Draft, 'mode'> { const parsed = JSON.parse(content) as Partial<Draft>; if (typeof parsed.coverLetter !== 'string' || typeof parsed.resume !== 'string' || !Array.isArray(parsed.interviewQuestions) || parsed.interviewQuestions.some(q => typeof q !== 'string')) throw new Error('Invalid AI response'); return { coverLetter: parsed.coverLetter.slice(0, 12000), resume: parsed.resume.slice(0, 30000), interviewQuestions: parsed.interviewQuestions.slice(0, 10) }; }
async function call(baseUrl: string, model: string, key: string, profile: CandidateProfile, job: Job) {
  const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
  const input = JSON.stringify({ profile, job }).slice(0, 45000);
  const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, temperature: 0.2, max_tokens: 3500, messages: [{ role: 'system', content: 'Create application drafts using only supplied data. Return JSON with coverLetter, resume, interviewQuestions.' }, { role: 'user', content: input }] }), signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('AI unavailable');
  const responseText = await res.text();
  if (responseText.length > 250000) throw new Error('AI response too large');
  const data = JSON.parse(responseText) as { choices?: [{ message?: { content?: string } }] };
  return parseDraft(data.choices?.[0]?.message?.content ?? '{}');
}
export async function generateDrafts(profile: CandidateProfile, job: Job, userId?: string): Promise<Draft> {
  const fallback = deterministicDrafts(profile, job);
  try { const byok = userId ? await import('./byok').then(module => module.getByok(userId)) : null; if (byok) return { ...await call(byok.baseUrl, byok.model, byok.apiKey, profile, job), mode: 'byok' }; } catch { /* fallback below */ }
  const managed = aiStatus();
  if (managed.mode === 'managed') try { return { ...await call(process.env.AI_MANAGED_BASE_URL!, process.env.AI_MANAGED_MODEL!, process.env.AI_MANAGED_API_KEY!, profile, job), mode: 'managed' }; } catch { /* deterministic fallback */ }
  return { ...fallback, mode: 'deterministic' };
}
