import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ClipboardList, UserRound } from "lucide-react";
import JobHuntSprint from "@/components/job-hunt-sprint";

export const metadata: Metadata = { title: "Seven-day job sprint", robots: { index: false, follow: false } };

export default function JobHuntPage() {
  return <div className="career-page"><header className="career-header"><Link href="/dashboard" className="career-brand">reachflow<span>.</span></Link><nav><Link href="/dashboard"><ArrowLeft size={15}/>Discover</Link><Link href="/applications"><ClipboardList size={15}/>Applications</Link><Link href="/profile"><UserRound size={15}/>Profile</Link></nav></header><main id="main" className="career-main sprint-main"><JobHuntSprint/></main></div>;
}
