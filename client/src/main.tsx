import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";

import { getLoginUrl } from "./const";
import "./index.css";

// ─── Sentry (deferred — load after first paint to reduce initial JS) ────────
const initSentry = () =>
  import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn: "https://453e71c19f8e1bc6d6de07f366260a32@o4511089469947904.ingest.us.sentry.io/4511089470930944",
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.2,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.5,
    });
  });

if ("requestIdleCallback" in window) {
  requestIdleCallback(() => initSentry());
} else {
  setTimeout(initSentry, 2000);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Public routes that should never auto-redirect to login
const PUBLIC_PATHS = ["/", "/login", "/signup", "/privacy", "/terms", "/tcpa", "/support"];

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;

  // Don't redirect if already on a public page
  const path = window.location.pathname;
  if (PUBLIC_PATHS.includes(path) || path === getLoginUrl()) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

/** Read the CSRF cookie set by the server (httpOnly: false so JS can read it). */
function getCsrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson as any,
      headers() {
        const csrf = getCsrfToken();
        return csrf ? { "x-csrf-token": csrf } : {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

// Core Web Vitals — lazy load to avoid blocking initial render
import("@/lib/webVitals").then((m) => m.initWebVitals()).catch(() => {});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
