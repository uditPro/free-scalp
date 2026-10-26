import { z } from 'zod';

export const gtmSettingsSchema = z.object({ companyName: z.string().trim().max(160), companyWebsite: z.string().trim().max(2048), companyDescription: z.string().trim().max(4000), targetAudience: z.string().trim().max(2000), systemEnabled: z.boolean(), autopilotEnabled: z.boolean(), minFitScore: z.number().int().min(0).max(100), dailyLimit: z.number().int().min(0).max(100), fromEmail: z.string().trim().max(254), replyTo: z.string().trim().max(254) }).strict();
export const gtmBriefSchema = z.object({ name: z.string().trim().min(2).max(160), audience: z.string().trim().min(3).max(500), problem: z.string().trim().max(500), location: z.string().trim().max(160), runMode: z.enum(['queue', 'run_now']) }).strict();
export const gtmCampaignSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(160), status: z.enum(['draft', 'ready', 'active', 'paused']).default('draft'), subjectTemplate: z.string().trim().min(2).max(180), bodyTemplate: z.string().trim().min(20).max(8000), followupSubject: z.string().trim().max(180).default(''), followupBody: z.string().trim().max(8000).default(''), followupDelayDays: z.number().int().min(1).max(30).default(3), dailyLimit: z.number().int().min(0).max(100).default(10) }).strict();
export const gtmActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('settings'), ...gtmSettingsSchema.shape }).strict(),
  z.object({ action: z.literal('brief'), ...gtmBriefSchema.shape }).strict(),
  z.object({ action: z.literal('campaign'), ...gtmCampaignSchema.shape }).strict(),
  z.object({ action: z.literal('run'), briefId: z.string().uuid().optional() }).strict(),
  z.object({ action: z.literal('drafts'), campaignId: z.string().uuid(), limit: z.number().int().min(1).max(100).default(20) }).strict(),
  z.object({ action: z.literal('approve'), messageId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('send'), messageId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('pause'), mode: z.enum(['system', 'autopilot']), value: z.boolean() }).strict(),
]);
