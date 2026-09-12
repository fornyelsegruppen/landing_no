# Integrated SEO / ONE UI — local API acceptance

Owner: SEO. 2026-09-12. Application/build SHA
`f396c23767ae7f4e69ad5469a5073fb52e3f83d3`.

Merged reviewed SEO `848a3c85e49cafacbb6d0ef3158e043aeda43ce0` and entire ONE UI
`b58ef703cc69f73f5e27a8b252edf24686f14ba1`, common base414f65f, with no changed-path
overlap, merge conflict, manual resolution, fixture reseed, or RF changes by SEO.

## Verified gates

- Expanded integration: 104 Vitest files / 625 tests, exit0.
- Local Node fixture/API boundary helpers: 5 tests, exit0. ONE UI script guard:
  2 tests, exit0, via explicit Vitest include (default configuration excludes
  scripts; it is not a Node built-in test).
- Full TypeScript, touched SEO/ONE UI ESLint and diff checks: exit0.
- Direct Next build via `scripts/seo-local-browser.mjs build`: exit0, 74 static
  pages. No `npm run build`, `build:migrate`, or production migration command.
- Default-OFF runtime authenticated status readback: draft generation OFF,
  approved publisher OFF, executor paused/unverified, GSC configuration required,
  Trends unverified. These are not live-provider/executor PASS.

## One bounded application-API run

Explicit local `start-review-canary` changed only loopback runtime UI flags;
AI/provider credentials/executor remained absent. `api-e2e` used normal login with
the existing synthetic account, not browser cookies. Exit0, `ok:true`.

Only newly created fixture post5 was mutated:
`seo-api-e2e-d38c1118-02bf-4f63-9f33-16e92a915efe`.

1. Actual current QA → human approval → future schedule → different future
   schedule → identical-time no-op → manual publication: API PASS.
2. Warm anonymous article200, public list and sitemap inclusion → explicit
   unpublish → immediate article404, no public-list entry, no sitemap entry:
   API PASS. No waiting for ISR expiry was used.
3. Native published-version restore even with `draft=false` query → draft,
   human_review, cleared quality/reviewer/schedule, new publication blocked409,
   anonymous article still404: API PASS.
4. Cleanup verified this run's post slug/author, withdrew only that synthetic
   post, and retained its version history. Fixtures1–4, especially post3 with an
   uncertain browser confirmation, were not changed by this harness.

Runtime was then returned to default OFF without rebuilding. No real provider,
cron trigger, mail, form submission, DNS, deployment alias or production write.

## Not accepted by this evidence

Actual native GUI confirmation/history interactions and integrated ONE UI
geometry/navigation remain separate browser gates. CONTROL reported CUA transport
timeouts; this API run is not a browser workaround or browser PASS. No SEO live
automation/full-launch PASS: external providers/executor and release gates remain
unresolved. GSC baseline comparison persistence is a separate pending source
follow-up and is not claimed by this application SHA.
