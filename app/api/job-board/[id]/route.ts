import { admin, response, route, ApiError } from '@/lib/server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, context?: Ctx) => {
  const id = (await context!.params).id;
  const db = admin();
  const { data: job, error } = await db.from('employer_jobs').select('*').eq('id', id).eq('status', 'published').maybeSingle();
  if (error) throw error;
  if (!job) throw new ApiError(404, 'This job is no longer available.');
  const { data: company, error: companyError } = await db.from('employer_companies').select('id,name,website_url,description,verification_status').eq('id', job.company_id).eq('verification_status', 'verified').maybeSingle();
  if (companyError) throw companyError;
  if (!company) throw new ApiError(404, 'This job is no longer available.');
  return response({ job: { ...job, company: { id: company.id, name: company.name, website_url: company.website_url, description: company.description, verified: true } } });
});
