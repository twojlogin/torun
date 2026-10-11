import { describe, expect, test } from 'bun:test';
import { messageTarget } from './irc-message-target';

describe('IRC service windows', () => {
  test('NickServ does not create an automatic query', () => {
    expect(messageTarget('PRIVMSG', 'NickServ', 'arek', 'arek', new Set())).toEqual({ label: 'server', kind: 'server' });
  });
  test('ChanServ notices stay in status', () => {
    expect(messageTarget('NOTICE', 'ChanServ', 'arek', 'arek', new Set())).toEqual({ label: 'server', kind: 'server' });
  });
  test('other unsolicited notices do not create windows', () => {
    expect(messageTarget('NOTICE', 'PircAutomat', 'arek', 'arek', new Set())).toEqual({ label: 'server', kind: 'server' });
  });
  test('a manually opened service conversation remains usable', () => {
    expect(messageTarget('NOTICE', 'NickServ', 'arek', 'arek', new Set(['nickserv']))).toEqual({ label: 'NickServ', kind: 'query' });
  });
  test('normal private messages still create conversations', () => {
    expect(messageTarget('PRIVMSG', 'ania', 'arek', 'arek', new Set())).toEqual({ label: 'ania', kind: 'query' });
  });
  test('channel notices stay on the channel', () => {
    expect(messageTarget('NOTICE', 'ChanServ', '#polska', 'arek', new Set())).toEqual({ label: '#polska', kind: 'channel' });
  });
});