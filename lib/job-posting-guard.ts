const instructionPatterns = [
  /ignore (?:all|any|the) previous instructions/i,
  /system message/i,
  /reveal (?:your|the) prompt/i,
  /send (?:me|us) your password/i,
  /upload (?:your|a) api key/i,
  /pay (?:a fee|money) to apply/i,
];

export type JobPostingIntegrity = {
  status: 'clear' | 'review';
  flags: string[];
  cleanedText: string;
};

export function inspectJobPosting(title: string, description: string, requirements = ''): JobPostingIntegrity {
  const raw = `${title}\n\n${description}\n\n${requirements}`;
  const cleanedText = raw
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 30000);
  const flags = instructionPatterns.flatMap((pattern, index) => pattern.test(cleanedText) ? [`instruction-like-content-${index + 1}`] : []);
  if (/pay\s+(?:to|for)\s+(?:training|equipment|background check)/i.test(cleanedText)) flags.push('possible-payment-request');
  return { status: flags.length ? 'review' : 'clear', flags: [...new Set(flags)], cleanedText };
}

export function sourceType(source: string | undefined, url: string | undefined): 'employer' | 'ats' | 'job-board' | 'social' | 'search-index' | 'unknown' {
  const host = (() => { try { return new URL(url ?? '').hostname.toLowerCase(); } catch { return ''; } })();
  if (/greenhouse|lever|ashby|workable|smartrecruiters|workday/.test(host)) return 'ats';
  if (/linkedin|indeed|ziprecruiter|glassdoor|monster/.test(host)) return 'job-board';
  if (/facebook|reddit|x\.com|twitter/.test(host)) return 'social';
  if (source && /employer|company|official/i.test(source)) return 'employer';
  return source ? 'search-index' : 'unknown';
}
