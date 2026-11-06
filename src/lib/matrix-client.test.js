import { describe, expect, test } from 'bun:test';
import { applyEvent, emptyRoom, normalizeHomeserver, parseUserId, roomTitle } from './matrix-client';

describe('Matrix homeserver input', () => {
  test('bare server name becomes https', () => {
    expect(normalizeHomeserver('matrix.org')).toBe('https://matrix.org');
  });
  test('plain http is rejected so tokens never travel in clear text', () => {
    expect(normalizeHomeserver('http://matrix.org')).toBeNull();
  });
  test('user id with server is split', () => {
    expect(parseUserId('@arek:matrix.org', 'x.org')).toEqual({ localpart: 'arek', server: 'matrix.org' });
  });
});

describe('Matrix rooms', () => {
  test('name beats alias, alias beats heroes', () => {
    const room = emptyRoom('!a:matrix.org');
    room.alias = '#zion:matrix.org';
    expect(roomTitle(room)).toBe('#zion:matrix.org');
    room.name = 'Zion';
    expect(roomTitle(room)).toBe('Zion');
  });
  test('duplicate events are shown once', () => {
    const room = emptyRoom('!a:matrix.org');
    const event = { event_id: '$1', type: 'm.room.message', sender: '@neo:matrix.org', content: { msgtype: 'm.text', body: 'hi' }, origin_server_ts: 1 };
    expect(applyEvent(room, event, '@me:matrix.org', true)).toBe(true);
    expect(applyEvent(room, event, '@me:matrix.org', true)).toBe(false);
    expect(room.messages).toHaveLength(1);
  });
  test('encrypted messages are not shown as readable text', () => {
    const room = emptyRoom('!a:matrix.org');
    applyEvent(room, { event_id: '$2', type: 'm.room.encrypted', sender: '@neo:matrix.org', content: { ciphertext: 'x' } }, '@me:matrix.org', true);
    expect(room.messages[0].kind).toBe('encrypted');
  });
});
