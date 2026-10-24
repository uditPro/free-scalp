import { saveJobSchema } from '@/lib/validation'; import { admin, checkOrigin, identity, json, response, route } from '@/lib/server';

export const POST = route(async request => {
  checkOrigin(request);
  const { action, result } = await json(request, saveJobSchema);
  const { user } = await identity();
  const db = admin();
  let job: Record<string, unknown> | null = null;

  if (result.url) {
    const existing = await db.from('saved_jobs').select('*').eq('user_id', user.id).eq('url', result.url).maybeSingle();
    if (existing.error) throw existing.error;
    job = existing.data as Record<string, unknown> | null;
  }
  if (!job) {
    const inserted = await db.from('saved_jobs').insert({ user_id: user.id, ...result }).select('*').single();
    if (inserted.error) throw inserted.error;
    job = inserted.data as Record<string, unknown>;
  }

  if (action === 'save') return response({ id: job.id, job }, 201);

  const existingApplication = await db.from('applications').select('*, saved_jobs(*)').eq('user_id', user.id).eq('job_id', job.id as string).maybeSingle();
  if (existingApplication.error) throw existingApplication.error;
  if (existingApplication.data) return response({ id: existingApplication.data.id, job, application: existingApplication.data });
  const created = await db.from('applications').insert({ user_id: user.id, job_id: job.id }).select('*, saved_jobs(*)').single();
  if (created.error) throw created.error;
  return response({ id: created.data.id, job, application: created.data }, 201);
});
