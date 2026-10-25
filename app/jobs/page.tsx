import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, UserRound } from "lucide-react";
import JobBoard from "@/components/job-board";
import FeaturedJobPlacements from "@/components/featured-job-placements";

export const metadata: Metadata = { title: "Verified company jobs", description: "Browse jobs posted by domain-verified ReachFlow companies.", alternates: { canonical: "/jobs" } };

export default function JobsPage() { return <div className="career-page jobs-shell"><header className="career-header"><Link href="/" className="career-brand">reachflow<span>.</span></Link><nav><Link href="/employer"><Building2 size={15}/>For employers</Link><Link href="/dashboard"><ArrowLeft size={15}/>Workspace</Link><Link href="/profile"><UserRound size={15}/>Profile</Link></nav></header><main id="main" className="career-main jobs-main"><FeaturedJobPlacements/><JobBoard/></main></div>; }
