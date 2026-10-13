import type { Metadata } from "next";
import AuthForm from "@/components/auth-form";

export const metadata: Metadata = { title: "Create a ReachFlow workspace", description: "Create a ReachFlow workspace for source-linked job, client, and research discovery.", alternates: { canonical: "/signup" }, robots: { index: false, follow: false } };

export default function Signup() { return <AuthForm mode="signup"/>; }
