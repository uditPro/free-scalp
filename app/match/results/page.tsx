import type { Metadata } from "next";
import { ResultsPage } from "@/components/rentals-mvp";
export const metadata: Metadata = { title: "Your Ahmedabad rental matches", robots: { index: false, follow: false } };
export default function MatchResultsPage() { return <ResultsPage/>; }
