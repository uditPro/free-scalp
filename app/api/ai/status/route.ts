import { aiStatus } from '@/lib/ai-adapter'; import { identity, response, route } from '@/lib/server';
export const GET = route(async () => { await identity(); return response(aiStatus()); });
