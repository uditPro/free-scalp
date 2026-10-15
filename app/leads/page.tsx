"use client";
import Link from "next/link";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import LeadSearchControls from "@/components/lead-search-controls";
import LeadResults, { type Lead } from "@/components/lead-results";
import type { LeadSearchInput } from "@/lib/lead-workflow";
import { api } from "@/components/api-client";

export default function LeadsPage() {
  const [input, setInput] = useState<LeadSearchInput>({ niche: "", contactPreference: "any" }); const [leads, setLeads] = useState<Lead[]>([]); const [warnings, setWarnings] = useState<string[]>([]); const [pending, setPending] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { api<{ user: { email: string } | null }>("/api/session").then(data => setSignedIn(!!data.user)).catch(() => setError("Your session could not be loaded. Please refresh or sign in again.")).finally(() => setLoading(false)); }, []);
  async function search() { if (!signedIn) { setError("Sign in to search and save leads."); return; } setPending(true); setError(""); setWarnings([]); try { const data = await api<{ leads: Lead[]; warnings?: string[] }>("/api/leads", { ...input, limit: 50 }); setLeads(data.leads); setWarnings(data.warnings ?? []); } catch (err) { setError(err instanceof Error ? err.message : "Lead search failed. Please try again."); } finally { setPending(false); } }
  return <div className="lead-app"><header className="lead-header"><Link href="/dashboard" className="back-link"><ArrowLeft size={15}/>Workspace</Link><Link className="brand" href="/"><span className="brand-mark">⌘</span>reachflow<span className="brand-period">.</span></Link><Link className="button button-outline button-small" href="/leads/pipeline">Pipeline</Link></header><main id="main" className="lead-main"><div className="lead-hero"><span className="eyebrow">LEAD FINDER</span><h1>Research your next<br/><em>good conversation.</em></h1><p>Find businesses using public signals that match your offer. Every record is source-linked and scored for fit—not intent.</p></div>{loading ? <div className="loading-state"><LoaderCircle className="spin"/>Checking your workspace…</div> : !signedIn ? <div className="notice notice-config">Please <Link href="/login">sign in</Link> to search and save public business leads.</div> : <><LeadSearchControls value={input} onChange={setInput} onSubmit={search} pending={pending}/>{error && <div className="notice notice-error" role="alert">{error}</div>}{pending ? <div className="search-loading"><LoaderCircle className="spin"/><h2>Checking supported public sources…</h2><p>This can take a moment. No private data is accessed.</p></div> : (leads.length > 0 || warnings.length > 0) && <LeadResults leads={leads} warnings={warnings}/>}</>}</main></div>;
}
