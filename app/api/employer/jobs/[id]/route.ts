import { employerJobPatchSchema, employerJobSchema } from '@/lib/validation';
import { admin, checkOrigin, identity, json, response, route, ApiError } from '@/lib/server';
import { jobPublishReadiness } from '@/lib/employer-workflow';

type Ctx = { params: Promise<{ id: string }> };

async function ownedJob(userId: string, id: string) {
  const db = admin();
  const { data: company, error: companyError } = await db.from('employer_companies').select('*').eq('owner_user_id', userId).maybeSingle();
  if (companyError) throw companyError;
  if (!company) throw new ApiError(404, 'Resource not found.');
  const { data: job, error } = await db.from('employer_jobs').select('*').eq('id', id).eq('company_id', company.id).maybeSingle();
  if (error) throw error;
  if (!job) throw new ApiError(404, 'Resource not found.');
  return { db, company, job };
}

export const GET = route(async (_request: Request, context?: Ctx) => {
  const { user } = await identity();
  const { job } = await ownedJob(user.id, (await context!.params).id);
  return response({ job });
});

export const PATCH = route(async (request: Request, context?: Ctx) => {
  checkOrigin(request);
  const input = await json(request, employerJobPatchSchema);
  const { user } = await identity();
  const { db, company, job } = await ownedJob(user.id, (await context!.params).id);
  const { action, ...fields } = input;
  const merged = { ...job, ...fields };

  if (action === 'publish' || action === 'reopen') {
    if (company.verification_status !== 'verified') throw new ApiError(403, 'Verify your company before publishing a job.');
    const readiness = jobPublishReadiness(merged);
    if (!readiness.ready) throw new ApiError(400, `Complete ${readiness.missing.join(', ')} before publishing this job.`);
    const checked = employerJobSchema.safeParse({
      title: merged.title,
      location: merged.location,
      workplace_type: merged.workplace_type,
      employment_type: merged.employment_type,
      experience_level: merged.experience_level,
      salary_min: merged.salary_min,
      salary_max: merged.salary_max,
      currency: merged.currency,
      description: merged.description,
      requirements: merged.requirements,
    });
    if (!checked.success) throw new ApiError(400, 'Complete every required job field before publishing.');
    const { data, error } = await db.from('employer_jobs').update({ ...checked.data, status: 'published', published_at: job.published_at ?? new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', job.id).eq('company_id', company.id).select('*').single();
    if (error) throw error;
    return response({ job: data });
  }

  const update: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  if (action === 'close') { update.status = 'closed'; update.published_at = null; }
  const { data, error } = await db.from('employer_jobs').update(update).eq('id', job.id).eq('company_id', company.id).select('*').single();
  if (error || !data) throw new ApiError(404, 'Resource not found.');
  return response({ job: data });
});
