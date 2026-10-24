import { admin, identity, response, route } from '@/lib/server';

export const GET = route(async () => {
  const { user } = await identity();
  const db = admin();
  const { data: applications, error } = await db.from('employer_applications').select('*').eq('candidate_user_id', user.id).order('created_at', { ascending: false });
  if (error) throw error;
  const jobIds = [...new Set((applications ?? []).map(application => application.job_id))];
  const { data: jobs, error: jobsError } = jobIds.length ? await db.from('employer_jobs').select('id,title,company_id,location,workplace_type,employment_type').in('id', jobIds) : { data: [], error: null };
  if (jobsError) throw jobsError;
  const companyIds = [...new Set((jobs ?? []).map(job => job.company_id))];
  const { data: companies, error: companiesError } = companyIds.length ? await db.from('employer_companies').select('id,name').in('id', companyIds) : { data: [], error: null };
  if (companiesError) throw companiesError;
  const jobMap = new Map((jobs ?? []).map(job => [job.id, job]));
  const companyMap = new Map((companies ?? []).map(company => [company.id, company]));
  return response({ applications: (applications ?? []).map(application => ({ id: application.id, status: application.status, cover_note: application.cover_note, employer_note: application.employer_note, created_at: application.created_at, updated_at: application.updated_at, job: jobMap.has(application.job_id) ? { ...jobMap.get(application.job_id), company: companyMap.get(jobMap.get(application.job_id)!.company_id) ?? null } : null })) });
});
