import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CheckCircle, ExternalLink, RefreshCw, Workflow, XCircle } from "lucide-react";

export function N8nSettings() {
  const {
    data: status,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.n8n.status.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: false,
  });

  const isConnected = status?.enabled && status?.healthy;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Workflow className="w-4 h-4 text-primary" />
          n8n Automation Engine
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="w-4 h-4 rounded-full bg-muted animate-pulse" />
            ) : isConnected ? (
              <CheckCircle className="w-4 h-4 text-success" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive" />
            )}
            <div>
              <p className="text-sm font-medium">
                {isLoading ? "Checking…" : isConnected ? "Connected & healthy" : status?.enabled ? "Enabled but unreachable" : "Disabled (built-in engine active)"}
              </p>
              {status?.baseUrl && (
                <p className="text-xs text-muted-foreground font-mono">{status.baseUrl}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={isConnected ? "default" : "secondary"}
              className={isConnected ? "bg-success/10 text-success border-success/20" : ""}
            >
              {isConnected ? "Active" : status?.enabled ? "Offline" : "Off"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Info */}
        <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground space-y-1">
          <p>
            When n8n is <strong className="text-foreground">connected</strong>, all 21 automation workflows run through the visual n8n engine. SMS delivery always goes through Rebooked's TCPA compliance layer — n8n never sends messages directly.
          </p>
          <p>
            When n8n is <strong className="text-foreground">offline</strong>, automations fall back to the built-in engine automatically — zero message loss.
          </p>
        </div>

        {/* Environment variable instructions */}
        <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Environment Variables</p>
          <div className="space-y-1.5 font-mono text-xs">
            {[
              { key: "N8N_ENABLED", value: "true" },
              { key: "N8N_BASE_URL", value: "http://localhost:5678" },
              { key: "N8N_API_KEY", value: "<shared secret for callbacks>" },
            ].map(({ key, value }) => (
              <div key={key} className="flex gap-3">
                <span className="text-primary font-medium w-40 flex-shrink-0">{key}</span>
                <span className="text-muted-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Links */}
        <div className="flex gap-2 pt-1">
          {status?.baseUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={status.baseUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Open n8n
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href="/admin/n8n">
              <Workflow className="w-3.5 h-3.5 mr-1.5" />
              View All Workflows
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
