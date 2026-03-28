import { useEffect, useRef, useState, useCallback } from "react";

interface WsEvent {
  type: string;
  data: unknown;
}

interface UseWebSocketOptions {
  tenantId: number | undefined;
  token: string | undefined;
  enabled?: boolean;
}

export function useWebSocket({ tenantId, token, enabled = true }: UseWebSocketOptions) {
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!tenantId || !token || !enabled) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        retriesRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as WsEvent;
          setLastEvent(parsed);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30_000);
        retriesRef.current++;
        timerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Connection failed, will retry via onclose
    }
  }, [tenantId, token, enabled]);

  useEffect(() => {
    connect();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { lastEvent, isConnected };
}
