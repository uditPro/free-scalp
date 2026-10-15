"use client";
import Link from "next/link";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import LeadPipeline from "@/components/lead-pipeline";
import type { Lead } from "@/components/lead-results";
import { api } from "@/components/api-client";

export default function PipelinePage() { const [leads, setLeads] = useState<Lead[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function load(status?: string) { setLoading(true); setError(""); try { const query = status ? `?status=${encodeURIComponent(status)}` : ""; const data = await api<{ leads: Lead[] }>(`/api/leads${query}`); setLeads(data.leads); } catch (err) { setError(err instanceof Error ? err.message : "Pipeline could not be loaded."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  return <div className="lead-app"><header className="lead-header"><Link href="/leads" className="back-link"><ArrowLeft size={15}/>Lead finder</Link><Link className="brand" href="/"><span className="brand-mark">⌘</span>reachflow<span className="brand-period">.</span></Link><span /></header><main id="main" className="lead-main">{error && <div className="notice notice-error">{error}</div>}{loading ? <div className="loading-state"><LoaderCircle className="spin"/>Loading your pipeline…</div> : <LeadPipeline leads={leads} onChange={status => void load(status)}/>}</main></div>;
}
