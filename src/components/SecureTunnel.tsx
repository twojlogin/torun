import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, LogOut, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TunnelLog = { text: string; type: 'info' | 'ok' | 'warn' | 'err' | 'msg'; nick?: string };
type Theme = 'matrix' | 'mono' | 'pirc';
type Status = 'idle' | 'connecting' | 'connected';

interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  network: 'IRC' | 'HIDDEN';
  ping: number;
}

const SERVERS: Server[] = [
  { id: 'pirc', name: 'PIRC · Jowisz', host: 'jowisz.pirc.pl', port: 6697, network: 'IRC', ping: 24 },
  { id: 'oftc', name: 'OFTC', host: 'irc.oftc.net', port: 6697, network: 'IRC', ping: 58 },
  { id: 'efnet', name: 'EFnet', host: 'irc.efnet.org', port: 6667, network: 'IRC', ping: 73 },
  { id: 'undernet', name: 'Undernet', host: 'irc.undernet.org', port: 6667, network: 'IRC', ping: 91 },
  { id: 'rizon', name: 'Rizon', host: 'irc.rizon.net', port: 6697, network: 'IRC', ping: 110 },
  { id: 'zion', name: 'Zion Mainframe', host: 'zion.matrix.sys', port: 1999, network: 'HIDDEN', ping: 7 },
  { id: 'nebuchadnezzar', name: 'Nebuchadnezzar', host: 'neb.hovercraft.zion', port: 2317, network: 'HIDDEN', ping: 12 },
];

const HOPS = ['entry-node.tor.exit', 'relay-fra.de', 'relay-ams.nl', 'relay-tok.jp', 'relay-sao.br', 'exit-node.zion'];
const CHATTER = ['<morpheus> the signal is clean', '<trinity> route confirmed', '<oracle> cookies are ready', '*** dozer has joined #zion', '<neo> whoa.', '<smith> Mr. Anderson...'];
const THEMES: { id: Theme; label: string }[] = [{ id: 'matrix', label: 'MATRIX' }, { id: 'mono', label: 'MONO' }, { id: 'pirc', label: 'PIRC' }];

const prefixNick = (prefix: string) => prefix.split('!')[0].replace(/^:/, '');
const stripRank = (name: string) => name.replace(/^[@+%&~]/, '');
const rank = (name: string) => name.startsWith('@') ? 0 : name.startsWith('+') ? 1 : 2;

