import type { SupabaseClient } from '@supabase/supabase-js';
class WorkflowError extends Error { constructor(public status: number, message: string) { super(message); } }

export type CandidateProfile = { fullName?: string; headline?: string; summary?: string; targets?: string; location?: string; workAuthorization?: string; skills?: string[]; experience?: string; education?: string; preferences?: { titles?: string[]; locations?: string[]; remote?: boolean; employmentTypes?: string[] }; resume?: { text: string; fileName?: string } };
const words = (value: string) => new Set((value.toLowerCase().match(/[a-z0-9+#.-]+/g) ?? []).filter(w => w.length > 2));
export function profileCompletion(profile: CandidateProfile | null | undefined) {
  if (!profile) return { score: 0, missing: ['fullName','headline','skills','experience','resume'] };
  const checks: [string, boolean][] = [['fullName', !!profile.fullName], ['headline', !!profile.headline], ['skills', !!profile.skills?.length], ['experience', !!profile.experience], ['resume', !!profile.resume?.text], ['preferences', !!profile.preferences]];
  return { score: Math.round(checks.filter(([, ok]) => ok).length / checks.length * 100), missing: checks.filter(([, ok]) => !ok).map(([name]) => name) };
}
export function analyzeJobFit(profile: CandidateProfile, job: { title: string; description: string; location?: string | null }) {
  const jobWords = words(`${job.title} ${job.description}`); const skills = new Set((profile.skills ?? []).flatMap(skill => [...words(skill)]));
  const matched = [...skills].filter(skill => jobWords.has(skill)).sort(); const missing = [...jobWords].filter(word => !skills.has(word) && ['typescript','javascript','python','react','sql','aws','docker','management','design','sales','writing'].includes(word)).slice(0, 12);
  const skillScore = skills.size ? Math.min(100, Math.round(matched.length / Math.max(1, Math.min(skills.size, 12)) * 100)) : 0;
  const titleScore = profile.preferences?.titles?.some(t => job.title.toLowerCase().includes(t.toLowerCase())) ? 100 : 50;
  const locationScore = !profile.preferences?.locations?.length || !!job.location && profile.preferences.locations.some(l => job.location!.toLowerCase().includes(l.toLowerCase())) ? 100 : 25;
  const score = Math.round(skillScore * .6 + titleScore * .25 + locationScore * .15);
  return { score, explanation: { matchedSkills: matched, missingSkills: missing, components: { skills: skillScore, title: titleScore, location: locationScore } } };
}
export function assertOwned<T extends { user_id?: string | null }>(row: T | null | undefined, userId: string): T {
  if (!row || row.user_id !== userId) throw new WorkflowError(404, 'Resource not found.'); return row;
}
export async function ownedRow(db: SupabaseClient, table: string, id: string, userId: string) {
  const { data, error } = await db.from(table).select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new WorkflowError(503, 'The workspace database is not ready.'); return assertOwned(data, userId);
}
