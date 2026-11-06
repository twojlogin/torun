// Minimal Matrix client-server API helpers. No dependencies: plain fetch to the homeserver.
// End-to-end encryption is intentionally NOT supported; encrypted rooms are read-only placeholders.

export type MatrixSession = { homeserver: string; userId: string; accessToken: string; deviceId?: string };
export type MatrixMessage = { id: string; sender: string; body: string; ts: number; kind: 'text' | 'emote' | 'notice' | 'media' | 'encrypted'; own: boolean };
export type MatrixRoom = {
  id: string; name: string; alias: string; topic: string; encrypted: boolean; heroes: string[];
  members: Record<string, string>; messages: MatrixMessage[]; unread: number; invited: boolean; seen: Set<string>;
};

export class MatrixError extends Error {
  constructor(public status: number, public errcode: string, message: string, public retryAfterMs?: number) { super(message); }
}

/** Accepts "matrix.org", "https://matrix.org/" etc. Only https is allowed (tokens never travel in clear text). */
export const normalizeHomeserver = (input: string): string | null => {
  const raw = input.trim().replace(/\/+$/, '');
  if (!raw) return null;
  const url = raw.startsWith('http://') ? null : new URL(raw.startsWith('https://') ? raw : `https://${raw}`).toString().replace(/\/+$/, '');
  return url && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(url) ? url : null;
};

export const parseUserId = (input: string, defaultServer: string): { localpart: string; server: string } => {
  const trimmed = input.trim().replace(/^@/, '');
  const [localpart, server] = trimmed.split(':');
  return { localpart, server: server || defaultServer };
};

export const shortName = (userId: string) => userId.replace(/^@/, '').split(':')[0];

export const roomTitle = (room: Pick<MatrixRoom, 'id' | 'name' | 'alias' | 'heroes' | 'members'>): string => {
  if (room.name) return room.name;
  if (room.alias) return room.alias;
  const heroes = room.heroes.map((id) => room.members[id] || shortName(id));
  if (heroes.length) return heroes.join(', ');
  return room.id;
};

