/**
 * Offline sync core (pure logic — no React Native imports).
 *
 * GPS ping buffering + flush (live tracking survives dead zones), the tracking
 * heartbeat, the local delivery-run mirror, AND — restored for Beyond parity —
 * the generic write-queue engine: every offline field write lands in SQLite
 * plus a `sync_queue` row, flushed FIFO (a retryable failure stops the pass to
 * preserve causal order; a permanent 4xx parks the item for manual retry).
 * The per-entity enqueue/send handlers (orders/collections/visits) wire in per
 * feature in Phase 2; this phase ships the engine itself.
 *
 * This module is a barrel: the pieces live in sibling sync-core-* files,
 * re-exported here so `./sync-core` stays the single import path.
 */
export * from "./sync-core-types";
export * from "./sync-core-queue";
export * from "./sync-core-apply-result";
export * from "./sync-core-flush";
export * from "./sync-core-delivery-start";
export * from "./sync-core-delivery-stop";
export * from "./sync-core-delivery-end";
export * from "./sync-core-delivery-reads";
export * from "./sync-core-gps";
export * from "./sync-core-gps-flush";
export * from "./sync-core-heartbeat";
