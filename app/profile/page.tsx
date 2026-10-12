import Link from "next/link";
import ProfileForm from "@/components/profile/profile-form";
export const metadata = { title: "Your profile" };
export default function ProfilePage() { return <div className="career-page"><header className="career-header"><Link href="/dashboard" className="career-brand">reachflow<span>.</span></Link><nav><Link href="/applications">Applications</Link><Link href="/dashboard">Discover jobs</Link></nav></header><main id="main" className="career-main"><div className="career-hero"><span className="eyebrow">YOUR CAREER HOME</span><h1>Make the next application feel like you.</h1><p>Keep your details in one place. ReachFlow uses them to prepare clear, editable drafts for roles you choose.</p></div><ProfileForm/></main></div>; }
