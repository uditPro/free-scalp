import type { CandidateProfile } from './candidate-workflow';
export function aiStatus(env: NodeJS.ProcessEnv = process.env) { return { enabled: !!(env.AI_MANAGED_BASE_URL && env.AI_MANAGED_MODEL && env.AI_MANAGED_API_KEY), mode: env.AI_MANAGED_BASE_URL && env.AI_MANAGED_MODEL && env.AI_MANAGED_API_KEY ? 'managed' : 'deterministic' as const }; }
export function deterministicDrafts(profile: CandidateProfile, job: { title: string; company?: string | null; description: string }) {
  const name = profile.fullName || 'the candidate'; const skills = (profile.skills ?? []).slice(0, 8).join(', ') || 'relevant experience';
  return { coverLetter: `Dear Hiring Team,\n\nI am excited to apply for the ${job.title}${job.company ? ` role at ${job.company}` : ''}. My background in ${skills} and my experience described in my profile align with the needs of this position. I would welcome the opportunity to discuss how I can contribute.\n\nThank you,\n${name}`, resume: `${name}\n${profile.headline ?? ''}\n\nSkills: ${skills}\n\nExperience\n${profile.experience ?? ''}\n\nEducation\n${profile.education ?? ''}`.trim(), interviewQuestions: [`What would success look like in the first 90 days of the ${job.title} role?`, `Which skills from the posting are most important to the team?`, 'How does the team collaborate and give feedback?'] };
}
export async function generateDrafts(profile: CandidateProfile, job: { title: string; company?: string | null; description: string }) {
  const status = aiStatus(); if (status.mode === 'deterministic') return { ...deterministicDrafts(profile, job), mode: status.mode };
  try {
    const res = await fetch(process.env.AI_MANAGED_BASE_URL!, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_MANAGED_API_KEY}` }, body: JSON.stringify({ model: process.env.AI_MANAGED_MODEL, temperature: 0.2, messages: [{ role: 'system', content: 'Create application drafts using only the supplied candidate and job data. Return JSON with coverLetter, resume, interviewQuestions.' }, { role: 'user', content: JSON.stringify({ profile, job }) }] }), signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('AI unavailable'); const data = await res.json() as { choices?: [{ message?: { content?: string } }] }; const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    if (typeof parsed.coverLetter !== 'string' || typeof parsed.resume !== 'string' || !Array.isArray(parsed.interviewQuestions)) throw new Error('Invalid AI response'); return { ...parsed, mode: 'managed' as const };
  } catch { return { ...deterministicDrafts(profile, job), mode: 'deterministic' as const }; }
}
