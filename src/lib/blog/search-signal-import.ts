import { z } from "zod";
import type { SearchSignal } from "@/lib/providers/contracts";
import { containsPersonalData } from "./topic-engine";

const MAX_CSV_BYTES = 1_000_000;
const MAX_ROWS = 2_000;

const sourceSchema = z.enum(["search-console", "ads", "trends"]);
export type CsvSignalSource = z.infer<typeof sourceSchema>;

function normalizedHeader(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("nb-NO")
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[å]/g, "a")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseNumber(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const delimiter = input.split(/\r?\n/, 1)[0]?.includes(";") ? ";" : ",";

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

const aliases = {
  query: ["query", "queries", "searchterm", "searchterms", "sokeord", "sokefrase", "topqueries"],
  impressions: ["impressions", "impr", "visninger"],
  clicks: ["clicks", "klikk"],
  score: ["score", "interest", "interesse", "value", "verdi"],
} as const;

function columnIndex(headers: string[], options: readonly string[]) {
  return headers.findIndex((header) => options.includes(header));
}

export function parseSearchSignalCsv(input: string, sourceInput: string): SearchSignal[] {
  const source = sourceSchema.parse(sourceInput);
  if (Buffer.byteLength(input, "utf8") > MAX_CSV_BYTES) {
    throw new TypeError("CSV-filen er større enn 1 MB");
  }
  const rows = parseRows(input.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new TypeError("CSV-filen mangler datarader");
  if (rows.length - 1 > MAX_ROWS) throw new TypeError(`CSV-filen kan ha maksimalt ${MAX_ROWS} rader`);

  const headers = rows[0]!.map(normalizedHeader);
  const queryIndex = columnIndex(headers, aliases.query);
  if (queryIndex < 0) throw new TypeError("CSV-filen mangler kolonnen Query/Search term/Søkeord");
  const impressionsIndex = columnIndex(headers, aliases.impressions);
  const clicksIndex = columnIndex(headers, aliases.clicks);
  const scoreIndex = columnIndex(headers, aliases.score);

  const unique = new Map<string, SearchSignal>();
  for (const row of rows.slice(1)) {
    const query = row[queryIndex]?.trim().replace(/\s+/g, " ") || "";
    if (query.length < 5 || query.length > 140 || containsPersonalData(query)) continue;
    const key = query.toLocaleLowerCase("nb-NO");
    const signal: SearchSignal = {
      source,
      query,
      ...(impressionsIndex >= 0 ? { impressions: parseNumber(row[impressionsIndex]) } : {}),
      ...(clicksIndex >= 0 ? { clicks: parseNumber(row[clicksIndex]) } : {}),
      ...(scoreIndex >= 0 ? { score: parseNumber(row[scoreIndex]) } : {}),
    };
    const previous = unique.get(key);
    unique.set(key, {
      ...signal,
      impressions: (previous?.impressions || 0) + (signal.impressions || 0) || undefined,
      clicks: (previous?.clicks || 0) + (signal.clicks || 0) || undefined,
      score: Math.max(previous?.score || 0, signal.score || 0) || undefined,
    });
  }
  return [...unique.values()];
}

export function aggregateLeadQuestions(values: string[]): SearchSignal[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const sanitized = value
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ")
      .replace(/(?:\+?47)?[\s-]*\d{2}[\s-]*\d{2}[\s-]*\d{2}[\s-]*\d{2}/g, " ")
      .replace(/\b\d{1,4}\s+[A-Za-zÆØÅæøå][A-Za-zÆØÅæøå-]+(?:veien|gata|gate|vei)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (sanitized.length < 12 || sanitized.length > 140 || containsPersonalData(sanitized)) continue;
    const key = sanitized.toLocaleLowerCase("nb-NO");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([query, count]) => ({ source: "lead" as const, query, score: Math.min(100, count * 20) }));
}
