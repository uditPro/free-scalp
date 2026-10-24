import { employerApplicationPatchSchema } from '@/lib/validation';
import { admin, checkOrigin, identity, json, response, route, ApiError } from '@/lib/server';
import { mapEmployerStatusToCandidateStatus } from '@/lib/employer-workflow';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (request: Request, context?: Ctx) => {
  checkOrigin(request);
  const input = await json(request, employerApplicationPatchSchema);
  const { user } = await identity();
  const db = admin();
  const { data: company, error: companyError } = await db.from('employer_companies').select('id').eq('owner_user_id', user.id).maybeSingle();
  if (companyError) throw companyError;
  if (!company) throw new ApiError(404, 'Resource not found.');
  const { data: jobs, error: jobsError } = await db.from('employer_jobs').select('id').eq('company_id', company.id);
  if (jobsError) throw jobsError;
  const jobIds = (jobs ?? []).map(job => job.id);
  if (!jobIds.length) throw new ApiError(404, 'Resource not found.');
  const id = (await context!.params).id;
  const { data: application, error: applicationError } = await db.from('employer_applications').select('*').eq('id', id).in('job_id', jobIds).maybeSingle();
  if (applicationError) throw applicationError;
  if (!application) throw new ApiError(404, 'Resource not found.');
  const update = { ...(input.status ? { status: input.status } : {}), ...(input.employer_note !== undefined ? { employer_note: input.employer_note } : {}), updated_at: new Date().toISOString() };
  const { data, error } = await db.from('employer_applications').update(update).eq('id', id).select('*').single();
  if (error) throw error;
  if (input.status && application.candidate_application_id) {
    await db.from('applications').update({ status: mapEmployerStatusToCandidateStatus(input.status), updated_at: new Date().toISOString() }).eq('id', application.candidate_application_id).eq('user_id', application.candidate_user_id);
    await db.from('application_events').insert({ user_id: application.candidate_user_id, application_id: application.candidate_application_id, event_type: `employer:${input.status}`, metadata: { employer_application_id: id } });
  }
  return response({ application: data });
});
