import { applicationPatchSchema } from '@/lib/validation'; import { admin, checkOrigin, identity, json, response, route, ApiError } from '@/lib/server'; import { ownedRow } from '@/lib/candidate-workflow';

type Ctx = { params: Promise<{ id: string }> };

function normalize(application: any, job: any) {
  const drafts = application.drafts && typeof application.drafts === 'object' ? application.drafts : {};
  return {
    id: application.id, status: application.status, notes: application.notes,
    created_at: application.created_at, updated_at: application.updated_at,
    title: job?.title, company: job?.company, url: job?.url, description: job?.description,
    job, fit: job?.fit_analysis ?? undefined, draftMode: drafts.mode, draftReview: drafts.review,
    tailored_resume: drafts.resume, cover_letter: drafts.coverLetter, interview_prep: drafts.interviewQuestions,
  };
}

export const GET = route(async (_request: Request, context?: Ctx) => {
  const { user } = await identity();
  const db = admin();
  const id = (await context!.params).id;
  const application = await ownedRow(db, 'applications', id, user.id);
  const { data: job, error } = await db.from('saved_jobs').select('*').eq('id', application.job_id).eq('user_id', user.id).single();
  if (error || !job) throw new ApiError(404, 'Resource not found.');
  return response(normalize(application, job));
});

export const PATCH = route(async (request: Request, context?: Ctx) => {
  checkOrigin(request);
  const input = await json(request, applicationPatchSchema);
  const { user } = await identity();
  const db = admin();
  const id = (await context!.params).id;
  await ownedRow(db, 'applications', id, user.id);
  const { data, error } = await db.from('applications').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id).select('*, saved_jobs(*)').single();
  if (error || !data) throw new ApiError(404, 'Resource not found.');
  await db.from('application_events').insert({ user_id: user.id, application_id: id, event_type: input.status ? `status:${input.status}` : 'updated', metadata: input });
  return response({ application: normalize(data, data.saved_jobs) });
});
