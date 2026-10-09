import { response } from '@/lib/server';
import { serviceStatus } from '@/lib/config';
export const dynamic = 'force-dynamic';
export async function GET() {
  return response(serviceStatus());
}
