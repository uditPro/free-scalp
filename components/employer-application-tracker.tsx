"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, LoaderCircle, MapPin } from "lucide-react";
import { api } from "@/components/api-client";

type EmployerApplication = { id: string; status: string; created_at: string; updated_at: string; job?: { id: string; title: string; location: string; workplace_type: string; employment_type: string; company?: { name: string } | null } | null };

const labels: Record<string, string> = { submitted: "Submitted", reviewing: "Under review", interview: "Interview", rejected: "Not moving forward", hired: "Offer", withdrawn: "Withdrawn" };

export default function EmployerApplicationTracker() {
  const [items, setItems] = useState<EmployerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { api<{ applications: EmployerApplication[] }>("/api/job-applications").then(result => setItems(result.applications ?? [])).catch(err => setError(err instanceof Error ? err.message : "Employer applications could not be loaded.")).finally(() => setLoading(false)); }, []);
  return <section className="employer-candidate-applications"><div className="career-title-row"><div><span className="eyebrow">VERIFIED COMPANY APPLICATIONS</span><h2>Applications to company-posted roles.</h2><p>These roles are applied to directly inside ReachFlow. Employer status updates are reflected here.</p></div><Link className="button button-outline button-small" href="/jobs">Browse verified jobs <ArrowRight size={14}/></Link></div>{loading ? <div className="career-loading" role="status"><LoaderCircle className="spin"/>Loading employer applications…</div> : error ? <div className="notice notice-error" role="alert">{error}</div> : items.length ? <div className="tracker-list">{items.map(item => <Link className="tracker-row" href={item.job ? `/jobs/${item.job.id}` : "/jobs"} key={item.id}><div className="tracker-icon"><BriefcaseBusiness size={19}/></div><div className="tracker-details"><strong>{item.job?.title ?? "Company role"}</strong><span>{item.job?.company?.name ?? "Verified employer"} <BadgeCheck size={13}/></span><small>{item.job?.location ?? "Location not listed"} · Applied {new Date(item.created_at).toLocaleDateString()}</small></div><div className="tracker-status"><span className="status-pill">{labels[item.status] ?? item.status}</span>{item.job?.workplace_type && <small><MapPin size={11}/>{item.job.workplace_type}</small>}</div><ArrowRight size={17}/></Link>)}</div> : <div className="career-empty"><BriefcaseBusiness size={28}/><h2>No employer applications yet.</h2><p>Find a verified company role and apply with your ReachFlow profile.</p><Link className="button button-small" href="/jobs">Browse verified jobs <ArrowRight size={15}/></Link></div>}</section>;
}
