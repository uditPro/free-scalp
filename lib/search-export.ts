import type { SearchResult } from './validation';
export function csvCell(value: string) {
  const guarded = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${guarded.replaceAll('"', '""')}"`;
}
export function resultsCsv(results: SearchResult[]) {
  return [['Title', 'Description', 'Source', 'URL', 'Published (UTC)', 'Author', 'Expanded excerpt'], ...results.map(row => [row.title, row.description, row.source, row.url, row.publishedAt ?? '', row.author ?? '', row.content ?? ''])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
