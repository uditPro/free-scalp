import { employerBoardQuerySchema } from '@/lib/validation';
import { admin, response, route, ApiError } from '@/lib/server';

export const dynamic = 'force-dynamic';

export const GET = route(async request => {
  const parsed = employerBoardQuerySchema.safeParse({
    query: new URL(request.url).searchParams.get('query') || undefined,
    location: new URL(request.url).searchParams.get('location') || undefined,
    limit: new URL(request.url).searchParams.get('limit') || undefined,
  });
  if (!parsed.success) throw new ApiError(400, 'Please check the job search filters.');
  const { query, location, limit } = parsed.data;
  const db = admin();
  const { data: jobs, error } = await db.from('employer_jobs').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(100);
  if (error) throw error;
  const companyIds = [...new Set((jobs ?? []).map(job => job.company_id))];
  if (!companyIds.length) return response({ jobs: [] });
  const { data: companies, error: companyError } = await db.from('employer_companies').select('id,name,website_url,description,verification_status').in('id', companyIds).eq('verification_status', 'verified');
  if (companyError) throw companyError;
  const companyMap = new Map((companies ?? []).map(company => [company.id, company]));
  const normalizedQuery = query?.toLowerCase();
  const normalizedLocation = location?.toLowerCase();
  const filtered = (jobs ?? []).filter(job => {
    const company = companyMap.get(job.company_id);
    if (!company) return false;
    const searchable = `${job.title} ${job.location} ${job.description} ${job.requirements} ${company.name}`.toLowerCase();
    return (!normalizedQuery || searchable.includes(normalizedQuery)) && (!normalizedLocation || job.location.toLowerCase().includes(normalizedLocation));
  }).slice(0, limit).map(job => {
    const company = companyMap.get(job.company_id)!;
    return { ...job, company: { id: company.id, name: company.name, website_url: company.website_url, description: company.description, verified: true } };
  });
  return response({ jobs: filtered });
});
