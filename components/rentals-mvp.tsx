"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ExternalLink, Heart, Home, MapPin, ShieldCheck, ThumbsDown } from "lucide-react";
import { api, safeExternalUrl } from "./api-client";
import { type RentalListing, type RentalMatchRequest } from "@/lib/rentals-contracts";

function MatchGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "signed-in" | "signed-out">("checking");
  useEffect(() => {
    api<{ user: unknown }>("/api/session")
      .then(({ user }) => setState(user ? "signed-in" : "signed-out"))
      .catch(() => setState("signed-out"));
  }, []);
  if (state === "checking") return <div className="match-shell"><p className="muted">Checking your workspace…</p></div>;
  if (state === "signed-out") return <div className="match-shell"><div className="match-empty"><Home size={28}/><h1>Sign in to match homes</h1><p>Your saved matches and broker requests stay in your private workspace.</p><Link className="button" href="/login?next=/match/intake">Log in to continue <ArrowRight size={16}/></Link></div></div>;
  return <>{children}</>;
}

export function RentalHeader() {
  return <header className="rental-header"><Link className="brand" href="/homes">reachflow<span className="brand-period">.</span></Link><nav aria-label="Rental navigation"><Link href="/homes">Rental homes</Link><Link href="/match/intake">Start a match</Link><Link className="button button-small" href="/dashboard">Workspace</Link></nav></header>;
}

