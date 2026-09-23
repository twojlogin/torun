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

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("IRC tunnel gateway — connect via WebSocket", { status: 200, headers: cors });
  }

  const { socket: ws, response } = Deno.upgradeWebSocket(req);
  let conn: Deno.TcpConn | Deno.TlsConn | null = null;
  let closed = false;

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
      try { await writeIrc(msg.line); } catch { cleanup(); }
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
