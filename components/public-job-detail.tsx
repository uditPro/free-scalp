"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Check, ExternalLink, LoaderCircle, MapPin, Send, ShieldCheck } from "lucide-react";
import { api, safeExternalUrl } from "@/components/api-client";

type PublicJob = { id: string; title: string; location: string; workplace_type: string; employment_type: string; experience_level: string; salary_min?: number | null; salary_max?: number | null; currency: string; description: string; requirements: string; published_at: string; company: { name: string; website_url: string; description: string; verified: boolean } };
function salaryLabel(job: PublicJob) { if (job.salary_min != null && job.salary_max != null) return `${job.currency} ${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()}`; if (job.salary_min != null) return `${job.currency} ${job.salary_min.toLocaleString()}+`; if (job.salary_max != null) return `Up to ${job.currency} ${job.salary_max.toLocaleString()}`; return "Salary not listed"; }

export default function PublicJobDetail({ id }: { id: string }) {
  const [job, setJob] = useState<PublicJob | null>(null);
  const [coverNote, setCoverNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { api<{ job: PublicJob }>(`/api/job-board/${encodeURIComponent(id)}`).then(result => setJob(result.job)).catch(err => setError(err instanceof Error ? err.message : "This job could not be loaded.")).finally(() => setLoading(false)); }, [id]);
  async function apply() {
    setPending(true); setError(""); setMessage("");
    try { await api(`/api/job-board/${encodeURIComponent(id)}/apply`, { coverNote }); setMessage("Application sent. The employer can now review your ReachFlow profile and resume."); }
    catch (err) { setError(err instanceof Error ? err.message : "Your application could not be sent."); }
    finally { setPending(false); }
  }
  if (loading) return <div className="career-loading" role="status"><LoaderCircle className="spin"/>Opening job details…</div>;
  if (error || !job) return <div className="notice notice-error" role="alert">{error || "This job is unavailable."} <Link href="/jobs">Back to jobs</Link></div>;
  const website = safeExternalUrl(job.company.website_url);
  return <div className="public-job-detail"><Link href="/jobs" className="back-link"><ArrowLeft size={15}/>All jobs</Link><div className="public-job-layout"><main><div className="public-job-heading"><span className="job-board-company"><span className="company-avatar"><ShieldCheck size={18}/></span>{job.company.name}<BadgeCheck size={16}/></span><h1>{job.title}</h1><div className="public-job-meta large"><span><MapPin size={15}/>{job.location}</span><span>{job.workplace_type}</span><span>{job.employment_type}</span><span>{job.experience_level}</span></div></div><section className="career-card public-job-copy"><div><span className="eyebrow">ABOUT THE ROLE</span><h2>What you’ll do</h2></div><p>{job.description}</p>{job.requirements && <><div className="public-job-copy-heading"><span className="eyebrow">WHAT THEY’RE LOOKING FOR</span></div><p className="pre-wrap">{job.requirements}</p></>}</section></main><aside className="public-job-side"><section className="career-card apply-card"><span className="eyebrow">APPLY THROUGH REACHFLOW</span><h2>{salaryLabel(job)}</h2><p className="muted small">Your application uses the name and resume saved in your ReachFlow profile. Review your profile before applying.</p>{message && <div className="notice notice-success" role="status"><Check size={15}/>{message}</div>}{error && <div className="notice notice-error" role="alert">{error}{error.includes("sign in") && <> <Link href={`/login?next=${encodeURIComponent(`/jobs/${id}`)}`}>Sign in</Link></>}</div>}{!message && <><label>Optional note to the employer<textarea rows={6} value={coverNote} onChange={event => setCoverNote(event.target.value)} maxLength={4000} placeholder="Share the most relevant context about your experience."/></label><button className="button full-width" disabled={pending} onClick={() => void apply()}>{pending ? <LoaderCircle className="spin" size={16}/> : <Send size={16}/>} {pending ? "Sending…" : "Apply now"}</button></>}</section><section className="career-card company-summary"><span className="eyebrow">VERIFIED COMPANY</span><h2>{job.company.name} <BadgeCheck size={17}/></h2><p>{job.company.description || "A verified ReachFlow employer."}</p>{website && <a className="text-button" href={website} target="_blank" rel="noreferrer">Company website <ExternalLink size={14}/></a>}</section></aside></div></div>;
}
