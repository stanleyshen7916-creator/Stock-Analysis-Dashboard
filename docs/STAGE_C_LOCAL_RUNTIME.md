# Stage C — Dashboard Local Runtime

The Dashboard UI is unchanged. Runtime selection is the only Stage C change.

## Default

Normal URL uses Cloud Supabase. This is the rollback/fallback configuration.

## Local Production

Use:

`http://localhost:<dashboard-port>/?runtime=local&key=<local publishable-or-anon-key>`

The key must come from `supabase status` on the same local project. Use only a publishable/anon key; never use a secret/service-role key.

## Runtime contract

`window.APP_CONFIG` remains the single configuration contract consumed by the existing Dashboard source.

`window.STOCK_ANALYSIS_RUNTIME` is set to `LOCAL` or `CLOUD` for diagnostics.

No Dashboard UX redesign was made.

## Rollback

Remove `runtime=local` and return to the normal Dashboard URL. Cloud remains the default.

## QA

Stage C local QA must verify the Golden 4:

- 2330
- 0050
- 0056
- 00981A

Also verify desktop/mobile layout, chart interaction, loading/error states, console errors and overflow using the existing Dashboard QA suite.