const SecureTunnel = () => {
  const [selected, setSelected] = useState<Server>(SERVERS[0]);
  const [status, setStatus] = useState<Status>('idle');
  const [logs, setLogs] = useState<TunnelLog[]>([]);
  const [encStrength, setEncStrength] = useState(0);
  const [nick, setNick] = useState(() => `neo_${Math.floor(Math.random() * 9999)}`);
  const [channel, setChannel] = useState('');
  const [nicks, setNicks] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [showNicks, setShowNicks] = useState(true);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('matrix-theme') as Theme) || 'matrix');
  const logRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const realRef = useRef(false);
  const nickRef = useRef(nick);

  const isReal = selected.network === 'IRC';
  const sortedNicks = useMemo(() => [...nicks].sort((a, b) => rank(a) - rank(b) || stripRank(a).localeCompare(stripRank(b))), [nicks]);
  const push = (text: string, type: TunnelLog['type'] = 'info', messageNick?: string) => setLogs((previous) => [...previous.slice(-160), { text, type, nick: messageNick }]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('matrix-theme', theme);
  }, [theme]);

  useEffect(() => { nickRef.current = nick; }, [nick]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);
  useEffect(() => () => wsRef.current?.close(), []);

  const sendRaw = (line: string, echo = true) => {
    if (!wsRef.current || !realRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'raw', line }));
    if (echo) push(`› ${line}`, 'info');
  };

  const parseIrc = (line: string) => {
    const match = line.match(/^:([^ ]+) ([A-Z0-9]+) ?(.*)$/);
    if (!match) { push(line, 'msg'); return; }
    const [, prefix, command, rest] = match;
    const source = prefixNick(prefix);
    const trailingIndex = rest.indexOf(' :');
    const params = (trailingIndex >= 0 ? rest.slice(0, trailingIndex) : rest).split(' ').filter(Boolean);
    const trailing = trailingIndex >= 0 ? rest.slice(trailingIndex + 2) : '';

    if (command === '353') {
      const names = trailing.split(' ').filter(Boolean);
      setNicks((previous) => Array.from(new Set([...previous, ...names])));
      return;
    }
    if (command === '366') return;
    if (command === 'JOIN') {
      const joined = (trailing || params[0] || '').replace(/^:/, '');
      if (source === nickRef.current) { setChannel(joined); setNicks([]); sendRaw(`NAMES ${joined}`, false); }
      setNicks((previous) => previous.some((entry) => stripRank(entry) === source) ? previous : [...previous, source]);
      push(`→ ${source} dołącza do ${joined}`, 'ok');
      return;
    }
    if (command === 'PART' || command === 'QUIT') {
      setNicks((previous) => previous.filter((entry) => stripRank(entry) !== source));
      push(`← ${source} opuszcza kanał${trailing ? ` · ${trailing}` : ''}`, 'warn');
      return;
    }
    if (command === 'NICK') {
      const nextNick = (trailing || params[0]).replace(/^:/, '');
      setNicks((previous) => previous.map((entry) => stripRank(entry) === source ? `${entry.match(/^[@+%&~]/)?.[0] || ''}${nextNick}` : entry));
      if (source === nickRef.current) setNick(nextNick);
      push(`◆ ${source} zmienia nick na ${nextNick}`, 'info');
      return;
    }
    if (command === 'PRIVMSG') {
      const actionMarker = String.fromCharCode(1);
      const action = trailing.startsWith(`${actionMarker}ACTION `) && trailing.endsWith(actionMarker)
        ? trailing.slice(8, -1)
        : null;
      push(action ? `* ${source} ${action}` : trailing, 'msg', action ? undefined : source);
      return;
    }
    if (/^\d{3}$/.test(command)) push(trailing || rest, command[0] === '4' ? 'err' : 'info');
  };

  const connectReal = () => {
    push('> otwieram bezpieczną bramkę WebSocket...', 'info');
    const wsUrl = `${import.meta.env.VITE_SUPABASE_URL.replace(/^http/, 'ws')}/functions/v1/irc-tunnel`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    realRef.current = true;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'init', host: selected.host, port: selected.port, nick }));
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.type === 'status') {
          if (message.status === 'error') { push(`*** ${message.detail}`, 'err'); setStatus('idle'); setEncStrength(0); return; }
          push(`> ${message.status}: ${message.detail ?? ''}`, 'ok');
          if (message.status === 'linked') { setStatus('connected'); push('Połączono. Wpisz /join #kanał, aby wejść na kanał.', 'ok'); }
        } else if (message.type === 'irc') parseIrc(message.line);
      } catch { push('*** nieczytelna odpowiedź bramki', 'err'); }
    };
    ws.onerror = () => { push('*** bramka jest chwilowo niedostępna', 'err'); setStatus('idle'); setEncStrength(0); };
    ws.onclose = () => { wsRef.current = null; realRef.current = false; setStatus('idle'); setChannel(''); setNicks([]); setEncStrength(0); };
  };

  const connect = async () => {
    if (status !== 'idle') return;
    setLogs([]); setNicks([]); setChannel(''); setStatus('connecting'); setEncStrength(0);
    push(`> tunel do ${selected.host}:${selected.port}`, 'info');
    await wait(180);
    push(`> klucz x25519: ${randHex(20)}`, 'ok');
    for (let i = 0; i < HOPS.length; i += 1) {
      push(`> węzeł ${i + 1}/${HOPS.length} → ${HOPS[i]}`, 'info');
      await wait(isReal ? 45 : 180 + Math.random() * 180);
      setEncStrength(Math.round(((i + 1) / HOPS.length) * 100));
    }
    if (isReal) connectReal();
    else { push(`*** połączono z ${selected.name}`, 'ok'); setStatus('connected'); }
  };

  const disconnect = () => {
    if (realRef.current) sendRaw('QUIT :back to the desert of the real', false);
    wsRef.current?.close(); wsRef.current = null; realRef.current = false;
    push('*** rozłączono', 'warn'); setStatus('idle'); setChannel(''); setNicks([]); setEncStrength(0);
  };

  const handleCommand = (value: string) => {
    const [command, ...parts] = value.slice(1).split(' ');
    const argument = parts.join(' ').trim();
    switch (command.toLowerCase()) {
      case 'join': if (argument) sendRaw(`JOIN ${argument}`); else push('Użycie: /join #kanał', 'warn'); break;
      case 'part': sendRaw(`PART ${argument || channel} :do zobaczenia`); break;
      case 'nick': if (argument) sendRaw(`NICK ${argument}`); break;
      case 'me': if (channel && argument) sendRaw(`PRIVMSG ${channel} :\u0001ACTION ${argument}\u0001`); break;
      case 'msg': { const [target, ...words] = parts; if (target && words.length) sendRaw(`PRIVMSG ${target} :${words.join(' ')}`); break; }
      case 'whois': if (argument) sendRaw(`WHOIS ${argument}`); break;
      case 'quit': disconnect(); break;
      case 'raw': case 'quote': if (argument) sendRaw(argument); break;
      case 'help': push('/join #kanał · /part · /nick nowy · /me tekst · /msg nick tekst · /whois nick · /raw KOMENDA · /quit', 'ok'); break;
      default: sendRaw(value.slice(1));
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    setInput('');
    if (!realRef.current) { push(`‹ ${value}`, 'info'); push('// ten uplink jest filmową symulacją', 'warn'); return; }
    if (value.startsWith('/')) { handleCommand(value); return; }
    if (!channel) { push('Najpierw wejdź na kanał: /join #nazwa', 'warn'); return; }
    sendRaw(`PRIVMSG ${channel} :${value}`, false);
    push(value, 'msg', nick);
  };

  useEffect(() => {
    if (status !== 'connected' || realRef.current) return;
    const timer = setInterval(() => push(CHATTER[Math.floor(Math.random() * CHATTER.length)], 'msg'), 3200);
    return () => clearInterval(timer);
  }, [status]);

  return (
    <section className="irc-shell w-full max-w-6xl mx-auto border border-border overflow-hidden" aria-label="Klient IRC">
      <header className="irc-titlebar px-3 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-border">
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold text-foreground">▓ SECURE TUNNEL <span className="text-muted-foreground">/ IRC CLIENT</span></p>
          <p className="text-[11px] text-muted-foreground truncate">{selected.host}:{selected.port} {channel ? `· ${channel}` : '· bez kanału'}</p>
        </div>
        <div className="flex items-center gap-1" aria-label="Wybór szaty graficznej">
          {THEMES.map((item) => <Button key={item.id} size="sm" variant={theme === item.id ? 'default' : 'outline'} onClick={() => setTheme(item.id)} className="h-7 px-2 text-[10px] font-mono">{item.label}</Button>)}
        </div>
      </header>

      <div className="grid lg:grid-cols-[190px_minmax(0,1fr)] min-h-[500px]">
        <aside className="irc-sidebar border-b lg:border-b-0 lg:border-r border-border p-3">
          <p className="text-[10px] font-bold text-muted-foreground mb-2">SERWERY</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
            {SERVERS.map((server) => (
              <button key={server.id} onClick={() => status === 'idle' && setSelected(server)} disabled={status !== 'idle'} className={`server-row text-left px-2 py-2 border text-xs transition-colors ${selected.id === server.id ? 'is-active border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'} disabled:opacity-50`}>
                <span className="flex justify-between gap-2"><strong>{server.name}</strong><span>{server.ping}ms</span></span>
                <span className="block opacity-70 truncate">{server.host}</span>
              </button>
            ))}
          </div>
          <div className="mt-3">
            {status === 'idle' ? <Button onClick={connect} className="w-full font-mono">OPEN TUNNEL</Button> : <Button onClick={disconnect} variant="destructive" className="w-full font-mono"><LogOut className="w-4 h-4 mr-2" />ROZŁĄCZ</Button>}
          </div>
          <div className="mt-3 text-[10px] text-muted-foreground font-mono leading-5">nick: <span className="text-foreground">{nick}</span><br />szyfrowanie: {encStrength}%<br />stan: {status}</div>
        </aside>

        <div className={`grid min-w-0 ${showNicks ? 'md:grid-cols-[minmax(0,1fr)_180px]' : 'grid-cols-1'}`}>
          <div className="flex min-w-0 flex-col bg-card/70">
            <div className="h-10 px-3 flex items-center justify-between border-b border-border bg-muted/60">
              <strong className="text-sm truncate">{channel || (status === 'connected' ? 'Wybierz kanał: /join #nazwa' : 'Niepołączony')}</strong>
              <Button size="icon" variant="ghost" onClick={() => setShowNicks((value) => !value)} title={showNicks ? 'Ukryj listę nicków' : 'Pokaż listę nicków'} aria-label={showNicks ? 'Ukryj listę nicków' : 'Pokaż listę nicków'}>
                {showNicks ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <div ref={logRef} className="irc-log h-[400px] overflow-y-auto p-3 font-mono text-xs" aria-live="polite">
              {logs.length === 0 && <div className="text-muted-foreground">// wybierz serwer, otwórz tunel i wpisz /join #kanał<br />// /help pokazuje listę komend</div>}
              {logs.map((line, index) => (
                <div key={`${index}-${line.text}`} className={`irc-line py-0.5 ${line.type === 'ok' ? 'text-primary' : line.type === 'warn' ? 'text-warning' : line.type === 'err' ? 'text-destructive' : line.type === 'msg' ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {line.nick && <strong className="nick-label text-primary">&lt;{line.nick}&gt; </strong>}{line.text}
                </div>
              ))}
            </div>
            <form onSubmit={onSubmit} className="irc-input flex gap-2 p-2 border-t border-border bg-muted/40">
              <span className="text-primary pt-2 font-mono">›</span>
              <input value={input} onChange={(event) => setInput(event.target.value)} disabled={status !== 'connected'} placeholder={status === 'connected' ? (channel ? `Napisz do ${channel}…` : '/join #kanał') : 'Najpierw otwórz tunel'} className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground text-sm" aria-label="Wiadomość lub komenda IRC" />
              <Button type="submit" size="icon" disabled={status !== 'connected'} title="Wyślij" aria-label="Wyślij"><Send className="w-4 h-4" /></Button>
            </form>
          </div>

          {showNicks && <aside className="nick-panel border-t md:border-t-0 md:border-l border-border bg-muted/30 max-h-48 md:max-h-none overflow-y-auto">
            <div className="h-10 px-3 flex items-center gap-2 border-b border-border text-xs font-bold"><Users className="w-4 h-4" /> NICKI <span className="ml-auto text-muted-foreground">{nicks.length}</span></div>
            <div className="p-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-1 gap-1">
              {sortedNicks.length ? sortedNicks.map((name) => <button type="button" key={name} onClick={() => setInput(`/msg ${stripRank(name)} `)} className="nick-row text-left truncate px-2 py-1 text-xs hover:bg-primary/10 hover:text-primary">{name}</button>) : <p className="col-span-full px-2 py-3 text-xs text-muted-foreground">Lista pojawi się po wejściu na kanał.</p>}
            </div>
          </aside>}
        </div>
      </div>
    </section>
  );
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const randHex = (length: number) => Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');

export default SecureTunnel;