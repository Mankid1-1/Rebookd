/**
 * Global RebookedAI chat widget — shows on every page when authenticated.
 * Renders the floating button (bottom-right) + Sheet panel.
 * Only mounts when user is logged in (avoids tRPC errors on public pages).
 */
import { trpc } from "@/lib/trpc";
import { RebookedAIChat } from "./RebookedAIChat";

export function GlobalAIChat() {
  // Quick auth check — if auth.me fails, don't render the chat
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Don't render on public pages, while loading, or during onboarding (no tenant yet)
  if (isLoading || !user || !user.tenantId) return null;

  return <RebookedAIChat />;
}
