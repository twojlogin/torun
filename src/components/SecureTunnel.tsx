import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TunnelLog {
  text: string;
  type: 'info' | 'ok' | 'warn' | 'err' | 'msg';
}

interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  network: string;
  ping: number;
}

const SERVERS: Server[] = [
  { id: 'libera', name: 'Libera.Chat', host: 'irc.libera.chat', port: 6697, network: 'IRC', ping: 42 },
  { id: 'oftc', name: 'OFTC', host: 'irc.oftc.net', port: 6697, network: 'IRC', ping: 58 },
  { id: 'efnet', name: 'EFnet', host: 'irc.efnet.org', port: 6667, network: 'IRC', ping: 73 },
  { id: 'undernet', name: 'Undernet', host: 'irc.undernet.org', port: 6667, network: 'IRC', ping: 91 },
  { id: 'rizon', name: 'Rizon', host: 'irc.rizon.net', port: 6697, network: 'IRC', ping: 110 },
  { id: 'zion', name: 'Zion Mainframe', host: 'zion.matrix.sys', port: 1999, network: 'HIDDEN', ping: 7 },
  { id: 'nebuchadnezzar', name: 'Nebuchadnezzar', host: 'neb.hovercraft.zion', port: 2317, network: 'HIDDEN', ping: 12 },
];

const HOPS = [
  'entry-node.tor.exit',
  'relay-fra.de',
  'relay-ams.nl',
  'relay-tok.jp',
  'relay-sao.br',
  'exit-node.zion',
];

const CHATTER = [
  '<morpheus> the signal is clean',
  '<trinity> route confirmed',
  '<oracle> cookies are ready',
  '<tank> operator standing by',
  '<cypher> why oh why didnt I take the blue pill',
  '*** dozer has joined #zion',
  '<neo> whoa.',
  '<smith> Mr. Anderson...',
  '*** ping from unknown host — dropped',
];

const SecureTunnel = () => {
  const [selected, setSelected] = useState<Server>(SERVERS[0]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [logs, setLogs] = useState<TunnelLog[]>([]);
  const [encStrength, setEncStrength] = useState(0);
  const [nick] = useState(() => `neo_${Math.floor(Math.random() * 9999)}`);
  const logRef = useRef<HTMLDivElement>(null);

  const push = (text: string, type: TunnelLog['type'] = 'info') => {
    setLogs((p) => [...p.slice(-80), { text, type }]);
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const connect = async () => {
    if (status !== 'idle') return;
    setLogs([]);
    setStatus('connecting');
    setEncStrength(0);

    push(`> initializing secure tunnel to ${selected.host}:${selected.port}`, 'info');
    await wait(300);
    push('> generating ephemeral keypair (x25519)...', 'info');
    await wait(400);
    push(`  fingerprint: ${randHex(32)}`, 'ok');
    await wait(200);

    for (let i = 0; i < HOPS.length; i++) {
      push(`> hop ${i + 1}/${HOPS.length}  →  ${HOPS[i]}`, 'info');
      await wait(250 + Math.random() * 300);
      push(`  handshake ok  (${(20 + Math.random() * 80).toFixed(0)} ms)`, 'ok');
      setEncStrength(Math.round(((i + 1) / HOPS.length) * 100));
    }

    push('> negotiating cipher: CHACHA20-POLY1305@openssh.com', 'info');
    await wait(300);
    push('  MAC: hmac-sha2-512-etm', 'ok');
    await wait(200);
    push(`> tunnel established — latency ${selected.ping} ms`, 'ok');
    await wait(200);
    push(`> joining ${selected.network} as ${nick}`, 'info');
    await wait(300);
    push(`*** connected to ${selected.name}`, 'ok');
    setStatus('connected');
  };

  const disconnect = () => {
    push('> tearing down tunnel...', 'warn');
    push('*** disconnected — you are back in the desert of the real', 'warn');
    setStatus('idle');
    setEncStrength(0);
  };

  // simulated chatter while connected
  useEffect(() => {
    if (status !== 'connected') return;
    const t = setInterval(() => {
      push(CHATTER[Math.floor(Math.random() * CHATTER.length)], 'msg');
    }, 2500 + Math.random() * 3000);
    return () => clearInterval(t);
  }, [status]);

  return (
    <Card className="w-full max-w-4xl mx-auto bg-black/80 backdrop-blur-sm border-primary/30 p-0 overflow-hidden">
      <div className="bg-primary/20 px-4 py-2 flex items-center justify-between">
        <span className="text-primary font-mono text-sm matrix-glow">
          ▓ SECURE TUNNEL v2.4 — onion-routed
        </span>
        <span className={`font-mono text-xs ${status === 'connected' ? 'text-primary' : status === 'connecting' ? 'text-yellow-400' : 'text-muted-foreground'}`}>
          {status === 'connected' ? `● LIVE  ${encStrength}% enc` : status === 'connecting' ? '● NEGOTIATING' : '○ OFFLINE'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
        <div className="md:col-span-1 border-r border-primary/20 p-3 space-y-2">
          <div className="text-xs text-muted-foreground font-mono mb-2">SERVERS</div>
          {SERVERS.map((s) => (
            <button
              key={s.id}
              onClick={() => status === 'idle' && setSelected(s)}
              disabled={status !== 'idle'}
              className={`w-full text-left font-mono text-xs px-2 py-2 rounded border transition-colors ${
                selected.id === s.id
                  ? 'border-primary bg-primary/10 text-primary matrix-glow'
                  : 'border-primary/20 text-muted-foreground hover:border-primary/50'
              } ${status !== 'idle' ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="flex justify-between">
                <span>{s.name}</span>
                <span>{s.ping}ms</span>
              </div>
              <div className="opacity-60">{s.host}:{s.port} · {s.network}</div>
            </button>
          ))}

          <div className="pt-2 flex gap-2">
            {status === 'connected' ? (
              <Button
                onClick={disconnect}
                variant="outline"
                className="w-full border-red-500 text-red-400 hover:bg-red-500/20 font-mono"
              >
                DISCONNECT
              </Button>
            ) : (
              <Button
                onClick={connect}
                disabled={status === 'connecting'}
                variant="outline"
                className="w-full border-primary text-primary hover:bg-primary/20 font-mono"
              >
                {status === 'connecting' ? 'CONNECTING...' : 'OPEN TUNNEL'}
              </Button>
            )}
          </div>

          <div className="pt-2 text-[10px] font-mono text-muted-foreground leading-relaxed">
            nick: <span className="text-primary">{nick}</span><br />
            cipher: chacha20-poly1305<br />
            hops: {HOPS.length}
          </div>
        </div>

        <div
          ref={logRef}
          className="md:col-span-2 h-80 overflow-y-auto p-3 font-mono text-xs bg-black/60"
        >
          {logs.length === 0 && (
            <div className="text-muted-foreground">
              // idle. select a server and open the tunnel.<br />
              // traffic is routed through {HOPS.length} encrypted hops before touching the target.<br />
              // hidden networks require the red pill.
            </div>
          )}
          {logs.map((l, i) => (
            <div
              key={i}
              className={
                l.type === 'ok'
                  ? 'text-primary'
                  : l.type === 'warn'
                  ? 'text-yellow-400'
                  : l.type === 'err'
                  ? 'text-red-400'
                  : l.type === 'msg'
                  ? 'text-green-300'
                  : 'text-muted-foreground'
              }
            >
              {l.text}
            </div>
          ))}
          {status === 'connected' && (
            <div className="text-primary animate-pulse">_</div>
          )}
        </div>
      </div>
    </Card>
  );
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randHex = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');

export default SecureTunnel;
