// OFFLINE TEST/GENERATION ONLY. Never imported by the database preflight.
// Node's built-in type stripper and a closed VM capture actual application SQL
// against a fake connection. No application imports or database calls execute.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';

export const root = new URL('../../', import.meta.url);
const prefix = 'src/lib/admin-v2/';
const snapshot = 'src/payload/migrations/20260824_094425_phase11_stock_image_fallback.json';
export const sourceFiles = [
  ...['case-list.ts', 'case-current-selection.ts', 'case-document-history.ts',
    'document-register-query.ts', 'case-selected-records.ts', 'case-history-navigation.ts',
    'pagination.ts', 'admin-read-db.ts', 'case-read-model.ts'].map(f => prefix + f),
  'src/lib/blog/scheduled-publisher.ts', 'src/lib/blog/seo-run-state.ts',
  'src/lib/blog/payload-blog-engine.ts', 'src/lib/blog/post-write-transaction.ts',
  'src/payload.config.ts', 'src/payload/collections/Posts.ts',
  'src/payload/collections/SeoRuns.ts', 'src/payload/collections/SeoTopics.ts',
  'src/payload/payload-types.ts', snapshot,
];
export const digest = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

export async function captureManifest(read = file => readFileSync(new URL(file, root), 'utf8')) {
  const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, digest(read(file))]));
  const queries = [];
  let label = '';
  const connection = { query: async (text, values = []) => {
    queries.push({ id: `${label}_${queries.filter(q => q.id.startsWith(label + '_')).length + 1}`, text: text.trim(), values });
    return { rows: [] };
  } };
  const shared = { Buffer, URLSearchParams,
    withAdminReadConnection: async (_payload, _user, work) => work(connection),
  };
  function load(file, names, bindings = {}) {
    const stripped = stripTypeScriptTypes(read(prefix + file))
      .replace(/^import\s[\s\S]*?;\s*$/gm, '')
      .replace(/\bexport\s+(?=(?:async\s+)?function|const|class)/g, '');
    return runInNewContext(`${stripped}\n;({${names.join(',')}})`, { ...shared, ...bindings }, { timeout: 1000 });
  }
  const pagination = load('pagination.ts', ['normalizeAdminListPagination']);
  const cases = load('case-list.ts', ['loadAdminCaseList'], pagination);
  label = 'CASE_DEFAULT';
  await cases.loadAdminCaseList({}, {}, {}, null);
  label = 'CASE_FILTERED';
  await cases.loadAdminCaseList({}, { query: '1', status: 'open', recordState: 'archived',
    action: 'approve_message', workerId: 1, dateFrom: '2026-01-01', dateTo: '2026-01-02' }, { page: 2 }, null);
  label = 'CASE_STATUS';
  await cases.loadAdminCaseList({}, { status: 'closed', recordState: 'all' }, {}, null);
  label = 'CURRENT_SELECTION';
  await load('case-current-selection.ts', ['loadCaseCurrentSelection']).loadCaseCurrentSelection({}, null, 1);
  label = 'DOCUMENT_HISTORY';
  await load('case-document-history.ts', ['loadCaseDocumentHistory'], {
    caseHistoryPageSize: 25, normalizeCaseHistoryPage: () => 1,
  }).loadCaseDocumentHistory({}, null, 1, 1);
  const navigation = load('case-history-navigation.ts', ['parseCaseRecordId']);
  label = 'SELECTED_RECORDS';
  await load('case-selected-records.ts', ['loadCaseSelectedRecords'], navigation)
    .loadCaseSelectedRecords({}, null, 1, { invoiceRecord: '1', warrantyRecord: '1' });
  const documents = load('document-register-query.ts', ['buildDocumentRegisterQuery', 'buildDocumentStatusFacetQuery',
    'encodeDocumentRegisterCursor', 'documentRegisterFilterFingerprint']);
  const filters = { query: 'synthetic', status: 'draft' };
  for (const direction of ['forward', 'backward']) {
    const cursor = documents.encodeDocumentRegisterCursor({ version: 1, direction,
      createdAt: '2026-01-01T00:00:00.000Z', typeRank: 1, sourceId: 1,
      filterFingerprint: documents.documentRegisterFilterFingerprint(filters) });
    const query = documents.buildDocumentRegisterQuery({ filters, direction, cursor });
    queries.push({ id: `DOCUMENT_${direction.toUpperCase()}`, text: query.text, values: query.values });
  }
  for (const [id, query] of [['DOCUMENT_DEFAULT', documents.buildDocumentRegisterQuery()],
    ['DOCUMENT_FACETS', documents.buildDocumentStatusFacetQuery(filters)]]) {
    queries.push({ id, text: query.text, values: query.values });
  }
  const schema = JSON.parse(read(snapshot));
  const tables = Object.values(schema.tables).filter(table => /^(posts($|_)|_posts_v($|_)|seo_topics($|_)|seo_runs($|_))/.test(table.name));
  const columns = tables.flatMap(table => Object.values(table.columns).map(column => ({
    table: table.name, column: column.name,
    type: ({ serial: 'int4', integer: 'int4', numeric: 'numeric', varchar: 'varchar',
      boolean: 'bool', 'timestamp(3) with time zone': 'timestamptz', jsonb: 'jsonb' })[column.type]
      || column.type.replaceAll('"', '').replace(/^public\./, ''),
  })));
  const usedTypes = new Set(columns.map(column => column.type));
  const enums = Object.values(schema.enums).filter(item => usedTypes.has(item.name))
    .map(item => ({ name: item.name, values: item.values }));
  return JSON.parse(JSON.stringify({ version: 1, sourceCommit: 'b02955a03461878ed95f927db45f388079e0827f',
    sourceHashes, columns, enums, queries }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(JSON.stringify(await captureManifest(), null, 2));
}
