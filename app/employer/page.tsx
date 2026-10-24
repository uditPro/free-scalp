import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, UserRound } from "lucide-react";
import EmployerPortal from "@/components/employer-portal";

export const metadata: Metadata = { title: "Employer portal", robots: { index: false, follow: false } };

export default function EmployerPage() { return <div className="career-page"><header className="career-header"><Link href="/" className="career-brand">reachflow<span>.</span></Link><nav><Link href="/jobs"><BriefcaseBusiness size={15}/>Browse jobs</Link><Link href="/dashboard"><ArrowLeft size={15}/>Workspace</Link><Link href="/profile"><UserRound size={15}/>Profile</Link></nav></header><main id="main" className="career-main employer-main"><EmployerPortal/></main></div>; }
