import { CONNECTORS } from '@/lib/connectors';
import { response } from '@/lib/server';

export const dynamic = 'force-static';
export function GET() { return response({ connectors: CONNECTORS, policy: 'ReachFlow searches public indexed sources. Authorized/private platform sessions are not connected to the SaaS web server.' }); }
