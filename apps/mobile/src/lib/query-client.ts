/**
 * The app's single React Query client, as a module singleton so non-React code
 * (auth login/logout) can clear it when a different user signs in on a shared
 * device. Rendered into the tree by RootLayout via QueryClientProvider.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});
