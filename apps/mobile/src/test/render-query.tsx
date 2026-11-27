/**
 * Shared render helper for components that use react-query. Wraps the tree in a
 * fresh QueryClient (retries off, no cache carry-over) so each test is isolated,
 * and re-exports everything from @testing-library/react for convenience.
 */
import type { ReactElement, ReactNode } from "react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** Render `ui` inside a throwaway QueryClientProvider. */
export function renderWithQuery(ui: ReactElement, client: QueryClient = makeQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { client, ...render(ui, { wrapper }) };
}

export * from "@testing-library/react";
