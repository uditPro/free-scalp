import { jobBoardApplySchema } from '@/lib/validation';
import { admin, appOrigin, checkOrigin, identity, json, response, route, ApiError } from '@/lib/server';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (request: Request, context?: Ctx) => {
  checkOrigin(request);
  const input = await json(request, jobBoardApplySchema);
  const { user } = await identity();
  const db = admin();
  const id = (await context!.params).id;
  const { data: job, error: jobError } = await db.from('employer_jobs').select('*').eq('id', id).eq('status', 'published').maybeSingle();
  if (jobError) throw jobError;
  if (!job) throw new ApiError(404, 'This job is no longer available.');
  const { data: company, error: companyError } = await db.from('employer_companies').select('id,name,verification_status').eq('id', job.company_id).eq('verification_status', 'verified').maybeSingle();
  if (companyError) throw companyError;
  if (!company) throw new ApiError(404, 'This job is no longer available.');
  const { data: profile, error: profileError } = await db.from('profiles').select('candidate_profile').eq('id', user.id).single();
  if (profileError) throw profileError;
  const candidate = profile?.candidate_profile && typeof profile.candidate_profile === 'object' ? profile.candidate_profile as Record<string, any> : {};
  const name = typeof candidate.fullName === 'string' ? candidate.fullName.trim() : '';
  const resume = candidate.resume && typeof candidate.resume === 'object' && typeof candidate.resume.text === 'string' ? candidate.resume.text.trim() : '';
  const candidateEmail = user.email?.trim() ?? '';
  if (!name || !resume) throw new ApiError(400, 'Complete your name and resume in your profile before applying.');
  if (!candidateEmail) throw new ApiError(400, 'Your account needs a confirmed email before applying.');

  const existing = await db.from('employer_applications').select('id').eq('job_id', id).eq('candidate_user_id', user.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) throw new ApiError(409, 'You already applied to this job.');

  const saved = await db.from('saved_jobs').select('id').eq('user_id', user.id).eq('employer_job_id', id).maybeSingle();
  if (saved.error) throw saved.error;
  let savedJobId = saved.data?.id as string | undefined;
  if (!savedJobId) {
    const createdJob = await db.from('saved_jobs').insert({ user_id: user.id, employer_job_id: id, title: job.title, company: company.name, location: job.location, description: job.description, url: `${appOrigin()}/jobs/${id}`, source: 'ReachFlow employer' }).select('id').single();
    if (createdJob.error) throw createdJob.error;
    savedJobId = createdJob.data.id;
  }

  const candidateApplication = await db.from('applications').upsert({ user_id: user.id, job_id: savedJobId, status: 'submitted', notes: input.coverNote ?? null, updated_at: new Date().toISOString() }, { onConflict: 'user_id,job_id' }).select('id').single();
  if (candidateApplication.error) throw candidateApplication.error;
  const created = await db.from('employer_applications').insert({ job_id: id, candidate_user_id: user.id, candidate_application_id: candidateApplication.data.id, candidate_name: name, candidate_email: candidateEmail, resume_text: resume, cover_note: input.coverNote ?? '' }).select('id').single();
  if (created.error) {
    if (created.error.code === '23505') throw new ApiError(409, 'You already applied to this job.');
    throw created.error;
  }
  await db.from('application_events').insert({ user_id: user.id, application_id: candidateApplication.data.id, event_type: 'employer_application_submitted', metadata: { employer_job_id: id, employer_application_id: created.data.id } });
  return response({ applicationId: created.data.id, candidateApplicationId: candidateApplication.data.id, company: company.name }, 201);
});
