type Environment = Record<string, string | undefined>;

// Auth is server-side: neither the secret key nor the publishable key needs
// a NEXT_PUBLIC_ variable. Keep legacy names for existing deployments.
export function supabaseConfig(env: Environment = process.env) {
  const first = (...names: string[]) => names.map(name => env[name]?.trim()).find(Boolean) ?? '';
  return {
    url: first('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
    publishableKey: first('SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    secretKey: first('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'),
  };
}

export function applicationOrigin(value: string | undefined): string {
  try {
    const url = new URL(value?.trim() ?? '');
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error();
    return url.origin;
  } catch { throw new Error('APP_URL must be your exact application origin, using HTTPS except on localhost.'); }
}

export function serviceStatus(env: Environment = process.env) {
  const config = supabaseConfig(env);
  let validOrigin = false;
  let validSupabaseUrl = false;
  try { applicationOrigin(env.APP_URL); validOrigin = true; } catch { /* Missing setup. */ }
  try { const url = new URL(config.url); validSupabaseUrl = ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { /* Missing setup. */ }
  const auth = validOrigin && validSupabaseUrl && !!config.publishableKey && !config.publishableKey.startsWith('sb_secret_');
  const has = (...names: string[]) => names.every(name => !!env[name]?.trim());
  const provider = env.SEARCH_PROVIDER?.trim() || 'auto';
  const providerConfigured = ['auto', 'exa-mcp'].includes(provider) || (provider === 'exa-api' && has('EXA_API_KEY'));
  const search = auth && !!config.secretKey && providerConfigured;
  const billing = auth && !!config.secretKey && has('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_STARTER_PRICE_ID', 'STRIPE_PRO_PRICE_ID');
  return { configured: auth && search, auth, search, billing };
}
