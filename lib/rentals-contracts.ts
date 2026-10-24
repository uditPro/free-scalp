export type RentalVerification = "source-only" | "broker-confirmed" | "owner-confirmed";

export type RentalListing = {
  id: string;
  title: string;
  locality: string;
  rent: number;
  bedrooms: number;
  furnishing: "Unfurnished" | "Semi-furnished" | "Furnished";
  availableFrom: string;
  source: string;
  sourceUrl: string;
  lastChecked: string;
  freshness: "Fresh" | "Recent" | "Stale";
  verification: RentalVerification;
  highlights: string[];
  disclaimer: string;
};

/** Frontend contract for the future listings API. Public-web data stays explicitly labelled. */
export type RentalMatchRequest = {
  location: string;
  locality: string;
  budget: number;
  bedrooms: string;
  moveIn: string;
  furnishing: string;
  notes: string;
};

export const sampleAhmedabadListings: RentalListing[] = [
  { id: "a-101", title: "Bright 2 BHK near Prahlad Nagar", locality: "Prahlad Nagar", rent: 24000, bedrooms: 2, furnishing: "Semi-furnished", availableFrom: "2026-05-01", source: "Public web source", sourceUrl: "https://example.com/listing/a-101", lastChecked: "18 Oct 2026, 09:40 IST", freshness: "Fresh", verification: "source-only", highlights: ["Covered parking", "Power backup", "No brokerage listed"], disclaimer: "Public-web source only; availability and terms need confirmation." },
  { id: "a-102", title: "Quiet 1 BHK in Satellite", locality: "Satellite", rent: 16500, bedrooms: 1, furnishing: "Furnished", availableFrom: "2026-04-20", source: "Public web source", sourceUrl: "https://example.com/listing/a-102", lastChecked: "17 Oct 2026, 16:15 IST", freshness: "Recent", verification: "source-only", highlights: ["Lift", "Walkable to shops", "Pet policy not stated"], disclaimer: "Public-web source only; availability and terms need confirmation." },
  { id: "a-103", title: "Spacious 3 BHK in Thaltej", locality: "Thaltej", rent: 32000, bedrooms: 3, furnishing: "Unfurnished", availableFrom: "2026-05-15", source: "Public web source", sourceUrl: "https://example.com/listing/a-103", lastChecked: "16 Oct 2026, 11:05 IST", freshness: "Recent", verification: "source-only", highlights: ["Balcony", "Gated community", "Owner contact not provided"], disclaimer: "Public-web source only; availability and terms need confirmation." },
  { id: "a-104", title: "Compact 2 BHK by Chandkheda", locality: "Chandkheda", rent: 19500, bedrooms: 2, furnishing: "Semi-furnished", availableFrom: "2026-05-10", source: "Public web source", sourceUrl: "https://example.com/listing/a-104", lastChecked: "14 Oct 2026, 18:20 IST", freshness: "Stale", verification: "source-only", highlights: ["Near metro corridor", "Water included", "Recheck before visiting"], disclaimer: "Public-web source only; availability and terms need confirmation." },
];
