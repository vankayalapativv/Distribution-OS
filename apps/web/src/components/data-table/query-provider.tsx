"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ComponentType } from "react";
import { ApiRequestError, isNonRetryableStatus } from "@/lib/api-client";

const makeClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Don't retry errors a retry can't fix — a 402 billing block, or a
        // 401/403/404/422 — which otherwise storm the gated API (and the
        // console) three times each while the billing overlay is up. Retry only
        // transient failures (5xx / network), and just once.
        retry: (failureCount, error) => {
          if (error instanceof ApiRequestError && isNonRetryableStatus(error.status)) return false;
          return failureCount < 1;
        },
      },
    },
  });

/**
 * Wraps a feature's inner component in its own scoped TanStack Query client.
 * Replaces the copy-pasted `const [qc] = useState(() => new QueryClient(...))`
 * + `<QueryClientProvider>` boilerplate in every list/table feature.
 *
 *   export const CustomersList = withQueryClient(CustomersInner);
 */
export function withQueryClient<P extends object>(Inner: ComponentType<P>) {
  function WithQueryClient(props: P) {
    const [client] = useState(makeClient);
    return (
      <QueryClientProvider client={client}>
        <Inner {...props} />
      </QueryClientProvider>
    );
  }
  WithQueryClient.displayName = `withQueryClient(${Inner.displayName ?? Inner.name ?? "Component"})`;
  return WithQueryClient;
}
