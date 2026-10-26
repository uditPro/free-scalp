"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, LoaderCircle, MapPin, Megaphone, ShieldCheck, Trophy } from "lucide-react";
import { api } from "@/components/api-client";

type FeaturedJob = {
  id: string;
  title: string;
  location: string;
  is_sponsored?: boolean;
  sponsored_rank?: number | null;
  current_bid_cents?: number | null;
  minimum_next_bid_cents?: number | null;
  top_bid_cents?: number | null;
  promotion_label?: string | null;
  company: { name: string; verified: boolean };
};

function dollars(cents: number | null | undefined) {
  return `$${(Number(cents ?? 0) / 100).toFixed(2)}`;
}

export default function FeaturedJobPlacements() {
  const [jobs, setJobs] = useState<FeaturedJob[]>([]);
  const [topBidCents, setTopBidCents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ jobs: FeaturedJob[] }>("/api/job-board?limit=50")
      .then(result => {
        const sponsored = (result.jobs ?? []).filter(job => job.is_sponsored).sort((a, b) => (a.sponsored_rank ?? 999) - (b.sponsored_rank ?? 999));
        setJobs(sponsored.slice(0, 3));
        setTopBidCents(Math.max(0, ...sponsored.map(job => Number(job.current_bid_cents ?? 0))));
      })
      .catch(() => { setJobs([]); setTopBidCents(0); })
      .finally(() => setLoading(false));
  }, []);

  return <section className="featured-placements container" aria-labelledby="featured-placements-title">
    <div className="featured-placements-panel">
      <div className="featured-placements-heading">
        <div>
          <span className="eyebrow"><Megaphone size={13}/> LIVE SPONSORED AUCTION</span>
          <h2 id="featured-placements-title">Bid for <em>rank #1.</em></h2>
          <p>The first verified employer can start at <strong>$1.00</strong>. Each new employer must beat the current top bid to take the next rank. Candidates always see the sponsored label.</p>
        </div>
        <div className="featured-auction-summary" aria-label="Sponsored auction summary">
          <span>Current top bid</span>
          <strong>{topBidCents ? dollars(topBidCents) : "$1.00"}</strong>
          <small>{topBidCents ? "Beat it by $1.00 to claim #1" : "#1 opens at $1.00"}</small>
        </div>
      </div>
      {loading ? <div className="featured-placements-loading" role="status"><LoaderCircle className="spin" size={18}/>Loading the live sponsored auction…</div> : jobs.length ? <div className="featured-placement-grid">{jobs.map((job, index) => <Link className="featured-placement-card" href={`/jobs/${job.id}`} key={job.id}><div className="featured-placement-rank"><span><Trophy size={14}/> #{job.sponsored_rank ?? index + 1}</span><span><Megaphone size={12}/> Sponsored</span></div><div className="featured-placement-company"><span className="company-avatar"><BriefcaseBusiness size={16}/></span><strong>{job.company.name}</strong>{job.company.verified && <BadgeCheck size={14}/>}</div><h3>{job.title}</h3><span className="featured-placement-location"><MapPin size={13}/>{job.location}</span><div className="featured-placement-bid"><span>Current bid</span><strong>{dollars(job.current_bid_cents)}</strong></div></Link>)}</div> : <div className="featured-placements-empty"><ShieldCheck size={22}/><div><strong>Be the first employer at rank #1.</strong><p>Start with a $1.00 bid. The next verified employer must beat the current top bid to move ahead.</p></div><Link className="button button-small" href="/employer#promote">Bid for rank #1 <ArrowRight size={14}/></Link></div>}
      <div className="featured-placements-footer"><span>Transparent ranking · Verified employers only · Paid visibility never changes fit or trust signals</span><Link className="text-button" href="/employer#promote">Promote a job <ArrowRight size={14}/></Link></div>
    </div>
  </section>;
}
