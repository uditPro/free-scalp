import type { Metadata } from "next";
import AuthForm from "@/components/auth-form";

export const metadata: Metadata = { title: "Log in to ReachFlow", description: "Sign in to your ReachFlow opportunity research workspace.", alternates: { canonical: "/login" }, robots: { index: false, follow: false } };

export default function Login() { return <AuthForm mode="login"/>; }
