import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, ChevronLeft, ChevronRight, Hash, LogOut, Menu, MessageSquare, Search, Send, Settings, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
const Avatar = ({ name, size = 'h-6 w-6', mono }: { name: string; size?: string; mono?: boolean }) => { const hue = nickHue(name); return <span aria-hidden="true" className={`irc-avatar ${size}`} style={mono ? undefined : { background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 75% 30%))` }}>{name.replace(/^[^a-z0-9]+/i, '').charAt(0).toUpperCase() || '?'}</span>; };

type Theme = 'matrix' | 'mono' | 'pirc';
type Status = 'idle' | 'connecting' | 'connected' | 'reconnecting';
type LogType = 'info' | 'ok' | 'warn' | 'err' | 'msg' | 'notice' | 'action' | 'event';
type ProSettings = { nick: string; nickserv: string; autojoin: string; highlights: string; ignore: string; notify: boolean; sound: boolean; hideEvents: boolean; showMedia: boolean };
const DEFAULT_SETTINGS: ProSettings = { nick: '', nickserv: '', autojoin: '', highlights: '', ignore: '', notify: false, sound: true, hideEvents: false, showMedia: true };
const loadSettings = (): ProSettings => { try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('irc-pro-settings') || '{}') }; } catch { return DEFAULT_SETTINGS; } };
const splitList = (value: string) => value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
const nickHue = (name: string) => { let hash = 0; for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360; return hash; };
const stripFormatting = (text: string) => text.replace(/\x03\d{0,2}(,\d{1,2})?|[\x02\x0F\x16\x1D\x1F\x1E]/g, '');
const URL_RE = /(https?:\/\/[^\s<>"]+)/g;
const beep = () => { try { const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.frequency.value = 880; gain.gain.value = 0.05; osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.12); } catch { /* audio blocked */ } };
const RichText = ({ text, media }: { text: string; media: boolean }) => <>{stripFormatting(text).split(URL_RE).map((part, index) => index % 2 === 1 ? <span key={index}><a href={part} target="_blank" rel="noopener noreferrer" className="underline text-primary break-all">{part}</a>{media && /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(part) && <img src={part} alt="Podgląd obrazka" loading="lazy" className="mt-1 block max-h-48 max-w-xs border border-border" />}</span> : <span key={index}>{part}</span>)}</>;
type ChatLog = { id: number; text: string; type: LogType; nick?: string; time: string };
type BufferKind = 'server' | 'channel' | 'query';
type ChatBuffer = { id: string; label: string; kind: BufferKind; logs: ChatLog[]; nicks: string[]; topic: string; modes: string; unread: number; mention: boolean };

interface Server { id: string; name: string; host: string; port: number; network: 'IRC' | 'HIDDEN'; ping: number }

const SERVERS: Server[] = [
  { id: 'pirc', name: 'PIRC · Jowisz', host: 'jowisz.pirc.pl', port: 6697, network: 'IRC', ping: 24 },
  { id: 'oftc', name: 'OFTC', host: 'irc.oftc.net', port: 6697, network: 'IRC', ping: 58 },
  { id: 'efnet', name: 'EFnet', host: 'irc.efnet.org', port: 6667, network: 'IRC', ping: 73 },
  { id: 'undernet', name: 'Undernet', host: 'irc.undernet.org', port: 6667, network: 'IRC', ping: 91 },
  { id: 'rizon', name: 'Rizon', host: 'irc.rizon.net', port: 6697, network: 'IRC', ping: 110 },
  { id: 'zion', name: 'Zion Mainframe', host: 'zion.matrix.sys', port: 1999, network: 'HIDDEN', ping: 7 },
  { id: 'nebuchadnezzar', name: 'Nebuchadnezzar', host: 'neb.hovercraft.zion', port: 2317, network: 'HIDDEN', ping: 12 },
];
const THEMES: { id: Theme; label: string }[] = [{ id: 'matrix', label: 'MATRIX' }, { id: 'mono', label: 'MONO' }, { id: 'pirc', label: 'PIRC' }];
const COMMANDS = ['/join', '/part', '/query', '/close', '/nick', '/me', '/msg', '/notice', '/whois', '/topic', '/mode', '/kick', '/ban', '/invite', '/away', '/names', '/list', '/ignore', '/unignore', '/clear', '/search', '/ns', '/cs', '/raw', '/quote', '/help', '/quit'];
const HOPS = ['entry-node.tor.exit', 'relay-fra.de', 'relay-ams.nl', 'relay-tok.jp', 'relay-sao.br', 'exit-node.zion'];
const CHATTER = ['<morpheus> the signal is clean', '<trinity> route confirmed', '<oracle> cookies are ready', '*** dozer has joined #zion', '<neo> whoa.'];
const serverBuffer = (): ChatBuffer => ({ id: 'server', label: 'Status', kind: 'server', logs: [], nicks: [], topic: '', modes: '', unread: 0, mention: false });
const prefixNick = (prefix: string) => prefix.split('!')[0].replace(/^:/, '');
const stripRank = (name: string) => name.replace(/^[@+%&~]/, '');
const rank = (name: string) => name.startsWith('~') ? 0 : name.startsWith('&') ? 1 : name.startsWith('@') ? 2 : name.startsWith('%') ? 3 : name.startsWith('+') ? 4 : 5;
const normalizeId = (value: string) => value.toLocaleLowerCase();
const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
let logId = 0;

const SecureTunnel = () => {
  const [selected, setSelected] = useState<Server>(SERVERS[0]);
  const [status, setStatus] = useState<Status>('idle');
  const [buffers, setBuffers] = useState<ChatBuffer[]>([serverBuffer()]);
  const [activeId, setActiveId] = useState('server');
  const [encStrength, setEncStrength] = useState(0);
  const [settings, setSettings] = useState<ProSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const settingsRef = useRef(settings);
  const [nick, setNick] = useState(() => loadSettings().nick || `neo_${Math.floor(Math.random() * 9999)}`);
  const [input, setInput] = useState('');
  const [showNicks, setShowNicks] = useState(true);
  const [showChats, setShowChats] = useState(true);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('matrix-theme') as Theme) || 'matrix');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const realRef = useRef(false);
  const nickRef = useRef(nick);
  const activeRef = useRef(activeId);
  const intentionalCloseRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);

  const isReal = selected.network === 'IRC';
  const active = buffers.find((item) => item.id === activeId) ?? buffers[0];
  const sortedNicks = useMemo(() => [...(active?.nicks ?? [])].sort((a, b) => rank(a) - rank(b) || stripRank(a).localeCompare(stripRank(b))), [active?.nicks]);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('matrix-theme', theme); }, [theme]);
  useEffect(() => { settingsRef.current = settings; localStorage.setItem('irc-pro-settings', JSON.stringify(settings)); }, [settings]);
  const updateSetting = <K extends keyof ProSettings>(key: K, value: ProSettings[K]) => setSettings((previous) => ({ ...previous, [key]: value }));
  const toggleNotify = async () => {
    if (!settings.notify && 'Notification' in window && Notification.permission !== 'granted') { const result = await Notification.requestPermission(); if (result !== 'granted') return; }
    updateSetting('notify', !settings.notify);
  };
  useEffect(() => { nickRef.current = nick; }, [nick]);
  useEffect(() => { activeRef.current = activeId; }, [activeId]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [active?.logs]);
  useEffect(() => () => { intentionalCloseRef.current = true; wsRef.current?.close(); if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current); }, []);

  const ensureBuffer = (label: string, kind: BufferKind) => {
    const id = kind === 'server' ? 'server' : normalizeId(label);
    setBuffers((previous) => previous.some((item) => item.id === id) ? previous : [...previous, { id, label, kind, logs: [], nicks: [], topic: '', modes: '', unread: 0, mention: false }]);
    return id;
  };

  const push = (target: string, text: string, type: LogType = 'info', messageNick?: string) => {
    const id = normalizeId(target || 'server');
    const lower = text.toLocaleLowerCase();
    const fromOther = messageNick && messageNick !== nickRef.current;
    const mention = Boolean(fromOther) && (type === 'msg' || type === 'action') && [nickRef.current, ...splitList(settingsRef.current.highlights)].some((word) => lower.includes(word.toLocaleLowerCase()));
    const isQuery = Boolean(fromOther) && !target.startsWith('#') && id !== 'server';
    if ((mention || isQuery) && (document.hidden || activeRef.current !== id)) {
      if (settingsRef.current.sound) beep();
      if (settingsRef.current.notify && 'Notification' in window && Notification.permission === 'granted') new Notification(`${messageNick} · ${target}`, { body: stripFormatting(text).slice(0, 140) });
    }
    setBuffers((previous) => previous.map((buffer) => buffer.id === id ? {
      ...buffer,
      logs: [...buffer.logs.slice(-399), { id: ++logId, text, type, nick: messageNick, time: now() }],
      unread: activeRef.current === id ? 0 : buffer.unread + 1,
      mention: activeRef.current === id ? false : buffer.mention || mention,
    } : buffer));
  };

  const openBuffer = (id: string) => {
    setActiveId(id); activeRef.current = id;
    setBuffers((previous) => previous.map((buffer) => buffer.id === id ? { ...buffer, unread: 0, mention: false } : buffer));
    inputRef.current?.focus();
  };

  const sendRaw = (line: string, echo = true) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !realRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'raw', line }));
    if (echo) push('server', `› ${line}`, 'info');
  };

  const removeNick = (source: string) => setBuffers((previous) => previous.map((buffer) => ({ ...buffer, nicks: buffer.nicks.filter((entry) => stripRank(entry) !== source) })));

  const parseIrc = (line: string) => {
    const match = line.match(/^:([^ ]+) ([A-Z0-9]+) ?(.*)$/);
    if (!match) { push('server', line, 'info'); return; }
    const [, prefix, command, rest] = match;
    const source = prefixNick(prefix);
    const trailingIndex = rest.indexOf(' :');
    const params = (trailingIndex >= 0 ? rest.slice(0, trailingIndex) : rest).split(' ').filter(Boolean);
    const trailing = trailingIndex >= 0 ? rest.slice(trailingIndex + 2) : '';

    if (command === '353') {
      const target = params[2]; if (!target) return;
      const id = ensureBuffer(target, 'channel');
      const names = trailing.split(' ').filter(Boolean);
      setBuffers((previous) => previous.map((buffer) => buffer.id === id ? { ...buffer, nicks: Array.from(new Set([...buffer.nicks, ...names])) } : buffer));
      return;
    }
    if (command === '366') return;
    if (command === '332' || command === '333') {
      const target = params[1]; if (!target || command === '333') return;
      const id = ensureBuffer(target, 'channel');
      setBuffers((previous) => previous.map((buffer) => buffer.id === id ? { ...buffer, topic: trailing } : buffer));
      return;
    }
    if (command === 'JOIN') {
      const joined = (trailing || params[0] || '').replace(/^:/, '');
      const id = ensureBuffer(joined, 'channel');
      if (source === nickRef.current) { openBuffer(id); sendRaw(`NAMES ${joined}`, false); sendRaw(`TOPIC ${joined}`, false); }
      setBuffers((previous) => previous.map((buffer) => buffer.id === id && !buffer.nicks.some((entry) => stripRank(entry) === source) ? { ...buffer, nicks: [...buffer.nicks, source] } : buffer));
      push(id, `${source} dołącza do ${joined}`, 'event'); return;
    }
    if (command === 'PART') {
      const target = params[0] || activeRef.current;
      if (source === nickRef.current) { setBuffers((previous) => previous.filter((buffer) => buffer.id !== normalizeId(target))); openBuffer('server'); }
      else { setBuffers((previous) => previous.map((buffer) => buffer.id === normalizeId(target) ? { ...buffer, nicks: buffer.nicks.filter((entry) => stripRank(entry) !== source) } : buffer)); push(target, `${source} opuszcza kanał${trailing ? ` · ${trailing}` : ''}`, 'event'); }
      return;
    }
    if (command === 'QUIT') { removeNick(source); buffers.filter((buffer) => buffer.nicks.some((entry) => stripRank(entry) === source)).forEach((buffer) => push(buffer.id, `${source} rozłącza się${trailing ? ` · ${trailing}` : ''}`, 'event')); return; }
    if (command === 'NICK') {
      const nextNick = (trailing || params[0]).replace(/^:/, '');
      setBuffers((previous) => previous.map((buffer) => ({ ...buffer, nicks: buffer.nicks.map((entry) => stripRank(entry) === source ? `${entry.match(/^[@+%&~]/)?.[0] || ''}${nextNick}` : entry) })));
      if (source === nickRef.current) setNick(nextNick);
      buffers.filter((buffer) => buffer.nicks.some((entry) => stripRank(entry) === source)).forEach((buffer) => push(buffer.id, `${source} zmienia nick na ${nextNick}`, 'event'));
      return;
    }
    if (command === 'PRIVMSG' || command === 'NOTICE') {
      const target = params[0] || 'server';
      if (splitList(settingsRef.current.ignore).some((entry) => entry.toLocaleLowerCase() === source.toLocaleLowerCase())) return;
      const isPrivate = normalizeId(target) === normalizeId(nickRef.current);
      const bufferLabel = isPrivate ? source : target;
      const id = ensureBuffer(bufferLabel, isPrivate ? 'query' : 'channel');
      const marker = String.fromCharCode(1);
      const action = trailing.startsWith(`${marker}ACTION `) && trailing.endsWith(marker) ? trailing.slice(8, -1) : null;
      push(id, action ? `${source} ${action}` : trailing, command === 'NOTICE' ? 'notice' : action ? 'action' : 'msg', action ? undefined : source);
      return;
    }
    if (command === 'TOPIC') {
      const target = params[0]; if (!target) return;
      const id = ensureBuffer(target, 'channel');
      setBuffers((previous) => previous.map((buffer) => buffer.id === id ? { ...buffer, topic: trailing } : buffer));
      push(id, `${source} zmienia temat: ${trailing}`, 'info'); return;
    }
    if (command === 'MODE') {
      const target = params[0]; if (!target) return;
      const id = target.startsWith('#') ? normalizeId(target) : 'server';
      if (target.startsWith('#')) setBuffers((previous) => previous.map((buffer) => buffer.id === id ? { ...buffer, modes: params.slice(1).join(' ') } : buffer));
      push(id, `${source} ustawia MODE ${params.slice(1).join(' ')}`, 'info'); return;
    }
    if (command === 'KICK') {
      const [target, kicked] = params; if (!target || !kicked) return;
      setBuffers((previous) => previous.map((buffer) => buffer.id === normalizeId(target) ? { ...buffer, nicks: buffer.nicks.filter((entry) => stripRank(entry) !== kicked) } : buffer));
      push(target, `${source} wyrzuca ${kicked}${trailing ? ` · ${trailing}` : ''}`, 'warn'); return;
    }
    if (command === 'INVITE') { push('server', `${source} zaprasza Cię na ${trailing || params[1]}`, 'notice'); return; }
    if (command === '001') {
      push('server', trailing || rest, 'ok');
      const s = settingsRef.current;
      if (s.nickserv) sendRaw(`PRIVMSG NickServ :IDENTIFY ${s.nickserv}`, false);
      const channels = splitList(s.autojoin).map((channel) => channel.startsWith('#') ? channel : `#${channel}`);
      if (channels.length) setTimeout(() => sendRaw(`JOIN ${channels.join(',')}`), s.nickserv ? 1500 : 200);
      return;
    }
    if (/^4\d\d$/.test(command) || command === 'ERROR') push('server', trailing || rest, 'err');
    else if (/^\d{3}$/.test(command)) push('server', trailing || rest, 'info');
  };

  const connectReal = () => {
    intentionalCloseRef.current = false;
    const wsUrl = `${import.meta.env.VITE_SUPABASE_URL.replace(/^http/, 'ws')}/functions/v1/irc-tunnel`;
    const ws = new WebSocket(wsUrl); wsRef.current = ws; realRef.current = true;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'init', host: selected.host, port: selected.port, nick: nickRef.current }));
    ws.onmessage = (event) => { try { const message = JSON.parse(String(event.data)); if (message.type === 'status') { if (message.status === 'error') { push('server', `*** ${message.detail}`, 'err'); return; } push('server', `> ${message.status}: ${message.detail ?? ''}`, 'ok'); if (message.status === 'linked') { reconnectCountRef.current = 0; setStatus('connected'); push('server', 'Połączono. Wpisz /join #kanał.', 'ok'); } } else if (message.type === 'irc') parseIrc(message.line); } catch { push('server', '*** nieczytelna odpowiedź bramki', 'err'); } };
    ws.onerror = () => push('server', '*** bramka jest chwilowo niedostępna', 'err');
    ws.onclose = () => {
      wsRef.current = null; realRef.current = false; setEncStrength(0);
      if (intentionalCloseRef.current) { setStatus('idle'); return; }
      reconnectCountRef.current += 1; const delay = Math.min(30000, 2000 * 2 ** (reconnectCountRef.current - 1));
      setStatus('reconnecting'); push('server', `Połączenie przerwane. Ponawiam za ${Math.round(delay / 1000)} s…`, 'warn');
      reconnectTimerRef.current = setTimeout(connectReal, delay);
    };
  };

  const connect = async () => {
    if (status !== 'idle') return;
    setBuffers([serverBuffer()]); setActiveId('server'); activeRef.current = 'server'; setStatus('connecting'); setEncStrength(0);
    push('server', `> tunel do ${selected.host}:${selected.port}`, 'info'); await wait(120);
    push('server', `> klucz x25519: ${randHex(20)}`, 'ok');
    for (let index = 0; index < HOPS.length; index += 1) { push('server', `> węzeł ${index + 1}/${HOPS.length} → ${HOPS[index]}`, 'info'); await wait(isReal ? 35 : 130); setEncStrength(Math.round(((index + 1) / HOPS.length) * 100)); }
    if (isReal) connectReal(); else { setStatus('connected'); push('server', `*** połączono z ${selected.name}`, 'ok'); }
  };

  const disconnect = () => {
    intentionalCloseRef.current = true; if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (realRef.current) sendRaw('QUIT :back to the desert of the real', false);
    wsRef.current?.close(); wsRef.current = null; realRef.current = false; setStatus('idle'); setEncStrength(0); push('server', '*** rozłączono', 'warn'); openBuffer('server');
  };

  const activeTarget = active?.kind === 'server' ? '' : active?.label;
  const closeActive = () => {
    if (!active || active.kind === 'server') return;
    if (active.kind === 'channel') sendRaw(`PART ${active.label} :do zobaczenia`);
    setBuffers((previous) => previous.filter((buffer) => buffer.id !== active.id)); openBuffer('server');
  };

  const handleCommand = (value: string) => {
    const [command, ...parts] = value.slice(1).split(' '); const argument = parts.join(' ').trim(); const cmd = command.toLowerCase();
    switch (cmd) {
      case 'join': if (argument) sendRaw(`JOIN ${argument}`); else push(activeId, 'Użycie: /join #kanał', 'warn'); break;
      case 'part': if (activeTarget || argument) sendRaw(`PART ${argument || activeTarget} :do zobaczenia`); break;
      case 'query': if (argument) openBuffer(ensureBuffer(parts[0], 'query')); break;
      case 'close': closeActive(); break;
      case 'nick': if (argument) sendRaw(`NICK ${argument}`); break;
      case 'me': if (activeTarget && argument) { sendRaw(`PRIVMSG ${activeTarget} :\u0001ACTION ${argument}\u0001`, false); push(activeId, `${nickRef.current} ${argument}`, 'action'); } break;
      case 'msg': { const [target, ...words] = parts; if (target && words.length) { sendRaw(`PRIVMSG ${target} :${words.join(' ')}`, false); const id = ensureBuffer(target, target.startsWith('#') ? 'channel' : 'query'); push(id, words.join(' '), 'msg', nickRef.current); } break; }
      case 'notice': { const [target, ...words] = parts; if (target && words.length) sendRaw(`NOTICE ${target} :${words.join(' ')}`); break; }
      case 'topic': if (active?.kind === 'channel') sendRaw(`TOPIC ${active.label}${argument ? ` :${argument}` : ''}`); break;
      case 'mode': sendRaw(`MODE ${argument || activeTarget}`); break;
      case 'kick': if (active?.kind === 'channel' && argument) sendRaw(`KICK ${active.label} ${argument}`); break;
      case 'ban': if (active?.kind === 'channel' && argument) sendRaw(`MODE ${active.label} +b ${argument}`); break;
      case 'invite': if (active?.kind === 'channel' && argument) sendRaw(`INVITE ${argument} ${active.label}`); break;
      case 'away': sendRaw(`AWAY${argument ? ` :${argument}` : ''}`); break;
      case 'names': sendRaw(`NAMES ${argument || activeTarget}`); break;
      case 'list': sendRaw(`LIST${argument ? ` ${argument}` : ''}`); break;
      case 'whois': if (argument) sendRaw(`WHOIS ${argument}`); break;
      case 'quit': disconnect(); break;
      case 'raw': case 'quote': if (argument) sendRaw(argument); break;
      case 'help': push(activeId, COMMANDS.join(' · '), 'ok'); break;
      case 'ignore': if (argument) { updateSetting('ignore', Array.from(new Set([...splitList(settings.ignore), argument])).join(', ')); push(activeId, `Ignoruję ${argument}`, 'ok'); } else push(activeId, `Ignorowani: ${settings.ignore || 'nikt'}`, 'info'); break;
      case 'unignore': updateSetting('ignore', splitList(settings.ignore).filter((entry) => entry.toLocaleLowerCase() !== argument.toLocaleLowerCase()).join(', ')); push(activeId, `Nie ignoruję ${argument}`, 'ok'); break;
      case 'clear': setBuffers((previous) => previous.map((buffer) => buffer.id === activeId ? { ...buffer, logs: [] } : buffer)); break;
      case 'search': setShowSearch(true); setSearch(argument); break;
      case 'ns': case 'nickserv': if (argument) sendRaw(`PRIVMSG NickServ :${argument}`, false); break;
      case 'cs': case 'chanserv': if (argument) sendRaw(`PRIVMSG ChanServ :${argument}`, false); break;
      default: sendRaw(value.slice(1));
    }
  };

  const submitValue = (value: string) => {
    if (!value) return; setHistory((previous) => [...previous.slice(-49), value]); setHistoryIndex(-1);
    if (!realRef.current) { push(activeId, `‹ ${value}`, 'info'); push(activeId, '// ten uplink jest filmową symulacją', 'warn'); return; }
    if (value.startsWith('/')) { handleCommand(value); return; }
    if (!activeTarget) { push('server', 'Najpierw wejdź na kanał: /join #nazwa', 'warn'); return; }
    sendRaw(`PRIVMSG ${activeTarget} :${value}`, false); push(activeId, value, 'msg', nickRef.current);
  };

  const onSubmit = (event: FormEvent) => { event.preventDefault(); const value = input.trim(); if (!value) return; setInput(''); submitValue(value); };
  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault(); const start = input.lastIndexOf(' ') + 1; const fragment = input.slice(start).toLocaleLowerCase();
      const choices = input.startsWith('/') && start === 0 ? COMMANDS : sortedNicks.map(stripRank);
      const match = choices.find((choice) => choice.toLocaleLowerCase().startsWith(fragment));
      if (match) setInput(`${input.slice(0, start)}${match}${start === 0 && !input.startsWith('/') ? ': ' : ' '}`);
    } else if (event.key === 'ArrowUp' && history.length) { event.preventDefault(); const next = Math.min(history.length - 1, historyIndex + 1); setHistoryIndex(next); setInput(history[history.length - 1 - next]); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); const next = historyIndex - 1; setHistoryIndex(next); setInput(next < 0 ? '' : history[history.length - 1 - next]); }
  };

  useEffect(() => { if (status !== 'connected' || realRef.current) return; const timer = setInterval(() => push(activeRef.current, CHATTER[Math.floor(Math.random() * CHATTER.length)], 'msg'), 3200); return () => clearInterval(timer); }, [status]);

  return (
    <section className="irc-shell w-full max-w-7xl mx-auto overflow-hidden" aria-label="Klient IRC">
      <header className="irc-titlebar px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-border">
        <div className="min-w-0 flex items-center gap-3">
          <span className={`irc-status-dot ${status === 'connected' ? 'is-on' : status === 'idle' ? 'is-off' : 'is-busy'}`} aria-hidden="true" />
          <div className="min-w-0"><p className="font-mono text-sm font-bold tracking-wider text-foreground">SECURE TUNNEL <span className="text-muted-foreground font-normal">/ IRC</span></p>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5"><span className="irc-chip">{selected.name}</span><span className="irc-chip">{nick}</span><span className="irc-chip">{status === 'connected' ? 'online' : status === 'idle' ? 'offline' : status === 'connecting' ? 'łączenie…' : 'ponawianie…'}</span>{encStrength > 0 && <span className="irc-chip">🔒 {encStrength}%</span>}</div></div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant={showSearch ? 'default' : 'ghost'} className="h-8 w-8 rounded-full" onClick={() => setShowSearch((value) => !value)} aria-label="Szukaj w rozmowie" title="Szukaj w rozmowie"><Search /></Button>
          <Button size="icon" variant={settings.notify ? 'default' : 'ghost'} className="h-8 w-8 rounded-full" onClick={toggleNotify} aria-label="Powiadomienia" title="Powiadomienia o wzmiankach i privach">{settings.notify ? <Bell /> : <BellOff />}</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setShowSettings(true)} aria-label="Ustawienia" title="Ustawienia"><Settings /></Button>
          <div className="irc-segment ml-1" aria-label="Wybór szaty graficznej">{THEMES.map((item) => <button type="button" key={item.id} onClick={() => setTheme(item.id)} className={theme === item.id ? 'is-active' : ''}>{item.label}</button>)}</div>
        </div>
      </header>
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="irc-dialog max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-mono tracking-wider">Ustawienia klienta</DialogTitle><DialogDescription>Zapisywane tylko w tej przeglądarce. Hasło NickServ trafia wyłącznie do serwera IRC.</DialogDescription></DialogHeader>
          {([['Konto', [['nick', 'Stały nick', 'np. arek'], ['nickserv', 'Hasło NickServ (auto-identify)', '••••••']]], ['Kanały', [['autojoin', 'Auto-join kanały', '#polska, #linux'], ['highlights', 'Słowa wyróżniające', 'arek, admin'], ['ignore', 'Ignorowani', 'spamer1, bot2']]]] as const).map(([section, fields]) => <div key={section} className="irc-settings-section"><p className="irc-section-title">{section}</p>{fields.map(([key, label, placeholder]) => <label key={key} className="flex flex-col gap-1 text-xs text-muted-foreground">{label}<input type={key === 'nickserv' ? 'password' : 'text'} value={settings[key]} placeholder={placeholder} onChange={(event) => { updateSetting(key, event.target.value); if (key === 'nick' && status === 'idle' && event.target.value) setNick(event.target.value); }} className="irc-field" /></label>)}</div>)}
          {([['Powiadomienia', [['sound', 'Dźwięk przy wzmiance']]], ['Wygląd', [['hideEvents', 'Ukryj wejścia/wyjścia'], ['showMedia', 'Podgląd obrazków z linków']]]] as const).map(([section, fields]) => <div key={section} className="irc-settings-section"><p className="irc-section-title">{section}</p>{section === 'Powiadomienia' && <label className="flex items-center justify-between text-sm">Powiadomienia przeglądarki<Switch checked={settings.notify} onCheckedChange={toggleNotify} /></label>}{fields.map(([key, label]) => <label key={key} className="flex items-center justify-between text-sm">{label}<Switch checked={settings[key]} onCheckedChange={(value) => updateSetting(key, value)} /></label>)}</div>)}
        </DialogContent>
      </Dialog>

      <div className={`grid min-h-[570px] ${showChats ? 'lg:grid-cols-[210px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
        {showChats && <aside className="irc-sidebar border-b lg:border-b-0 lg:border-r border-border p-3 max-h-64 lg:max-h-none overflow-y-auto">
          <div className="flex items-center justify-between mb-2"><p className="text-[10px] font-bold text-muted-foreground">SIEĆ I ROZMOWY</p><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowChats(false)} aria-label="Ukryj rozmowy" title="Ukryj rozmowy"><ChevronLeft /></Button></div>
          <label className="text-[10px] text-muted-foreground">SERWER</label>
          <select value={selected.id} onChange={(event) => { const next = SERVERS.find((server) => server.id === event.target.value); if (next && status === 'idle') setSelected(next); }} disabled={status !== 'idle'} className="mt-1 mb-3 h-9 w-full border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring" aria-label="Serwer IRC">{SERVERS.map((server) => <option key={server.id} value={server.id}>{server.name} · {server.ping}ms</option>)}</select>
          <div className="space-y-1">
            {buffers.map((buffer) => <button type="button" key={buffer.id} onClick={() => openBuffer(buffer.id)} className={`w-full flex items-center gap-2 px-2 py-2 border text-left text-xs transition-colors ${activeId === buffer.id ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              {buffer.kind === 'channel' ? <Hash className="h-3.5 w-3.5" /> : buffer.kind === 'query' ? <MessageSquare className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}<span className="truncate">{buffer.label}</span>
              {buffer.unread > 0 && <span className={`ml-auto min-w-5 px-1 text-center ${buffer.mention ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>{buffer.unread}</span>}
            </button>)}
          </div>
          <div className="mt-3">{status === 'idle' ? <Button onClick={connect} className="w-full font-mono">OPEN TUNNEL</Button> : <Button onClick={disconnect} variant="destructive" className="w-full font-mono"><LogOut />ROZŁĄCZ</Button>}</div>
          <div className="mt-3 text-[10px] text-muted-foreground font-mono leading-5">nick: <span className="text-foreground">{nick}</span><br />szyfrowanie: {encStrength}%<br />stan: {status}</div>
        </aside>}

        <div className={`grid min-w-0 ${showNicks && active?.kind === 'channel' ? 'md:grid-cols-[minmax(0,1fr)_190px]' : 'grid-cols-1'}`}>
          <div className="flex min-w-0 flex-col bg-card/70">
            <div className="min-h-12 px-2 sm:px-3 flex items-center gap-2 border-b border-border bg-muted/60">
              {!showChats && <Button size="icon" variant="ghost" onClick={() => setShowChats(true)} aria-label="Pokaż rozmowy" title="Pokaż rozmowy"><ChevronRight /></Button>}
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="text-sm truncate">{active?.label || 'Status'}</strong>{active?.modes && <span className="text-[10px] text-muted-foreground">{active.modes}</span>}</div><p className="text-[10px] text-muted-foreground truncate">{active?.topic || (active?.kind === 'server' ? 'Komunikaty sieci' : 'Brak tematu kanału')}</p></div>
              {active?.kind !== 'server' && <Button size="icon" variant="ghost" onClick={closeActive} aria-label="Zamknij rozmowę" title="Zamknij rozmowę"><X /></Button>}
              {active?.kind === 'channel' && <Button size="icon" variant="ghost" onClick={() => setShowNicks((value) => !value)} aria-label={showNicks ? 'Ukryj nicki' : 'Pokaż nicki'} title={showNicks ? 'Ukryj nicki' : 'Pokaż nicki'}><Users /></Button>}
            </div>
            {showSearch && <div className="flex items-center gap-2 border-b border-border px-3 py-1.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj w tej rozmowie…" className="flex-1 bg-transparent text-xs text-foreground outline-none" aria-label="Szukaj w rozmowie" /><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setSearch(''); setShowSearch(false); }} aria-label="Zamknij szukanie"><X /></Button></div>}
            <div ref={logRef} className={`irc-log ${showSearch ? 'h-[426px]' : 'h-[462px]'} overflow-y-auto p-3 font-mono text-xs`} aria-live="polite">
              {!active?.logs.length && <div className="text-muted-foreground">// otwórz tunel i wpisz /join #kanał<br />// Tab uzupełnia nicki i komendy · ↑↓ przegląda historię · ⚙ ustawienia: auto-join, NickServ, powiadomienia</div>}
              {active?.logs.filter((line) => !(settings.hideEvents && line.type === 'event') && (!search || `${line.nick ?? ''} ${line.text}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))).map((line) => {
                const highlighted = line.nick && line.nick !== nick && [nick, ...splitList(settings.highlights)].some((word) => line.text.toLocaleLowerCase().includes(word.toLocaleLowerCase()));
                return <div key={line.id} className={`irc-line grid grid-cols-[42px_minmax(0,1fr)] gap-2 py-0.5 ${highlighted ? 'bg-primary/15 border-l-2 border-primary pl-1' : ''} ${line.type === 'ok' ? 'text-primary' : line.type === 'warn' ? 'text-warning' : line.type === 'err' ? 'text-destructive' : line.type === 'notice' ? 'text-secondary-foreground' : line.type === 'msg' ? 'text-foreground' : line.type === 'event' ? 'text-muted-foreground opacity-70' : 'text-muted-foreground'}`}><time className="text-muted-foreground opacity-70">{line.time}</time><span className="min-w-0 break-words">{line.nick && <strong className="nick-label" style={theme === 'mono' ? undefined : { color: `hsl(${nickHue(line.nick)} 75% 60%)` }}>&lt;{line.nick}&gt; </strong>}{line.type === 'action' && <span className="text-primary">* </span>}<RichText text={line.text} media={settings.showMedia} /></span></div>;
              })}
            </div>
            <form onSubmit={onSubmit} className="irc-input flex gap-2 p-2 border-t border-border bg-muted/40"><span className="text-primary pt-2 font-mono">›</span><input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onInputKeyDown} disabled={status !== 'connected'} placeholder={status === 'connected' ? (activeTarget ? `Napisz do ${activeTarget}…` : '/join #kanał') : 'Najpierw otwórz tunel'} className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground text-sm" aria-label="Wiadomość lub komenda IRC" /><Button type="submit" size="icon" disabled={status !== 'connected'} title="Wyślij" aria-label="Wyślij"><Send /></Button></form>
          </div>

          {showNicks && active?.kind === 'channel' && <aside className="nick-panel border-t md:border-t-0 md:border-l border-border bg-muted/30 max-h-52 md:max-h-none overflow-y-auto"><div className="h-10 px-3 flex items-center gap-2 border-b border-border text-xs font-bold"><Users /> NICKI <span className="ml-auto text-muted-foreground">{sortedNicks.length}</span></div><div className="p-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-1 gap-1">{sortedNicks.length ? sortedNicks.map((name) => {
            const clean = stripRank(name); return <DropdownMenu key={name}><DropdownMenuTrigger asChild><Button type="button" variant="ghost" className="h-7 justify-start truncate px-2 text-xs font-normal">{name}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>{clean}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => openBuffer(ensureBuffer(clean, 'query'))}>Rozmowa prywatna</DropdownMenuItem><DropdownMenuItem onSelect={() => sendRaw(`WHOIS ${clean}`)}>WHOIS</DropdownMenuItem><DropdownMenuItem onSelect={() => { setInput(`${clean}: `); inputRef.current?.focus(); }}>Wstaw wzmiankę</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
          }) : <p className="col-span-full px-2 py-3 text-xs text-muted-foreground">Lista pojawi się po wejściu na kanał.</p>}</div></aside>}
        </div>
      </div>
    </section>
  );
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const randHex = (length: number) => Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
export default SecureTunnel;