const request = async <T>(base: string, path: string, init: RequestInit & { token?: string; signal?: AbortSignal } = {}): Promise<T> => {
  const { token, ...rest } = init;
  const response = await fetch(`${base}/_matrix/client/v3${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    referrerPolicy: 'no-referrer',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new MatrixError(response.status, data.errcode || 'M_UNKNOWN', data.error || `HTTP ${response.status}`, data.retry_after_ms);
  return data as T;
};

export const discoverHomeserver = async (server: string): Promise<string> => {
  const base = normalizeHomeserver(server);
  if (!base) throw new MatrixError(0, 'M_BAD_SERVER', 'Podaj poprawny serwer (https), np. matrix.org');
  try {
    const response = await fetch(`${base}/.well-known/matrix/client`, { referrerPolicy: 'no-referrer' });
    if (response.ok) {
      const data = await response.json();
      const discovered = normalizeHomeserver(data?.['m.homeserver']?.base_url ?? '');
      if (discovered) return discovered;
    }
  } catch { /* no well-known: use the server itself */ }
  return base;
};

export const login = async (base: string, localpart: string, password: string): Promise<MatrixSession> => {
  const data = await request<{ user_id: string; access_token: string; device_id?: string }>(base, '/login', {
    method: 'POST',
    body: JSON.stringify({ type: 'm.login.password', identifier: { type: 'm.id.user', user: localpart }, password, initial_device_display_name: 'Matrix OS terminal' }),
  });
  return { homeserver: base, userId: data.user_id, accessToken: data.access_token, deviceId: data.device_id };
};

export const logout = (s: MatrixSession) => request(s.homeserver, '/logout', { method: 'POST', body: '{}', token: s.accessToken }).catch(() => undefined);

const FILTER = JSON.stringify({
  room: { timeline: { limit: 40 }, state: { lazy_load_members: true }, ephemeral: { types: [] }, account_data: { types: [] } },
  presence: { types: [] }, account_data: { types: [] },
});

type RawEvent = { event_id?: string; type: string; sender: string; content: Record<string, unknown>; state_key?: string; origin_server_ts?: number };
type RawRoom = { timeline?: { events?: RawEvent[] }; state?: { events?: RawEvent[] }; summary?: { 'm.heroes'?: string[] }; invite_state?: { events?: RawEvent[] } };
export type SyncResponse = { next_batch: string; rooms?: { join?: Record<string, RawRoom>; invite?: Record<string, RawRoom>; leave?: Record<string, unknown> } };

export const sync = (s: MatrixSession, since: string | undefined, signal: AbortSignal) =>
  request<SyncResponse>(s.homeserver, `/sync?timeout=${since ? 25000 : 0}&filter=${encodeURIComponent(FILTER)}${since ? `&since=${encodeURIComponent(since)}` : ''}`, { token: s.accessToken, signal });

export const sendMessage = (s: MatrixSession, roomId: string, body: string, emote: boolean) =>
  request(s.homeserver, `/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${crypto.randomUUID()}`, {
    method: 'PUT', token: s.accessToken, body: JSON.stringify({ msgtype: emote ? 'm.emote' : 'm.text', body }),
  });

export const joinRoom = (s: MatrixSession, roomIdOrAlias: string) =>
  request<{ room_id: string }>(s.homeserver, `/join/${encodeURIComponent(roomIdOrAlias)}`, { method: 'POST', token: s.accessToken, body: '{}' });

export const leaveRoom = (s: MatrixSession, roomId: string) =>
  request(s.homeserver, `/rooms/${encodeURIComponent(roomId)}/leave`, { method: 'POST', token: s.accessToken, body: '{}' });

export const emptyRoom = (id: string): MatrixRoom => ({ id, name: '', alias: '', topic: '', encrypted: false, heroes: [], members: {}, messages: [], unread: 0, invited: false, seen: new Set() });

const str = (value: unknown) => (typeof value === 'string' ? value : '');

/** Applies one raw event to a room (state or timeline). Returns true when a visible message was added. */
export const applyEvent = (room: MatrixRoom, event: RawEvent, myId: string, fromTimeline: boolean): boolean => {
  const c = event.content ?? {};
  switch (event.type) {
    case 'm.room.name': room.name = str(c.name); return false;
    case 'm.room.canonical_alias': room.alias = str(c.alias); return false;
    case 'm.room.topic': room.topic = str(c.topic); return false;
    case 'm.room.encryption': room.encrypted = true; return false;
    case 'm.room.member':
      if (event.state_key) { if (c.membership === 'join') room.members[event.state_key] = str(c.displayname) || shortName(event.state_key); else delete room.members[event.state_key]; }
      return false;
    case 'm.room.message':
    case 'm.room.encrypted': {
      if (!fromTimeline || !event.event_id || room.seen.has(event.event_id)) return false;
      room.seen.add(event.event_id);
      const msgtype = str(c.msgtype);
      const kind: MatrixMessage['kind'] = event.type === 'm.room.encrypted' ? 'encrypted' : msgtype === 'm.emote' ? 'emote' : msgtype === 'm.notice' ? 'notice' : ['m.image', 'm.file', 'm.video', 'm.audio'].includes(msgtype) ? 'media' : 'text';
      const body = kind === 'encrypted' ? '🔒 zaszyfrowana wiadomość (E2EE nieobsługiwane w tym kliencie)' : kind === 'media' ? `[${msgtype.slice(2)}] ${str(c.body)}` : str(c.body);
      if (!body) return false;
      room.messages.push({ id: event.event_id, sender: event.sender, body, ts: event.origin_server_ts ?? Date.now(), kind, own: event.sender === myId });
      return true;
    }
    default: return false;
  }
};
