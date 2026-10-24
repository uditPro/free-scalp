import { employerCompanySchema } from '@/lib/validation';
import { admin, checkOrigin, identity, json, response, route } from '@/lib/server';
import { verifyCompanyEmail } from '@/lib/employer-workflow';

export const GET = route(async () => {
  const { user } = await identity();
  const { data, error } = await admin().from('employer_companies').select('*').eq('owner_user_id', user.id).maybeSingle();
  if (error) throw error;
  return response({ company: data, accountEmail: user.email ?? '' });
});

export const PUT = route(async request => {
  checkOrigin(request);
  const input = await json(request, employerCompanySchema);
  const { user } = await identity();
  const db = admin();
  const verification = verifyCompanyEmail(user.email, input.websiteUrl);
  const existing = await db.from('employer_companies').select('id').eq('owner_user_id', user.id).maybeSingle();
  if (existing.error) throw existing.error;

  const values = {
    owner_user_id: user.id,
    name: input.name,
    website_url: input.websiteUrl,
    website_domain: verification.websiteDomain,
    email_domain: verification.emailDomain,
    description: input.description,
    verification_status: verification.status,
    verification_method: verification.method ?? null,
    verification_reason: verification.reason,
    verified_at: verification.verifiedAt ?? null,
    updated_at: new Date().toISOString(),
  };
  const result = existing.data
    ? await db.from('employer_companies').update(values).eq('id', existing.data.id).eq('owner_user_id', user.id).select('*').single()
    : await db.from('employer_companies').insert({ ...values, created_at: new Date().toISOString() }).select('*').single();
  if (result.error) throw result.error;

  // A company that is no longer domain-verified must not leave old roles public.
  if (verification.status !== 'verified') {
    const unpublished = await db.from('employer_jobs').update({ status: 'draft', published_at: null, updated_at: new Date().toISOString() }).eq('company_id', result.data.id).eq('status', 'published');
    if (unpublished.error) throw unpublished.error;
  }
  return response({ company: result.data, accountEmail: user.email ?? '' });
});
