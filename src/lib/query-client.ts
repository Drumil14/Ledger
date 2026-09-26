import { QueryClient } from '@tanstack/react-query';

/** Single app-wide query client. Conservative defaults for a mobile client. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
