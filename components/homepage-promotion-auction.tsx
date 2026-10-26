"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, LoaderCircle, Megaphone, Trophy } from "lucide-react";
import { api } from "@/components/api-client";

type HomepagePromotion = { id: string; website_url?: string | null; x_username?: string | null; current_bid_cents: number; rank: number };
type AudienceStats = { todayVisits: number; activeUsers: number; activeWindowMinutes: number };

function dollars(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function identityLabel(promotion: HomepagePromotion) { return promotion.website_url ? promotion.website_url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : `@${promotion.x_username}`; }

export default function HomepagePromotionAuction() {
  const [promotions, setPromotions] = useState<HomepagePromotion[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [xUsername, setXUsername] = useState("");
  const [bidAmount, setBidAmount] = useState("1.00");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<AudienceStats>({ todayVisits: 0, activeUsers: 0, activeWindowMinutes: 5 });
  const [statsReady, setStatsReady] = useState(false);

  async function load() {
    try { const result = await api<{ promotions: HomepagePromotion[] }>("/api/homepage-promotions"); setPromotions(result.promotions ?? []); }
    catch { setPromotions([]); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const refresh = async () => {
      try {
        const result = await api<AudienceStats>("/api/analytics");
        setStats(result);
        setStatsReady(true);
      } catch { setStatsReady(false); /* Metrics are non-blocking for the promotion flow. */ }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const topBidCents = promotions[0]?.current_bid_cents ?? 0;
  const minimumBidCents = Math.max(100, topBidCents + 100);
  const enteredBidCents = Math.round(Number(bidAmount || 0) * 100);
  const estimatedRank = enteredBidCents >= minimumBidCents ? 1 : null;
  const identityCount = Number(Boolean(websiteUrl.trim())) + Number(Boolean(xUsername.trim()));
  const bidHint = useMemo(() => topBidCents ? `Current top bid ${dollars(topBidCents)} · minimum to claim #1 ${dollars(minimumBidCents)}` : "No paid placement yet · #1 opens at $1.00", [minimumBidCents, topBidCents]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (identityCount !== 1) { setError("Enter either a business website or an X username, not both."); return; }
    if (!termsAccepted) { setError("Agree to the sponsored placement terms before opening payment."); return; }
    if (!Number.isFinite(enteredBidCents) || enteredBidCents < minimumBidCents) { setError(`Bid at least ${dollars(minimumBidCents)} to enter the auction.`); return; }
    setPending(true);
    try {
      const result = await api<{ url: string }>("/api/homepage-promotions", { websiteUrl: websiteUrl.trim() || undefined, xUsername: xUsername.trim() || undefined, targetCents: enteredBidCents, termsAccepted: true }, { method: "POST" });
      window.location.assign(result.url);
    } catch (err) { setError(err instanceof Error ? err.message : "Payment checkout could not be opened."); setPending(false); }
  }

  return <section className="homepage-promotion-auction container" aria-labelledby="homepage-promotion-title">
    <div className="homepage-promotion-panel">
      <div className="homepage-promotion-heading"><div><span className="eyebrow"><Megaphone size={13}/> HOMEPAGE PROMOTION MARKET</span><h2 id="homepage-promotion-title">Put your company in front of <em>more people.</em></h2><p>Enter a public business website or X username, choose your bid, agree to the terms, and continue directly to secure payment. No business verification or sign-in is required.</p></div><div className="homepage-promotion-top"><span>Current rank #1 bid</span><strong>{topBidCents ? dollars(topBidCents) : "$1.00"}</strong><small>{topBidCents ? `Bid ${dollars(minimumBidCents)} to move ahead` : "First bid can start here"}</small></div></div>
      <div className="homepage-audience-stats" aria-label="ReachFlow audience metrics"><div><span>Today&apos;s visits</span><strong>{statsReady ? stats.todayVisits.toLocaleString() : "—"}</strong></div><div><span>Active now</span><strong><i className="live-status-dot"/> {statsReady ? stats.activeUsers.toLocaleString() : "—"}</strong><small>{statsReady ? `Seen in the last ${stats.activeWindowMinutes} minutes` : "Metrics setup required"}</small></div><div><span>Public auction</span><strong>{promotions.length.toLocaleString()}</strong><small>Active placements</small></div></div>
      <div className="homepage-promotion-layout">
        <div className="homepage-promotion-list"><div className="homepage-promotion-list-heading"><strong>Live placements</strong><span>{loading ? "Loading…" : `${promotions.length} active`}</span></div>{loading ? <div className="featured-placements-loading"><LoaderCircle className="spin" size={17}/>Loading live bids…</div> : promotions.length ? promotions.slice(0, 5).map(promotion => <div className="homepage-promotion-row" key={promotion.id}><span className="homepage-promotion-rank"><Trophy size={14}/>#{promotion.rank}</span><strong>{identityLabel(promotion)}</strong><span>{dollars(promotion.current_bid_cents)}</span></div>) : <div className="homepage-promotion-empty">No one has bid yet. Start the homepage market at $1.00.</div>}</div>
        <form className="homepage-promotion-form" onSubmit={submit}><div className="homepage-promotion-form-heading"><strong>Bid for your spot</strong><span>{bidHint}</span></div><label>Business website <input type="url" value={websiteUrl} onChange={event => setWebsiteUrl(event.target.value)} placeholder="https://yourcompany.com" maxLength={2048}/></label><div className="homepage-promotion-or">or</div><label>X username <input value={xUsername} onChange={event => setXUsername(event.target.value)} placeholder="@yourcompany" maxLength={16}/></label><label>Bid amount (USD) <input type="number" min={(minimumBidCents / 100).toFixed(2)} step="1" value={bidAmount} onChange={event => setBidAmount(event.target.value)}/></label><div className={`homepage-promotion-estimate ${estimatedRank ? "is-ready" : ""}`}>{estimatedRank ? <><Trophy size={15}/> Estimated placement: <strong>#1</strong></> : <>Enter at least <strong>{dollars(minimumBidCents)}</strong> to claim #1</>}</div><label className="homepage-promotion-terms"><input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)}/><span>I agree this is a clearly labeled sponsored placement. Payment buys visibility only, does not imply endorsement, and I will not submit misleading or unlawful content.</span></label>{error && <p className="homepage-promotion-error" role="alert">{error}</p>}<button className="button full-width" type="submit" disabled={pending || !termsAccepted}>{pending ? <LoaderCircle className="spin" size={16}/> : <Megaphone size={16}/>} {pending ? "Opening secure payment…" : "Continue to payment"}<ArrowRight size={15}/></button><small className="homepage-promotion-payment-note">Stripe will collect payment details and email receipt information on the secure checkout page.</small></form>
      </div>
      <div className="homepage-promotion-footer">Sponsored labels stay visible to candidates. The auction changes homepage visibility only; it does not change job fit, verification, or trust signals.</div>
    </div>
  </section>;
}
