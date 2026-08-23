export function articleLeadMetrics(leads: Array<{ contentSourcePath?: string | null; status?: string | null }>, slug: string) {
  const paths = new Set([`/no/blogg/${slug}`, `/en/blogg/${slug}`]);
  const attributed = leads.filter((lead) => Boolean(lead.contentSourcePath && paths.has(lead.contentSourcePath)));
  return { leads: attributed.length, convertedLeads: attributed.filter((lead) => lead.status === "converted").length };
}
