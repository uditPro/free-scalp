import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, UserRound } from "lucide-react";
import PublicJobDetail from "@/components/public-job-detail";

export const metadata: Metadata = { title: "Job details", robots: { index: false, follow: false } };

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <div className="career-page jobs-shell"><header className="career-header"><Link href="/" className="career-brand">reachflow<span>.</span></Link><nav><Link href="/jobs"><ArrowLeft size={15}/>All jobs</Link><Link href="/employer"><Building2 size={15}/>For employers</Link><Link href="/profile"><UserRound size={15}/>Profile</Link></nav></header><main id="main" className="career-main jobs-main"><PublicJobDetail id={id}/></main></div>; }
