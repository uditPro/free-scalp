export type ConnectorCapability = {
  id: string;
  label: string;
  mode: 'public' | 'authorized';
  available: boolean;
  coverage: string;
  setup: string;
  searchDomain?: string;
};

export const CONNECTORS: ConnectorCapability[] = [
  { id: 'web-search', label: 'Public web search', mode: 'public', available: true, coverage: 'Public pages indexed by Exa, with source links and supported date/domain filters.', setup: 'Available through the configured Exa MCP/API provider.' },
  { id: 'google-places', label: 'Google Places API', mode: 'authorized', available: true, coverage: 'Official Places API business metadata used only to corroborate public business identity, address, phone, and website.', setup: 'Set GOOGLE_PLACES_API_KEY on the server with a key authorized for Places API (New). ReachFlow never scrapes Maps pages or accepts keys from the browser.' },
  { id: 'github', label: 'GitHub public', mode: 'public', available: true, coverage: 'Public repositories, issues, docs, and profiles that the web provider indexes.', setup: 'Select GitHub in advanced source filters.', searchDomain: 'github.com' },
  { id: 'youtube', label: 'YouTube public', mode: 'public', available: true, coverage: 'Public video pages and indexed descriptions; this dashboard does not download or transcribe videos.', setup: 'Select YouTube in advanced source filters.', searchDomain: 'youtube.com' },
  { id: 'bilibili', label: 'Bilibili public', mode: 'public', available: true, coverage: 'Public pages indexed by the provider; direct bili-cli search is not installed into the web server.', setup: 'Select public web search and include bilibili.com when needed.', searchDomain: 'bilibili.com' },
  { id: 'reddit', label: 'Reddit public index', mode: 'public', available: true, coverage: 'Public Reddit pages returned by the provider; no account-only communities or private data.', setup: 'Select Reddit in advanced source filters.', searchDomain: 'reddit.com' },
  { id: 'linkedin', label: 'LinkedIn public index', mode: 'public', available: true, coverage: 'Public indexed pages only; private profiles, feeds, and job sessions require a separate authorized MCP connector.', setup: 'Select LinkedIn in advanced source filters.', searchDomain: 'linkedin.com' },
  { id: 'x', label: 'X / Twitter public index', mode: 'public', available: true, coverage: 'Public indexed pages only; timelines and search requiring login are not accessed.', setup: 'Select X / Twitter in advanced source filters.', searchDomain: 'x.com' },
  { id: 'facebook', label: 'Facebook public index', mode: 'public', available: true, coverage: 'Public indexed pages only; private groups and account feeds require a user-controlled browser session.', setup: 'Select Facebook in advanced source filters.', searchDomain: 'facebook.com' },
  { id: 'instagram', label: 'Instagram public index', mode: 'public', available: true, coverage: 'Public indexed pages only; private accounts and authenticated feeds are not accessed.', setup: 'Select Instagram in advanced source filters.', searchDomain: 'instagram.com' },
  { id: 'tiktok', label: 'TikTok public index', mode: 'public', available: true, coverage: 'Public indexed pages only; no authenticated profile or session scraping.', setup: 'Select TikTok in advanced source filters.', searchDomain: 'tiktok.com' },
  { id: 'rss', label: 'RSS / Atom', mode: 'public', available: false, coverage: 'The upstream Agent-Reach CLI supports RSS parsing, but ReachFlow does not yet persist user feed subscriptions.', setup: 'Use public web search for now; RSS subscriptions are not enabled in this SaaS surface.' },
  { id: 'authorized-social', label: 'Authorized social connectors', mode: 'authorized', available: false, coverage: 'Agent-Reach documents OpenCLI, rdt-cli, Twitter cookies, and LinkedIn MCP flows, but those require explicit local/browser credentials.', setup: 'Not enabled in the hosted web server. Never paste cookies or tokens into ReachFlow.' },
];
