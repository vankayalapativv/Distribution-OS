"use client";

import type { Customer } from "./customers-api";

/**
 * In-memory hand-off of the clicked customer from the list to the detail page.
 * The list already holds each row's full customer, so seeding this on row click
 * lets the detail header render instantly (no shimmer) while the fresh fetch
 * revalidates in the background. Survives client-side navigation; a direct URL
 * load / refresh misses it and falls back to the normal fetch + skeleton.
 */
const cache = new Map<string, Customer>();

export function cacheCustomer(customer: Customer): void {
  if (customer?.id) cache.set(customer.id, customer);
}

export function getCachedCustomer(id: string): Customer | undefined {
  return cache.get(id);
}
