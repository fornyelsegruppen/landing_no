// Explicitly approved synthetic target only. Never imported by production check.
// No URL/environment override and no fixtures created or modified.
import { runPreflight } from './preflight.mjs';

if (process.argv[2] !== '--run-approved-local' || process.argv.length !== 3) {
  console.log('DB_COMPAT_LOCAL_DISABLED');
} else {
  try {
    if (Object.keys(process.env).some(key => /^PG/i.test(key))) throw new Error('CONFIG');
    const { default: pg } = await import('pg');
    const result = await runPreflight({
      // Validation-only synthetic URL. The injected client below never uses it.
      environment: { SEO_DB_COMPAT_PREFLIGHT: '1', VERCEL_ENV: 'production',
        DATABASE_URL: 'postgresql://synthetic:not-a-secret@example.invalid/synthetic' },
      createClient: async () => {
        const client = new pg.Client({ host: '127.0.0.1', port: 55432,
          database: 'seo_automation_browser_20260912', user: 'phase2b_qa',
          password: 'unused-local-trust-only', ssl: false,
          connectionTimeoutMillis: 5000, query_timeout: 6000 });
        const query = client.query.bind(client);
        client.query = async (text, values) => {
          const result = await query(text, values);
          if (text.startsWith('BEGIN TRANSACTION')) {
            const identity = await query(`SELECT current_database() AS db,
              host(inet_server_addr()) AS host, inet_server_port() AS port,
              current_user AS role, current_setting('transaction_read_only') AS readonly`);
            const row = identity.rows[0];
            if (row?.db !== 'seo_automation_browser_20260912' || row.host !== '127.0.0.1' ||
              row.port !== 55432 || row.role !== 'phase2b_qa' || row.readonly !== 'on') {
              // If this guard fails before runPreflight records BEGIN, connection
              // shutdown still rolls back the read-only transaction.
              throw new Error('LOCAL_IDENTITY');
            }
            const nullSafety = await query('SELECT bool_and(COALESCE(value, false)) AS ok FROM (VALUES (true),(NULL::boolean)) t(value)');
            if (nullSafety.rows[0]?.ok !== false) throw new Error('LOCAL_NULL_GUARD');
          }
          return result;
        };
        return client;
      },
    });
    if (result !== 0) process.exit(result);
  } catch {
    console.log('DB_COMPAT_FAIL_LOCAL_CONFIG');
    process.exit(1);
  }
}
