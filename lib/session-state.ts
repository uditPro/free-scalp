import type { SupabaseClient } from '@supabase/supabase-js';

export async function readSession(db: SupabaseClient) {
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError && (authError.status ?? 0) >= 500) throw new Error('Authentication unavailable');
  if (!user) return { user: null, plan: 'free', profileReady: false };

  const { data, error } = await db.from('profiles').select('plan').eq('id', user.id).maybeSingle();
  if (error || !data) {
    // A real Auth session must not disappear just because application tables
    // have not been provisioned. This does not grant search or paid access.
    return {
      user: { email: user.email ?? '' }, plan: 'unavailable', profileReady: false,
      setupMessage: 'You are signed in. Your workspace database is not ready. Ask the workspace operator to apply the Supabase migrations before using search or billing.',
    };
  }
  return { user: { email: user.email ?? '' }, plan: data.plan as string, profileReady: true };
}
