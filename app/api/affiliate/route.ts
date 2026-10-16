import { identity, response, route } from '@/lib/server';
import { affiliateDashboard } from '@/lib/affiliate';

export const GET = route(async () => {
  const { user } = await identity();
  return response(await affiliateDashboard(user.id));
});
