export type VerificationStatus = "pending" | "verified" | "rejected";

export type CompanyVerification = {
  status: VerificationStatus;
  emailDomain: string;
  websiteDomain: string;
  method?: "business_email_domain";
  reason: string;
  verifiedAt?: string;
};

export type EmployerJobDraft = {
  title: string;
  location: string;
  workplace_type: "remote" | "hybrid" | "onsite";
  employment_type: "full-time" | "part-time" | "contract" | "internship";
  experience_level: "entry" | "mid" | "senior" | "lead";
  salary_min?: number | null;
  salary_max?: number | null;
  currency: string;
  description: string;
  requirements: string;
};

const consumerEmailDomains = new Set([
  "aol.com",
  "gmail.com",
  "gmx.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "mail.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "yahoo.com",
  "yandex.com",
  "zoho.com",
]);

export function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

export function websiteDomain(value: string) {
  try { return normalizeDomain(new URL(value).hostname); } catch { return ""; }
}

export function emailDomain(value: string) {
  const at = value.trim().toLowerCase().lastIndexOf("@");
  return at > 0 ? normalizeDomain(value.slice(at + 1)) : "";
}

export function domainsMatch(left: string, right: string) {
  const a = normalizeDomain(left);
  const b = normalizeDomain(right);
  return !!a && !!b && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`));
}

export function isConsumerEmailDomain(value: string) {
  return consumerEmailDomains.has(normalizeDomain(value));
}

export function verifyCompanyEmail(email: string | null | undefined, websiteUrl: string, now = new Date().toISOString()): CompanyVerification {
  const emailDomainValue = emailDomain(email ?? "");
  const websiteDomainValue = websiteDomain(websiteUrl);
  if (!emailDomainValue) return { status: "pending", emailDomain: "", websiteDomain: websiteDomainValue, reason: "Add a confirmed company email address to verify this employer." };
  if (!websiteDomainValue) return { status: "pending", emailDomain: emailDomainValue, websiteDomain: "", reason: "Add the company’s public HTTPS website so the domain can be checked." };
  if (isConsumerEmailDomain(emailDomainValue)) return { status: "pending", emailDomain: emailDomainValue, websiteDomain: websiteDomainValue, reason: "Use a company email address, not a personal inbox, to verify the employer." };
  if (!domainsMatch(emailDomainValue, websiteDomainValue)) return { status: "pending", emailDomain: emailDomainValue, websiteDomain: websiteDomainValue, reason: `The account email domain (${emailDomainValue}) must match the company website domain (${websiteDomainValue}).` };
  return { status: "verified", emailDomain: emailDomainValue, websiteDomain: websiteDomainValue, method: "business_email_domain", reason: "Business email and company website domains match.", verifiedAt: now };
}

export function jobPublishReadiness(job: Partial<EmployerJobDraft>) {
  const missing: string[] = [];
  if (!job.title?.trim()) missing.push("job title");
  if (!job.location?.trim()) missing.push("location");
  if (!job.workplace_type) missing.push("workplace type");
  if (!job.employment_type) missing.push("employment type");
  if (!job.experience_level) missing.push("experience level");
  if (!job.description?.trim() || job.description.trim().length < 40) missing.push("a job description of at least 40 characters");
  if (job.salary_min != null && job.salary_max != null && job.salary_max < job.salary_min) missing.push("a valid salary range");
  return { ready: missing.length === 0, missing };
}

export function mapEmployerStatusToCandidateStatus(status: string) {
  switch (status) {
    case "interview": return "interviewing" as const;
    case "rejected": return "rejected" as const;
    case "hired": return "offer" as const;
    case "withdrawn": return "withdrawn" as const;
    default: return "submitted" as const;
  }
}

export function salaryLabel(job: Pick<EmployerJobDraft, "salary_min" | "salary_max" | "currency">) {
  const currency = job.currency || "USD";
  const format = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  if (job.salary_min != null && job.salary_max != null) return `${currency} ${format(job.salary_min)}–${format(job.salary_max)}`;
  if (job.salary_min != null) return `${currency} ${format(job.salary_min)}+`;
  if (job.salary_max != null) return `Up to ${currency} ${format(job.salary_max)}`;
  return "Salary not listed";
}
