import { admin, identity, response, route } from '@/lib/server';

export const GET = route(async () => {
  const { user } = await identity();
  const db = admin();
  const { data: company, error: companyError } = await db.from('employer_companies').select('id').eq('owner_user_id', user.id).maybeSingle();
  if (companyError) throw companyError;
  if (!company) return response({ applications: [] });
  const { data: jobs, error: jobsError } = await db.from('employer_jobs').select('id,title').eq('company_id', company.id);
  if (jobsError) throw jobsError;
  const jobMap = new Map((jobs ?? []).map(job => [job.id, job]));
  const ids = [...jobMap.keys()];
  if (!ids.length) return response({ applications: [] });
  const { data, error } = await db.from('employer_applications').select('*').in('job_id', ids).order('created_at', { ascending: false });
  if (error) throw error;
  return response({ applications: (data ?? []).map(application => ({ ...application, job: jobMap.get(application.job_id) ?? null })) });
});
