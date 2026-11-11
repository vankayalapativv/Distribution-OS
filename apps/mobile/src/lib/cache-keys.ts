/**
 * The single registry of read-cache keys. A screen's query and the on-sync bulk
 * prefetch MUST use the same key here, or you get the classic "works only if the
 * record was opened online once" bug (the screen reads a key nothing prefetched).
 */
export const cacheKeys = {
  // Lists / self-scoped payloads (bulk-prefetchable).
  customersList: "customers:list",
  notifications: "notifications",
  duesSummary: "dues:summary",
  duesBucket: (bucket: string) => `dues:bucket:${bucket}`,
  performance: "performance",
  beatToday: "beat:today",
  profile: "profile",
  deliverableInvoices: "deliverable-invoices",
  orderOils: "order:oils",
  leaderboard: "leaderboard",
  segmentSales: "segment-sales",

  // Per-customer reads. Ledger + recent orders have bulk prefetch endpoints;
  // header/credit/collections/notes/photos are per-id only today, so they cache
  // on first open (prefetch coverage noted in sync-core-prefetch).
  customerHeader: (id: string) => `customer:header:${id}`,
  customerCredit: (id: string) => `customer:credit:${id}`,
  customerOrders: (id: string) => `customer:orders:${id}`,
  customerCollections: (id: string) => `customer:collections:${id}`,
  ledger: (id: string) => `ledger:${id}`,
  notes: (id: string) => `notes:${id}`,
  photos: (id: string) => `photos:${id}`,
} as const;
