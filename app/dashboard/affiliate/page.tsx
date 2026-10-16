import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { appOrigin, identity } from '@/lib/server';
import { affiliateDashboard } from '@/lib/affiliate';
import AffiliateCopyButton from '@/components/affiliate-copy-button';

export const metadata: Metadata = { title: 'Your referral link', robots: { index: false, follow: false } };

export default async function DashboardAffiliatePage() {
  const { user } = await identity();
  const data = await affiliateDashboard(user.id);
   const link = `${appOrigin()}/r/${data.code}`;
  return <main id="main" className="affiliate-dashboard"><div className="affiliate-dashboard-inner"><Link className="back-link" href="/dashboard"><ArrowLeft size={16}/> Back to workspace</Link><span className="eyebrow">YOUR REFERRAL LINK</span><h1>Share ReachFlow<br/><em>when it feels right.</em></h1><p className="muted">Your link tracks visits and signups only. It does not represent a commission or payout promise.</p><section className="affiliate-link-card"><label htmlFor="affiliate-link">Your personal link</label><div><input id="affiliate-link" readOnly value={link}/><AffiliateCopyButton value={link}/></div><Link className="text-button" href={link} target="_blank">Open link <ExternalLink size={14}/></Link></section><div className="affiliate-stats"><div><strong>{data.clicks}</strong><span>Tracked visits</span></div><div><strong>{data.signups}</strong><span>Attributed signups</span></div></div><section className="affiliate-note"><h2>What is tracked?</h2><p>We record a referral code, a click, and at most one signup attribution per account. Raw IP addresses are not stored. Self-referrals are excluded.</p></section></div></main>;
}
