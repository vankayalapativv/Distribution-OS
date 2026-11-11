/**
 * Storage-class policy for the shared PHOTOS bucket.
 *
 * Everything we put there — SE/customer field photos, market-intelligence
 * images, collection/sales-return receipts, delivery photos, invoice PDFs and
 * task attachments — uses R2's **Standard** class.
 *
 * We tried Infrequent Access ("cold") for cheaper per-GB storage, but at this
 * scale it BACKFIRED: the whole bucket is well under R2's free tier (10 GB
 * storage, 1M Class A + 10M Class B operations per month), so on Standard it
 * costs $0. Infrequent Access, by contrast, has NO free operation tier and
 * charges ~2× per op plus a per-retrieval fee — so IA turned free operations
 * into a ~$9-10/month bill (Aug 2026) for data that Standard stores for nothing.
 * IA only wins for large (>10 GB), genuinely rarely-read archives.
 *
 * Pass this on EVERY `bucket.put(...)`. Only affects objects written after this
 * ships — a one-time migration rewrites existing IA objects back to Standard.
 */
export const R2_STORAGE_CLASS = "Standard";
