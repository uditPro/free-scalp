import { saveJobSchema } from '@/lib/validation'; import { admin, checkOrigin, identity, json, response, route } from '@/lib/server'; import { inspectJobPosting, sourceType } from '@/lib/job-posting-guard'; import { analyzeJobFit } from '@/lib/candidate-workflow';

export const POST = route(async request => {
  checkOrigin(request);
  const { action, result } = await json(request, saveJobSchema);
  const { user } = await identity();
  const db = admin();
  const integrity = inspectJobPosting(result.title, result.description, result.requirements ?? '');
  const now = new Date().toISOString();
  const payload = {
    user_id: user.id,
    title: result.title,
    company: result.company ?? null,
    location: result.location ?? null,
    employment_type: result.employmentType ?? null,
    requirements: result.requirements ?? null,
    description: integrity.cleanedText,
    url: result.url ?? null,
    source: result.source ?? null,
    source_type: sourceType(result.source, result.url),
    fetched_at: now,
    posted_at: result.publishedAt ?? null,
    provenance: { source: result.source ?? null, provider: result.provider ?? null, author: result.author ?? null, originalUrl: result.url ?? null },
    integrity_status: integrity.status,
    integrity_flags: integrity.flags,
  };
  let job: Record<string, unknown> | null = null;

  if (result.url) {
    const existing = await db.from('saved_jobs').select('*').eq('user_id', user.id).eq('url', result.url).maybeSingle();
    if (existing.error) throw existing.error;
    job = existing.data as Record<string, unknown> | null;
  }
  if (!job) {
    const inserted = await db.from('saved_jobs').insert(payload).select('*').single();
    if (inserted.error) throw inserted.error;
    job = inserted.data as Record<string, unknown>;
  } else {
    const { user_id: _userId, ...refreshPayload } = payload;
    const refreshed = await db.from('saved_jobs').update({ ...refreshPayload, updated_at: now }).eq('id', job.id as string).eq('user_id', user.id).select('*').single();
    if (refreshed.error) throw refreshed.error;
    job = refreshed.data as Record<string, unknown>;
  }

  const { data: profileRow } = await db.from('profiles').select('candidate_profile').eq('id', user.id).maybeSingle();
  if (profileRow?.candidate_profile && job) {
    const fit = analyzeJobFit(profileRow.candidate_profile, { title: String(job.title ?? ''), description: String(job.description ?? ''), location: typeof job.location === 'string' ? job.location : null, employment_type: typeof job.employment_type === 'string' ? job.employment_type : null, requirements: typeof job.requirements === 'string' ? job.requirements : null });
    const fitted = await db.from('saved_jobs').update({ fit_analysis: fit, updated_at: now }).eq('id', job.id as string).eq('user_id', user.id).select('*').single();
    if (!fitted.error) job = fitted.data as Record<string, unknown>;
  }

  if (action === 'save') return response({ id: job.id, job }, 201);

  const existingApplication = await db.from('applications').select('*, saved_jobs(*)').eq('user_id', user.id).eq('job_id', job.id as string).maybeSingle();
  if (existingApplication.error) throw existingApplication.error;
  if (existingApplication.data) return response({ id: existingApplication.data.id, job, application: existingApplication.data });
  const created = await db.from('applications').insert({ user_id: user.id, job_id: job.id }).select('*, saved_jobs(*)').single();
  if (created.error) throw created.error;
  return response({ id: created.data.id, job, application: created.data }, 201);
});
