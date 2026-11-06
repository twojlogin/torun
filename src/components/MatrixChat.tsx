import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hash, LogOut, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MatrixError, MatrixMessage, MatrixRoom, MatrixSession, applyEvent, discoverHomeserver, emptyRoom, joinRoom, leaveRoom,
  login, logout, parseUserId, roomTitle, sendMessage, shortName, sync,
} from '@/lib/matrix-client';

const STORAGE_KEY = 'matrix-org-session';
const URL_RE = /(https?:\/\/[^\s<>"]+)/g;
const time = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const loadSession = (): MatrixSession | null => { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; } };
const Text = ({ text }: { text: string }) => <>{text.split(URL_RE).map((part, i) => i % 2 ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline text-primary break-all">{part}</a> : <span key={i}>{part}</span>)}</>;

const MatrixChat = () => {
  const [session, setSession] = useState<MatrixSession | null>(loadSession);
  const [server, setServer] = useState('matrix.org');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(false);
  const [, setVersion] = useState(0);
  const rooms = useRef(new Map<string, MatrixRoom>());
  const [activeId, setActiveId] = useState('');
  const activeRef = useRef('');
  const [input, setInput] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const bump = () => setVersion((v) => v + 1);

  useEffect(() => { activeRef.current = activeId; }, [activeId]);

  const dropSession = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    rooms.current.clear();
    setSession(null); setOnline(false); setActiveId(''); setPassword('');
  }, []);

  // Long-polling sync loop. Runs only while a session exists.
  useEffect(() => {
    if (!session) return;
    const abort = new AbortController();
    let since: string | undefined;
    let first = true;
    let failures = 0;
    (async () => {
      while (!abort.signal.aborted) {
        try {
          const data = await sync(session, since, abort.signal);
          since = data.next_batch; failures = 0; setOnline(true); setError('');
          for (const [id, raw] of Object.entries(data.rooms?.join ?? {})) {
            const room = rooms.current.get(id) ?? emptyRoom(id);
            room.invited = false;
            raw.state?.events?.forEach((event) => applyEvent(room, event, session.userId, false));
            if (raw.summary?.['m.heroes']) room.heroes = raw.summary['m.heroes'];
            let added = 0;
            raw.timeline?.events?.forEach((event) => { if (applyEvent(room, event, session.userId, true) && !room.messages[room.messages.length - 1].own) added += 1; });
            if (!first && id !== activeRef.current) room.unread += added;
            rooms.current.set(id, room);
          }
          for (const [id, raw] of Object.entries(data.rooms?.invite ?? {})) {
            const room = rooms.current.get(id) ?? emptyRoom(id);
            room.invited = true;
            raw.invite_state?.events?.forEach((event) => applyEvent(room, event, session.userId, false));
            rooms.current.set(id, room);
          }
          Object.keys(data.rooms?.leave ?? {}).forEach((id) => rooms.current.delete(id));
          first = false;
          bump();
        } catch (e) {
          if (abort.signal.aborted) return;
          if (e instanceof MatrixError && e.errcode === 'M_UNKNOWN_TOKEN') { setError('Sesja wygasła — zaloguj się ponownie.'); dropSession(); return; }
          setOnline(false); failures += 1;
          const wait = e instanceof MatrixError && e.retryAfterMs ? e.retryAfterMs : Math.min(30000, 1000 * 2 ** failures);
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
      }
    })();
    return () => abort.abort();
  }, [session, dropSession]);

  const list = [...rooms.current.values()].sort((a, b) => Number(b.invited) - Number(a.invited) || (b.messages.at?.(-1)?.ts ?? 0) - (a.messages.at?.(-1)?.ts ?? 0));
  const active = rooms.current.get(activeId);
  const logLength = active?.messages.length ?? 0;
  useEffect(() => { const log = logRef.current; if (log) log.scrollTop = log.scrollHeight; }, [activeId, logLength]);
  const members = useMemo(() => Object.values(active?.members ?? {}).sort((a, b) => a.localeCompare(b)), [active?.members, logLength]); // eslint-disable-line react-hooks/exhaustive-deps

  const doLogin = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const { localpart, server: userServer } = parseUserId(user, server.trim());
      const base = await discoverHomeserver(userServer);
      const next = await login(base, localpart, password);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSession(next); setPassword('');
    } catch (e) {
      setError(e instanceof MatrixError ? (e.errcode === 'M_FORBIDDEN' ? 'Zły login lub hasło.' : e.errcode === 'M_LIMIT_EXCEEDED' ? 'Za dużo prób — poczekaj chwilę.' : e.message) : 'Nie można połączyć się z serwerem.');
    } finally { setBusy(false); }
  };

  const doLogout = async () => { if (session) await logout(session); dropSession(); };
  const select = (id: string) => { const room = rooms.current.get(id); if (room) room.unread = 0; setActiveId(id); bump(); };
  const fail = (e: unknown) => setError(e instanceof MatrixError ? e.message : 'Błąd połączenia z serwerem.');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || !session) return;
    setInput('');
    try {
      if (text.startsWith('/join ')) { const { room_id } = await joinRoom(session, text.slice(6).trim()); setActiveId(room_id); return; }
      if (text === '/leave' && active) { await leaveRoom(session, active.id); rooms.current.delete(active.id); setActiveId(''); bump(); return; }
      if (!active || active.invited) return;
      if (active.encrypted) { setError('Ten pokój jest szyfrowany end-to-end — ten klient nie umie szyfrować, więc nie wyśle wiadomości.'); return; }
      const emote = text.startsWith('/me ');
      await sendMessage(session, active.id, emote ? text.slice(4) : text, emote);
      setError('');
    } catch (e) { fail(e); }
  };

  const respondInvite = async (room: MatrixRoom, accept: boolean) => {
    if (!session) return;
    try { if (accept) { await joinRoom(session, room.id); setActiveId(room.id); } else { await leaveRoom(session, room.id); rooms.current.delete(room.id); bump(); } } catch (e) { fail(e); }
  };

  const nameOf = (m: MatrixMessage) => active?.members[m.sender] || shortName(m.sender);

  return (
    <div className="irc-shell w-full max-w-6xl mx-auto overflow-hidden">
      <div className="irc-titlebar flex items-center gap-3 px-4 py-3 border-b border-border">
        <span className={`irc-status-dot ${online ? 'is-on' : session ? 'is-busy' : 'is-off'}`} />
        <span className="font-mono text-sm font-bold text-foreground">{session ? session.userId : 'Matrix.org'}</span>
        <span className="irc-chip">{session ? new URL(session.homeserver).host : 'federacja Matrix'}</span>
        <span className="irc-chip hidden sm:inline">bez E2EE</span>
        <div className="ml-auto flex gap-1">
          {session && <Button variant="ghost" size="icon" aria-label="Uczestnicy" onClick={() => setShowMembers((v) => !v)}><Users className="h-4 w-4" /></Button>}
          {session && <Button variant="ghost" size="icon" aria-label="Wyloguj z Matrix" onClick={doLogout}><LogOut className="h-4 w-4" /></Button>}
        </div>
      </div>

      {!session ? (
        <form onSubmit={doLogin} className="p-6 grid gap-3 max-w-md mx-auto">
          <p className="text-sm text-muted-foreground">Zaloguj się na istniejące konto Matrix (np. z matrix.org). Rejestracja jest na stronie serwera — wymaga captchy. Hasło idzie wyłącznie do Twojego serwera, nigdzie indziej, a sesja żyje tylko do zamknięcia karty.</p>
          <label className="grid gap-1 text-xs font-mono text-muted-foreground">Serwer
            <input className="irc-field" value={server} onChange={(e) => setServer(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <label className="grid gap-1 text-xs font-mono text-muted-foreground">Użytkownik (login albo @login:serwer)
            <input className="irc-field" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" spellCheck={false} required />
          </label>
          <label className="grid gap-1 text-xs font-mono text-muted-foreground">Hasło
            <input className="irc-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {error && <p role="alert" className="text-xs text-destructive font-mono">{error}</p>}
          <Button type="submit" disabled={busy || !user || !password}>{busy ? 'Łączenie…' : 'Połącz z Matrix'}</Button>
        </form>
      ) : (
        <div className="flex h-[480px] max-h-[75vh]">
          <aside className="irc-sidebar w-40 sm:w-56 shrink-0 border-r border-border overflow-y-auto p-2 space-y-1">
            {list.length === 0 && <p className="text-xs text-muted-foreground p-2 font-mono">{online ? 'Brak pokoi. Wpisz /join #pokoj:matrix.org' : 'Synchronizacja…'}</p>}
            {list.map((room) => (
              <div key={room.id}>
                <button type="button" onClick={() => select(room.id)} className={`irc-buffer ${room.id === activeId ? 'is-active' : ''}`}>
                  <Hash className="h-3 w-3 shrink-0" />
                  <span className="truncate flex-1">{roomTitle(room)}</span>
                  {room.encrypted && <span aria-label="szyfrowany" title="Szyfrowany E2EE — tylko podgląd">🔒</span>}
                  {room.unread > 0 && <span className="irc-badge">{room.unread}</span>}
                </button>
                {room.invited && (
                  <div className="flex gap-1 px-2 pb-1">
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => respondInvite(room, true)}>Przyjmij</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => respondInvite(room, false)}>Odrzuć</Button>
                  </div>
                )}
              </div>
            ))}
          </aside>

          <section className="flex-1 min-w-0 flex flex-col">
            {active && <div className="px-3 py-2 border-b border-border text-xs font-mono truncate"><span className="text-foreground font-bold">{roomTitle(active)}</span>{active.topic && <span className="text-muted-foreground"> — {active.topic}</span>}</div>}
            <div ref={logRef} className="irc-log flex-1 overflow-y-auto p-2 font-mono text-sm">
              {!active && <p className="text-muted-foreground text-xs p-2">Wybierz pokój po lewej albo wpisz /join #pokoj:matrix.org</p>}
              {active?.invited && <p className="text-muted-foreground text-xs p-2">Zaproszenie do pokoju — przyjmij je w panelu po lewej.</p>}
              {active?.messages.map((m, i) => {
                const grouped = active.messages[i - 1]?.sender === m.sender && m.kind === 'text';
                return (
                  <div key={m.id} className={`irc-msg irc-line ${grouped ? 'is-grouped' : ''}`}>
                    {grouped ? <span className="irc-hover-time">{time(m.ts)}</span> : <span aria-hidden="true" className="irc-avatar h-8 w-8">{nameOf(m).charAt(0).toUpperCase()}</span>}
                    <div className="min-w-0">
                      {!grouped && <div className="text-xs"><span className="font-bold text-primary">{nameOf(m)}</span> <span className="opacity-50">{time(m.ts)}</span></div>}
                      <div className={`break-words whitespace-pre-wrap ${m.kind === 'notice' || m.kind === 'encrypted' ? 'text-muted-foreground italic' : ''}`}>{m.kind === 'emote' && '* '}<Text text={m.body} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
            {error && <p role="alert" className="px-3 py-1 text-xs text-destructive font-mono">{error}</p>}
            <form onSubmit={submit} className="flex gap-2 p-2 border-t border-border">
              <input className="irc-field flex-1 min-w-0" value={input} onChange={(e) => setInput(e.target.value)} placeholder={active?.encrypted ? 'Pokój szyfrowany — tylko podgląd' : 'Wiadomość lub /join, /me, /leave'} maxLength={4000} aria-label="Wiadomość Matrix" />
              <Button type="submit" size="icon" aria-label="Wyślij"><Send className="h-4 w-4" /></Button>
            </form>
          </section>

          {showMembers && active && (
            <aside className="irc-sidebar hidden md:block w-44 shrink-0 border-l border-border overflow-y-auto p-2 text-xs font-mono">
              <div className="text-muted-foreground mb-1">{members.length} uczestników</div>
              {members.map((name) => <div key={name} className="truncate py-0.5">{name}</div>)}
            </aside>
          )}
        </div>
      )}
    </div>
  );
};

export default MatrixChat;
