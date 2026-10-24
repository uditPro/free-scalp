"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, LoaderCircle, MapPin, Search, ShieldCheck } from "lucide-react";
import { api } from "@/components/api-client";

type PublicJob = { id: string; title: string; location: string; workplace_type: string; employment_type: string; experience_level: string; salary_min?: number | null; salary_max?: number | null; currency: string; description: string; requirements: string; published_at: string; company: { id: string; name: string; website_url: string; description: string; verified: boolean } };

function salaryLabel(job: PublicJob) {
  if (job.salary_min != null && job.salary_max != null) return `${job.currency} ${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()}`;
  if (job.salary_min != null) return `${job.currency} ${job.salary_min.toLocaleString()}+`;
  if (job.salary_max != null) return `Up to ${job.currency} ${job.salary_max.toLocaleString()}`;
  return "Salary not listed";
}

export default function JobBoard() {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextQuery = query, nextLocation = location) {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams(); if (nextQuery.trim()) params.set("query", nextQuery.trim()); if (nextLocation.trim()) params.set("location", nextLocation.trim());
      const result = await api<{ jobs: PublicJob[] }>(`/api/job-board${params.toString() ? `?${params}` : ""}`); setJobs(result.jobs ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "The job board could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load("", ""); }, []);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void load(); }

  return <div className="jobs-page"><section className="jobs-hero"><span className="eyebrow">THE REACHFLOW JOB BOARD</span><h1>Real roles from <em>verified companies.</em></h1><p>Browse jobs posted directly by companies that matched their work email domain to their public website. No pay-to-apply listings. No anonymous employers.</p><form className="jobs-search" onSubmit={submit}><label><Search size={17}/><span className="sr-only">Search jobs</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Role, skill, or company" /></label><label><MapPin size={17}/><span className="sr-only">Filter by location</span><input value={location} onChange={event => setLocation(event.target.value)} placeholder="Location or remote" /></label><button className="button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16}/> : <Search size={16}/>}Search jobs</button></form></section>
    <main className="jobs-content"><div className="jobs-heading"><div><span className="eyebrow">OPENINGS</span><h2>{loading ? "Finding roles…" : `${jobs.length} ${jobs.length === 1 ? "role" : "roles"} available`}</h2></div><Link className="button button-outline button-small" href="/employer">Post as an employer <ArrowRight size={14}/></Link></div>{error && <div className="notice notice-error" role="alert">{error}</div>}{loading ? <div className="career-loading" role="status"><LoaderCircle className="spin"/>Loading verified roles…</div> : jobs.length ? <div className="public-job-grid">{jobs.map(job => <Link href={`/jobs/${job.id}`} className="public-job-card" key={job.id}><div className="public-job-card-top"><span className="job-board-company"><span className="company-avatar"><BriefcaseBusiness size={17}/></span><span>{job.company.name}</span><BadgeCheck size={15}/></span><span className="job-board-date">{new Date(job.published_at).toLocaleDateString()}</span></div><h3>{job.title}</h3><div className="public-job-meta"><span><MapPin size={13}/>{job.location}</span><span>{job.workplace_type}</span><span>{job.employment_type}</span></div><p>{job.description.slice(0, 220)}{job.description.length > 220 ? "…" : ""}</p><div className="public-job-footer"><strong>{salaryLabel(job)}</strong><span>View role <ArrowRight size={14}/></span></div></Link>)}</div> : <div className="career-empty"><ShieldCheck size={28}/><h2>No matching roles yet.</h2><p>Try a broader search, or check back as verified companies add new openings.</p><button className="button button-small" onClick={() => { setQuery(""); setLocation(""); void load("", ""); }}>Show all roles</button></div>}</main>
  </div>;
}
