import type { Metadata } from "next";
import { IntakePage } from "@/components/rentals-mvp";
export const metadata: Metadata = { title: "Search rentals anywhere", robots: { index: false, follow: false } };
export default function MatchIntakePage() { return <IntakePage/>; }
