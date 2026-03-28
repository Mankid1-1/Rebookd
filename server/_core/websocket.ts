import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import crypto from "crypto";

type WsEventType = "new_lead" | "new_message" | "automation_fired" | "payment_received" | "connected";

interface WsEvent {
  type: WsEventType | string;
  data: unknown;
}

// Simple WebSocket frame helpers for native implementation
// Uses the HTTP upgrade mechanism directly

interface WsConnection {
  socket: Duplex;
  tenantId: number;
  alive: boolean;
}

const connections = new Map<number, Set<WsConnection>>();

function getTenantConnections(tenantId: number): Set<WsConnection> {
  let set = connections.get(tenantId);
  if (!set) {
    set = new Set();
    connections.set(tenantId, set);
  }
  return set;
}

function sendFrame(socket: Duplex, data: string) {
  const payload = Buffer.from(data, "utf8");
  const length = payload.length;

  let header: Buffer;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  socket.write(Buffer.concat([header, payload]));
}

/**
 * Broadcast an event to all WebSocket connections for a given tenant.
 */
export function broadcast(tenantId: number, event: WsEvent) {
  const set = connections.get(tenantId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(event);
  for (const conn of set) {
    try {
      sendFrame(conn.socket, payload);
    } catch {
      set.delete(conn);
    }
  }
}

/**
 * Verify a simple HMAC token: tenantId.timestamp.hmac
 * Token format: `${tenantId}.${timestamp}.${hmac(tenantId+timestamp, secret)}`
 */
function verifyToken(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [tenantIdStr, timestampStr, hmacValue] = parts;
  const tenantId = parseInt(tenantIdStr, 10);
  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(tenantId) || isNaN(timestamp)) return null;

  // Token expires after 24 hours
  if (Date.now() - timestamp > 24 * 60 * 60 * 1000) return null;

  const secret = process.env.SESSION_SECRET || "dev-secret";
  const expected = crypto.createHmac("sha256", secret).update(`${tenantId}.${timestamp}`).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(hmacValue), Buffer.from(expected))) return null;

  return tenantId;
}

/**
 * Generate a WebSocket auth token for a tenant.
 */
export function generateWsToken(tenantId: number): string {
  const timestamp = Date.now();
  const secret = process.env.SESSION_SECRET || "dev-secret";
  const hmac = crypto.createHmac("sha256", secret).update(`${tenantId}.${timestamp}`).digest("hex");
  return `${tenantId}.${timestamp}.${hmac}`;
}

/**
 * Set up WebSocket handling on an HTTP server using the native upgrade mechanism.
 */
export function setupWebSocket(server: HttpServer) {
  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get("token");
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const tenantId = verifyToken(token);
    if (tenantId === null) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    // Perform WebSocket handshake
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash("sha1")
      .update(key + "258EAFA5-E914-47DA-95CA-5AB5A0085CC1")
      .digest("base64");

    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
      "\r\n"
    );

    const conn: WsConnection = { socket, tenantId, alive: true };
    const set = getTenantConnections(tenantId);
    set.add(conn);

    // Send welcome
    sendFrame(socket, JSON.stringify({ type: "connected", data: { tenantId } }));

    socket.on("close", () => {
      set.delete(conn);
      if (set.size === 0) connections.delete(tenantId);
    });

    socket.on("error", () => {
      set.delete(conn);
      socket.destroy();
    });

    // Handle incoming frames (just for pong/close, we don't expect client messages)
    socket.on("data", (data: Buffer) => {
      if (data.length < 2) return;
      const opcode = data[0] & 0x0f;
      if (opcode === 0x08) {
        // Close frame
        set.delete(conn);
        socket.destroy();
      } else if (opcode === 0x09) {
        // Ping -> send pong
        const pong = Buffer.alloc(2);
        pong[0] = 0x8a; // FIN + pong
        pong[1] = 0;
        socket.write(pong);
      }
    });
  });

  // Heartbeat to clean dead connections
  const interval = setInterval(() => {
    for (const [tenantId, set] of connections) {
      for (const conn of set) {
        if (conn.socket.destroyed) {
          set.delete(conn);
        }
      }
      if (set.size === 0) connections.delete(tenantId);
    }
  }, 30_000);

  // Clean up on server close
  server.on("close", () => clearInterval(interval));
}
