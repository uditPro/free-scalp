import type { SupabaseClient } from '@supabase/supabase-js';
class WorkflowError extends Error { constructor(public status: number, message: string) { super(message); } }

export type CandidateProfile = { fullName?: string; headline?: string; summary?: string; targets?: string; location?: string; workAuthorization?: string; skills?: string[]; experience?: string; education?: string; preferences?: { titles?: string[]; locations?: string[]; remote?: boolean; employmentTypes?: string[] }; resume?: { text: string; fileName?: string } };
export type JobFitAnalysis = {
  score: number;
  verdict: 'strong-match' | 'possible-match' | 'weak-match' | 'blocked';
  explanation: {
    matchedSkills: string[];
    missingSkills: string[];
    components: { skills: number; title: number; location: number };
    hardGates: { location: 'pass' | 'review' | 'fail'; workAuthorization: 'pass' | 'review' | 'fail'; employmentType: 'pass' | 'review' | 'fail' };
    evidence: string[];
    blockers: string[];
  };
};
const words = (value: string) => new Set((value.toLowerCase().match(/[a-z0-9+#.-]+/g) ?? []).filter(w => w.length > 2));
export function profileCompletion(profile: CandidateProfile | null | undefined) {
  if (!profile) return { score: 0, missing: ['fullName','headline','skills','experience','resume'] };
  const checks: [string, boolean][] = [['fullName', !!profile.fullName], ['headline', !!profile.headline], ['skills', !!profile.skills?.length], ['experience', !!profile.experience], ['resume', !!profile.resume?.text], ['preferences', !!profile.preferences]];
  return { score: Math.round(checks.filter(([, ok]) => ok).length / checks.length * 100), missing: checks.filter(([, ok]) => !ok).map(([name]) => name) };
}
const knownSkills = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'react', 'next.js', 'node.js', 'sql', 'postgresql', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'graphql', 'figma', 'design', 'sales', 'writing', 'marketing', 'analytics', 'management'];
const normalize = (value: string | null | undefined) => (value ?? '').toLowerCase().replace(/[–—]/g, '-');
const hasAny = (value: string, patterns: string[]) => patterns.some(pattern => value.includes(pattern));

export function analyzeJobFit(profile: CandidateProfile, job: { title: string; description: string; location?: string | null; employment_type?: string | null; requirements?: string | null }): JobFitAnalysis {
  const jobText = normalize(`${job.title} ${job.description} ${job.requirements ?? ''}`);
  const profileSkills = new Set((profile.skills ?? []).flatMap(skill => [...words(skill)]));
  const required = knownSkills.filter(skill => jobText.includes(skill));
  const matched = required.filter(skill => profileSkills.has(skill) || [...profileSkills].some(candidate => candidate.includes(skill) || skill.includes(candidate))).sort();
  const missing = required.filter(skill => !matched.includes(skill)).slice(0, 12);
  const skillScore = required.length ? Math.round(matched.length / required.length * 100) : profileSkills.size ? 60 : 0;
  const titleScore = profile.preferences?.titles?.length
    ? profile.preferences.titles.some(title => normalize(job.title).includes(normalize(title)) || normalize(title).includes(normalize(job.title))) ? 100 : 35
    : 50;
  const locationText = normalize(job.location);
  const wantedLocations = (profile.preferences?.locations ?? []).map(normalize).filter(Boolean);
  const remoteJob = hasAny(`${locationText} ${jobText}`, ['remote', 'work from home', 'distributed']);
  const locationPass = !wantedLocations.length || wantedLocations.some(location => locationText.includes(location) || location.includes(locationText)) || (remoteJob && profile.preferences?.remote === true);
  const locationScore = locationPass ? 100 : 25;

  const blockers: string[] = [];
  const authorizationRequired = hasAny(jobText, ['must be authorized', 'work authorization required', 'authorized to work', 'without sponsorship', 'no sponsorship', 'right to work']);
  const hasAuthorizationEvidence = Boolean(profile.workAuthorization?.trim());
  const workAuthorization: 'pass' | 'review' | 'fail' = authorizationRequired && !hasAuthorizationEvidence ? 'review' : 'pass';
  if (authorizationRequired && !hasAuthorizationEvidence) blockers.push('Work authorization is required by the posting but is not stated in your profile.');

  const employmentType = normalize(job.employment_type);
  const preferredTypes = (profile.preferences?.employmentTypes ?? []).map(normalize);
  const typePass = !preferredTypes.length || !employmentType || preferredTypes.some(type => employmentType.includes(type));
  const employmentGate: 'pass' | 'review' | 'fail' = typePass ? 'pass' : 'fail';
  if (!typePass) blockers.push(`The role is ${job.employment_type}, outside your selected employment types.`);

  const locationGate: 'pass' | 'review' | 'fail' = locationPass ? 'pass' : 'review';
  if (!locationPass) blockers.push('The posting location does not match your selected locations; verify relocation or eligibility before applying.');
  const hardFail = employmentGate === 'fail';
  const score = hardFail ? Math.min(39, Math.round(skillScore * .6 + titleScore * .25 + locationScore * .15)) : Math.round(skillScore * .6 + titleScore * .25 + locationScore * .15);
  const verdict = hardFail ? 'blocked' : score >= 75 ? 'strong-match' : score >= 45 ? 'possible-match' : 'weak-match';
  const evidence = [
    matched.length ? `Matched skills found in your profile: ${matched.join(', ')}.` : 'No direct skill matches were found from the supplied profile.',
    missing.length ? `Skills mentioned in the posting but not found in your profile: ${missing.join(', ')}.` : 'No tracked skill gaps were detected from the posting text.',
    locationPass ? 'Location preference is compatible or the posting is remote.' : 'Location needs human verification before applying.',
  ];
  return { score, verdict, explanation: { matchedSkills: matched, missingSkills: missing, components: { skills: skillScore, title: titleScore, location: locationScore }, hardGates: { location: locationGate, workAuthorization, employmentType: employmentGate }, evidence, blockers } };
}
export function assertOwned<T extends { user_id?: string | null }>(row: T | null | undefined, userId: string): T {
  if (!row || row.user_id !== userId) throw new WorkflowError(404, 'Resource not found.'); return row;
}
export async function ownedRow(db: SupabaseClient, table: string, id: string, userId: string) {
  const { data, error } = await db.from(table).select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new WorkflowError(503, 'The workspace database is not ready.'); return assertOwned(data, userId);
}
