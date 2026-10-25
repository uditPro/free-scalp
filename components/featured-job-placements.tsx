"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, LoaderCircle, Megaphone, MapPin, ShieldCheck } from "lucide-react";
import { api } from "@/components/api-client";

type FeaturedJob = { id: string; title: string; location: string; is_sponsored?: boolean; sponsored_rank?: number | null; promotion_label?: string | null; company: { name: string; verified: boolean } };

export default function FeaturedJobPlacements() {
  const [jobs, setJobs] = useState<FeaturedJob[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api<{ jobs: FeaturedJob[] }>("/api/job-board?limit=6").then(result => setJobs((result.jobs ?? []).filter(job => job.is_sponsored).slice(0, 3))).catch(() => setJobs([])).finally(() => setLoading(false)); }, []);
  return <section className="featured-placements container" aria-labelledby="featured-placements-title"><div className="featured-placements-heading"><div><span className="eyebrow">SPONSORED OPPORTUNITIES</span><h2 id="featured-placements-title">Companies can compete for <em>attention.</em></h2><p>Verified employers may bid for featured job placement. Candidates always see the sponsored label, and payment never changes company verification or role-fit signals.</p></div><Link className="button button-outline button-small" href="/employer#promote">Promote a job <ArrowRight size={14}/></Link></div>{loading ? <div className="featured-placements-loading" role="status"><LoaderCircle className="spin" size={18}/>Loading featured opportunities…</div> : jobs.length ? <div className="featured-placement-grid">{jobs.map((job, index) => <Link className="featured-placement-card" href={`/jobs/${job.id}`} key={job.id}><div className="featured-placement-rank"><span>#{job.sponsored_rank ?? index + 1}</span><span><Megaphone size={12}/> Sponsored</span></div><div className="featured-placement-company"><span className="company-avatar"><BriefcaseBusiness size={16}/></span><strong>{job.company.name}</strong>{job.company.verified && <BadgeCheck size={14}/>}</div><h3>{job.title}</h3><span className="featured-placement-location"><MapPin size={13}/>{job.location}</span></Link>)}</div> : <div className="featured-placements-empty"><ShieldCheck size={22}/><div><strong>The sponsored board is open.</strong><p>Verified companies can publish a role, set a target bid, and compete transparently for featured placement.</p></div><Link className="text-button" href="/employer#promote">Become a featured employer <ArrowRight size={14}/></Link></div>}</section>;
}
