import type { Metadata } from "next";
import { IntakePage } from "@/components/rentals-mvp";
export const metadata: Metadata = { title: "Start an Ahmedabad rental match", robots: { index: false, follow: false } };
export default function MatchIntakePage() { return <IntakePage/>; }
