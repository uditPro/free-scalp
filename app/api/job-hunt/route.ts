import { jobHuntPlanSchema } from '@/lib/validation';
import { admin, checkOrigin, identity, json, response, route } from '@/lib/server';

function defaultPlan() {
  return {
    targetRole: 'Software Engineer',
    experienceLevel: 'mid' as const,
    locations: 'Remote / United States',
    remote: true,
    startDate: new Date().toISOString().slice(0, 10),
    targetApplications: 8,
    targetOutreach: 3,
    completedDays: [],
  };
}

function profileObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export const GET = route(async () => {
  const { user } = await identity();
  const { data, error } = await admin().from('profiles').select('candidate_profile').eq('id', user.id).single();
  if (error) throw error;
  const stored = profileObject(data?.candidate_profile).jobHunt;
  const parsed = jobHuntPlanSchema.safeParse(stored);
  return response({ plan: parsed.success ? parsed.data : defaultPlan() });
});

export const PUT = route(async request => {
  checkOrigin(request);
  const input = await json(request, jobHuntPlanSchema);
  const { user } = await identity();
  const db = admin();
  const { data: current, error: readError } = await db.from('profiles').select('candidate_profile').eq('id', user.id).single();
  if (readError) throw readError;
  const next = { ...profileObject(current?.candidate_profile), jobHunt: input };
  const { error } = await db.from('profiles').update({ candidate_profile: next }).eq('id', user.id);
  if (error) throw error;
  return response({ plan: input });
});