export function IntakePage() {
  const [form, setForm] = useState<RentalMatchRequest>({ location: "Ahmedabad", locality: "", budget: 25000, bedrooms: "Any", moveIn: "", furnishing: "Any", notes: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const update = (key: keyof RentalMatchRequest, value: string | number) => setForm(current => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const payload = {
      city: form.location,
      areas: form.locality.split(",").map(value => value.trim()).filter(Boolean),
      minRent: 0,
      maxRent: form.budget,
      bedrooms: form.bedrooms === "Any" ? undefined : Number(form.bedrooms.replace("+", "")),
      propertyTypes: [],
      furnished: form.furnishing === "Any" ? "any" : form.furnishing.toLowerCase().replace("-", "_"),
      moveInDate: form.moveIn || undefined,
      needs: [],
      consentToBrokerContact: false,
    };
    const response = await fetch("/api/housing/preferences", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    if (!response?.ok) {
      setError("We could not save this search. Check the location and try again.");
      setSubmitting(false);
      return;
    }
    sessionStorage.setItem("reachflow-rental-match", JSON.stringify(form));
    window.location.assign("/match/results");
  }
  return <MatchGuard><div className="rental-app"><RentalHeader/><main className="match-main"><div className="match-hero"><span className="eyebrow">PRIVATE MATCHING WORKSPACE</span><h1>Search rentals anywhere.</h1><p>Tell us the city, neighborhoods, and budget. We search public indexed rental sources and publicly indexed Facebook pages/groups, then label every result with its source and freshness.</p></div><form className="match-card intake-form" onSubmit={submit}><div className="card-heading"><div><span className="eyebrow">ANY CITY · RENTALS</span><h2>Your search brief</h2></div><span className="required-note">Required fields marked *</span></div><div className="form-grid"><label>City or metro area *<input required value={form.location} onChange={e => update("location", e.target.value)} placeholder="e.g. Ahmedabad, Austin, London" /></label><label>Monthly budget (₹ or local currency) *<input required type="number" min="1" value={form.budget} onChange={e => update("budget", Number(e.target.value))} /></label><label>Preferred neighborhoods<input value={form.locality} onChange={e => update("locality", e.target.value)} placeholder="Optional: Satellite, Downtown" /></label><label>Bedrooms<select value={form.bedrooms} onChange={e => update("bedrooms", e.target.value)}><option>Any</option><option>1</option><option>2</option><option>3</option><option>4+</option></select></label><label>Move-in date<input type="date" value={form.moveIn} onChange={e => update("moveIn", e.target.value)} /></label><label>Furnishing<select value={form.furnishing} onChange={e => update("furnishing", e.target.value)}><option>Any</option><option>Unfurnished</option><option>Semi-furnished</option><option>Furnished</option></select></label><label className="form-wide">Anything else?<textarea rows={3} value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="Commute, pets, parking, society preferences…" /></label></div><div className="consent-note"><ShieldCheck size={17}/><span>Private groups, login-only pages, and unverified contact details are never scraped. We do not guarantee availability or act as your broker.</span></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button" type="submit" disabled={submitting}>{submitting ? "Searching public sources…" : "See matching homes"} {!submitting && <ArrowRight size={17}/>}</button></form></main></div></MatchGuard>;
}

function ListingCard({ listing, saved, dismissed, onSave, onDismiss }: { listing: RentalListing; saved: boolean; dismissed: boolean; onSave: () => void; onDismiss: () => void }) {
  if (dismissed) return null;
  const sourceUrl = safeExternalUrl(listing.sourceUrl);
  return <article className="rental-listing-card"><div className="listing-heading"><div><span className="listing-source"><span className="source-dot"/> {listing.source} · {listing.freshness}</span><h2>{listing.title}</h2><p className="listing-location"><MapPin size={14}/> {listing.locality}</p></div><strong className="listing-rent">{listing.rent > 0 ? <>₹{listing.rent.toLocaleString("en-IN")}<small>/ month</small></> : "Rent not stated"}</strong></div><div className="listing-facts"><span>{listing.bedrooms > 0 ? `${listing.bedrooms} BHK` : "Bedrooms not stated"}</span><span>{listing.furnishing}</span><span>Available {listing.availableFrom}</span></div><div className="listing-evidence"><div><small>Last checked</small><strong>{listing.lastChecked}</strong></div><div><small>Verification</small><strong><ShieldCheck size={13}/> {listing.verification === "source-only" ? "Source only" : listing.verification}</strong></div></div><ul className="listing-highlights">{listing.highlights.map(highlight => <li key={highlight}><Check size={14}/>{highlight}</li>)}</ul><p className="listing-disclaimer">{listing.disclaimer}</p><div className="listing-actions"><button className={`icon-action ${saved ? "is-active" : ""}`} type="button" onClick={onSave} aria-pressed={saved}><Heart size={16} fill={saved ? "currentColor" : "none"}/> {saved ? "Saved" : "Save"}</button><button className="icon-action" type="button" onClick={onDismiss}><ThumbsDown size={16}/> Dismiss</button>{sourceUrl && <a className="button button-small" href={sourceUrl} target="_blank" rel="noreferrer">Open source <ExternalLink size={13}/></a>}</div></article>;
}

type MatchResponse = { location?: string; listings?: Array<Record<string, unknown>>; warnings?: string[] };

export function ResultsPage() {
  const [brief, setBrief] = useState<RentalMatchRequest | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [apiListings, setApiListings] = useState<RentalListing[]>([]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("reachflow-rental-match");
      setBrief(stored ? JSON.parse(stored) : null);
      setSaved(JSON.parse(localStorage.getItem("reachflow-rental-saved") || "[]"));
    } catch {
      setBrief(null);
      setError("Your search brief could not be restored. Start a new search.");
    }
  }, []);

  useEffect(() => {
    if (!brief) {
      setLoading(false);
      return;
    }
    api<MatchResponse>("/api/housing/matches", { limit: 30 })
      .then(result => {
        setWarnings(result.warnings ?? []);
        setApiListings((result.listings ?? []).map(listing => {
          const lastSeen = String(listing.last_seen_at ?? "");
          const age = Date.now() - Date.parse(lastSeen);
          const source = String(listing.source_name ?? "Public indexed source");
          return {
            id: String(listing.id),
            title: String(listing.title ?? `${brief.location} rental`),
            locality: String(listing.area ?? brief.locality ?? brief.location),
            rent: Number(listing.rent ?? 0),
            bedrooms: Number(listing.bedrooms ?? 0),
            furnishing: String(listing.furnished ?? "Unknown") as RentalListing["furnishing"],
            availableFrom: "Not confirmed",
            source,
            sourceUrl: String(listing.source_url ?? ""),
            lastChecked: lastSeen || "Not stated",
            freshness: Number.isFinite(age) && age < 3 * 86400000 ? "Fresh" : Number.isFinite(age) && age < 7 * 86400000 ? "Recent" : "Stale",
            verification: listing.source_only === false ? "broker-confirmed" : "source-only",
            highlights: source.toLowerCase().includes("facebook") ? ["Publicly indexed Facebook source", "Open the source to verify the post and contact details"] : ["Publicly indexed source", "Open the source to verify the listing and contact details"],
            disclaimer: "Public-web source only; availability, rent, ownership, and contact details require confirmation.",
          };
        }));
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "The rental search could not be completed."))
      .finally(() => setLoading(false));
  }, [brief]);

  const listings = useMemo(() => apiListings.filter(listing => !dismissed.includes(listing.id)), [apiListings, dismissed]);
  async function toggleSave(id: string) {
    const action = saved.includes(id) ? "dismiss" : "save";
    const result = await fetch(`/api/housing/listings/${id}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (!result.ok) return;
    const next = action === "save" ? [...saved, id] : saved.filter(item => item !== id);
    setSaved(next);
    localStorage.setItem("reachflow-rental-saved", JSON.stringify(next));
  }

  return <MatchGuard><div className="rental-app"><RentalHeader/><main className="match-main results-main"><div className="results-top"><div><span className="eyebrow">YOUR RENTAL SEARCH</span><h1>Homes worth a closer look.</h1><p>{brief ? `For ${brief.locality ? `${brief.locality}, ` : ""}${brief.location}` : "Your search"} · {listings.length} indexed matches</p></div><Link className="button button-outline button-small" href="/match/intake">Edit search</Link></div><div className="trust-banner"><ShieldCheck size={18}/><div><strong>Evidence first</strong><span>We search public indexed web pages and publicly indexed Facebook pages/groups. We do not scrape private groups or promise that a listing is still open.</span></div></div>{warnings.length > 0 && <div className="match-warning"><strong>Search coverage</strong><ul>{warnings.slice(0, 4).map(warning => <li key={warning}>{warning}</li>)}</ul></div>}{error && <div className="match-empty"><h2>Search needs another try</h2><p>{error}</p><Link className="button" href="/match/intake">Edit search</Link></div>}{loading && <div className="match-empty"><h2>Searching public sources…</h2><p>Checking indexed rental pages and public Facebook pages/groups for this location.</p></div>}{!loading && !error && <div className="listing-grid">{listings.length ? listings.map(listing => <ListingCard key={listing.id} listing={listing} saved={saved.includes(listing.id)} dismissed={dismissed.includes(listing.id)} onSave={() => toggleSave(listing.id)} onDismiss={() => setDismissed(current => [...current, listing.id])} />) : <div className="match-empty"><h2>No close matches yet</h2><p>Try a wider neighborhood, a higher budget, or search another location. We will not invent listings when public sources return nothing.</p><Link className="button" href="/match/intake">Adjust search</Link></div>}</div>}</main></div></MatchGuard>;
}
