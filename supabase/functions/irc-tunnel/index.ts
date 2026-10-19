import { createClient } from "npm:@supabase/supabase-js@2";
// IRC tunnel gateway: browser <-> WebSocket <-> raw TCP/TLS to a real IRC server.
// Protocol:
//   client -> { type: "init", host, port, nick, channel? }
//   client -> { type: "raw", line }          // IRC command, e.g. "JOIN #matrix"
//   server -> { type: "status", status, detail? }
//   server -> { type: "irc", line }          // raw line from the server

const ALLOWED_HOSTS: Record<string, number[]> = {
  "jowisz.pirc.pl": [6697, 6667],
  "irc.libera.chat": [6697, 6667],
  "irc.dal.net": [6667, 6697],
  "irc.oftc.net": [6697, 6667],
  "irc.efnet.org": [6667],
  "irc.undernet.org": [6667],
  "irc.rizon.net": [6697, 6667],
};

const TLS_PORTS = new Set([6697]);

// Only this app's own pages (published, preview, local dev) may open the gateway.
const PROJECT_ID = "1728f3ec-8dc1-4e94-a224-fbb787696422";
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  let url: URL;
  try { url = new URL(origin); } catch { return false; }
  const h = url.hostname.toLowerCase();
  if (h === "torun.lovable.app") return url.protocol === "https:";
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (url.protocol !== "https:") return false;
  return (h.endsWith(".lovable.app") || h.endsWith(".lovableproject.com")) && h.includes(PROJECT_ID);
}

// Outbound abuse protection: only interactive-client commands, one target per
// message, bounded length, and a per-connection rate limit.
const ALLOWED_COMMANDS = new Set([
  "PRIVMSG", "NOTICE", "JOIN", "PART", "NICK", "TOPIC", "MODE", "KICK", "INVITE",
  "AWAY", "NAMES", "LIST", "WHOIS", "WHO", "WHOWAS", "QUIT", "PONG", "PING",
  "ISON", "USERHOST", "MOTD", "VERSION", "TIME", "CAP",
]);
const SINGLE_TARGET = new Set(["PRIVMSG", "NOTICE", "KICK", "INVITE"]);
const MAX_LINE = 450;
const MAX_JOIN_TARGETS = 5;

function validateRawLine(raw: string): string | null {
  const line = raw.replace(/[\r\n\0]/g, "").trim();
  if (!line || line.length > MAX_LINE) return null;
  const [cmdRaw, target = ""] = line.split(" ", 2);
  const cmd = cmdRaw.toUpperCase();
  if (!ALLOWED_COMMANDS.has(cmd)) return null;
  if (SINGLE_TARGET.has(cmd) && (!target || target.includes(","))) return null;
  if ((cmd === "JOIN" || cmd === "PART") && target.split(",").length > MAX_JOIN_TARGETS) return null;
  return cmd + line.slice(cmdRaw.length);
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("IRC tunnel gateway — connect via WebSocket", { status: 200, headers: cors });
  }

  if (!isAllowedOrigin(req.headers.get("origin"))) {
    return new Response("Forbidden origin", { status: 403, headers: cors });
  }

  // Browsers cannot set headers on WebSocket, so the access token comes via query.
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return new Response("Unauthorized", { status: 401, headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: claims, error: authErr } = await sb.auth.getClaims(token);
  if (authErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401, headers: cors });

  const { socket: ws, response } = Deno.upgradeWebSocket(req);
  let conn: Deno.TcpConn | Deno.TlsConn | null = null;
  let closed = false;
  // token bucket: burst 5, refill 1 line/second
  let tokens = 5;
  let lastRefill = Date.now();
  const takeToken = () => {
    const now = Date.now();
    tokens = Math.min(5, tokens + (now - lastRefill) / 1000);
    lastRefill = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };

  const send = (obj: unknown) => {
    try { ws.send(JSON.stringify(obj)); } catch { /* socket gone */ }
  };

  const cleanup = () => {
    if (closed) return;
    closed = true;
    try { conn?.close(); } catch { /* already closed */ }
    try { ws.close(); } catch { /* already closed */ }
  };

  const writeIrc = async (line: string) => {
    if (!conn) return;
    const data = new TextEncoder().encode(line.replace(/[\r\n]/g, "") + "\r\n");
    await conn.write(data);
  };

  ws.onmessage = async (ev) => {
    let msg: { type?: string; host?: string; port?: number; nick?: string; channel?: string; line?: string };
    try { msg = JSON.parse(String(ev.data)); } catch { return; }

    if (msg.type === "raw" && msg.line && conn) {
      const line = validateRawLine(String(msg.line));
      if (!line) {
        send({ type: "status", status: "rejected", detail: "command not allowed by gateway" });
        return;
      }
      if (!takeToken()) {
        send({ type: "status", status: "rejected", detail: "rate limit: slow down" });
        return;
      }
      try { await writeIrc(line); } catch { cleanup(); }
      return;
    }

    if (msg.type !== "init" || conn) return;

    const host = String(msg.host ?? "").toLowerCase();
    const port = Number(msg.port);
    const nick = String(msg.nick ?? "matrix_user").replace(/[^a-zA-Z0-9_\-\[\]]/g, "").slice(0, 16) || "matrix_user";

    if (!ALLOWED_HOSTS[host]?.includes(port)) {
      send({ type: "status", status: "error", detail: "host/port not allowed by gateway" });
      cleanup();
      return;
    }

    try {
      send({ type: "status", status: "dialing", detail: `${host}:${port}` });
      conn = TLS_PORTS.has(port)
        ? await Deno.connectTls({ hostname: host, port })
        : await Deno.connect({ hostname: host, port });
      send({ type: "status", status: "linked", detail: TLS_PORTS.has(port) ? "TLS established" : "TCP established" });

      await writeIrc(`NICK ${nick}`);
      await writeIrc(`USER ${nick} 0 * :${nick} (matrix terminal)`);

      // pump server -> websocket
      const decoder = new TextDecoder();
      let buf = "";
      while (!closed) {
        const chunk = new Uint8Array(4096);
        const n = await conn.read(chunk);
        if (n === null) break;
        buf += decoder.decode(chunk.subarray(0, n), { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).replace(/\r$/, "");
          buf = buf.slice(idx + 1);
          if (!line) continue;
          // auto-reply to server PING so the connection stays alive
          if (line.startsWith("PING")) {
            await writeIrc("PONG " + line.slice(5).trim());
          }
          send({ type: "irc", line });
        }
      }
    } catch (err) {
      send({ type: "status", status: "error", detail: String(err) });
    }
    cleanup();
  };

  ws.onclose = cleanup;
  ws.onerror = cleanup;

  return response;
});
