---
name: migration-0007-drop-invoice-pdf-url
description: "On-demand invoice PDFs: API deployed + migration 0007 (drop invoices.invoice_pdf_url) APPLIED to prod 2026-11-02. Orphaned R2 blobs still need sweeping."
metadata:
  node_type: memory
  type: project
  originSessionId: f581a72f-751b-43f0-85a8-5d31e1f7a2aa
  modified: 2026-11-02T08:36:39.726Z
---

Invoice PDFs are now rendered **on demand** from data (shared renderer in `packages/shared/src/invoice-pdf.ts`, runs in the browser AND on Cloudflare Workers; canvas-free vector QR). This replaced storing a PDF copy in R2. See [[invoicing-stock-phase1]].

`packages/db/migrations/0007_drop_invoice_pdf_url.sql` drops `invoices.invoice_pdf_url` (now unreferenced in code).

**DONE 2026-11-02 — in the correct order:** the invoicing work was committed and merged to `main` (fast-forward), then the on-demand-rendering API was **deployed** to Cloudflare Workers (`sri-aparajita-api`, version `1854c897`), then migration `0007` was **applied to prod** (runner reports 7 applied / 0 pending). The column is gone. The deploy-order risk (old API read `invoice_pdf_url` in `getInvoiceFile`; dropping first would have broken the mobile `GET /invoice-files/:id` WhatsApp-share download) no longer applies.

R2 sweep DONE 2026-11-02 — nothing to delete. The old upload/generate code keyed invoice PDFs at `invoices/<uuid>.pdf` in the `sri-aparajita-photos` bucket; a sweep (throwaway `wrangler dev --remote` worker against the real bucket via the PHOTOS binding) found **0 objects** under `invoices/` — the bucket's only top-level prefixes are `collections/`, `customers/`, `system/`. The blobs were already gone (cleaned with the test data; on-demand rendering writes none). No orphaned invoice blobs remain.

Tip for future R2 cleanups: there are no R2 S3 creds in root `.env` and `wrangler r2 object` has no list — use a scratchpad `wrangler dev --remote` worker bound to the bucket to list/delete via `env.PHOTOS.list/delete`.
