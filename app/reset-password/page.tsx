import type { Metadata } from "next";
import ResetPasswordForm from "@/components/reset-password-form";

export const metadata: Metadata = { title: "Reset your ReachFlow password", description: "Securely reset your ReachFlow password.", alternates: { canonical: "/reset-password" }, robots: { index: false, follow: false } };

export default function ResetPassword() { return <ResetPasswordForm/>; }
