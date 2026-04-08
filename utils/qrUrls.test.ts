import { describe, it, expect } from 'vitest';
import {
  buildRoundJoinUrl,
  buildTournamentJoinUrl,
  buildQrImageUrl,
  parseJoinUrl,
} from './qrUrls';

describe('buildRoundJoinUrl', () => {
  it('builds the canonical round join URL', () => {
    expect(buildRoundJoinUrl('round-abc', 'pubkey-xyz')).toBe(
      'https://app.onchaindiscgolf.com/join/round/round-abc?p=pubkey-xyz',
    );
  });
});

describe('buildTournamentJoinUrl', () => {
  it('builds the canonical tournament join URL', () => {
    expect(buildTournamentJoinUrl('tour-1', 'director-pk')).toBe(
      'https://app.onchaindiscgolf.com/join/tournament/tour-1?p=director-pk',
    );
  });
});

describe('buildQrImageUrl', () => {
  it('encodes special characters in data via encodeURIComponent', () => {
    const url = buildQrImageUrl('a&b=c?d', 200);
    expect(url).toBe(
      'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=a%26b%3Dc%3Fd',
    );
  });

  it('defaults size to 200', () => {
    const url = buildQrImageUrl('hello');
    expect(url).toContain('size=200x200');
  });

  it('honors a custom size', () => {
    const url = buildQrImageUrl('hello', 500);
    expect(url).toBe(
      'https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=hello',
    );
  });
});

describe('parseJoinUrl', () => {
  it('parses a full HTTPS round URL with pubkey', () => {
    expect(
      parseJoinUrl('https://app.onchaindiscgolf.com/join/round/abc?p=xyz'),
    ).toEqual({ type: 'round', id: 'abc', pubkey: 'xyz' });
  });

  it('parses a path-only tournament URL with no pubkey', () => {
    expect(parseJoinUrl('/join/tournament/t1')).toEqual({
      type: 'tournament',
      id: 't1',
      pubkey: undefined,
    });
  });

  it('handles a path without a leading slash', () => {
    expect(parseJoinUrl('join/round/abc?p=foo')).toEqual({
      type: 'round',
      id: 'abc',
      pubkey: 'foo',
    });
  });

  it('returns null for paths that do not match the join pattern', () => {
    expect(parseJoinUrl('/foo/bar')).toBeNull();
  });

  it('returns null for an unsupported entity type', () => {
    expect(parseJoinUrl('/join/league/abc')).toBeNull();
  });

  it('returns null when the URL constructor throws', () => {
    expect(parseJoinUrl('http://[broken')).toBeNull();
  });

  it('round-trips a round URL via build → parse', () => {
    expect(parseJoinUrl(buildRoundJoinUrl('rid', 'rpk'))).toEqual({
      type: 'round',
      id: 'rid',
      pubkey: 'rpk',
    });
  });

  it('round-trips a tournament URL via build → parse', () => {
    expect(parseJoinUrl(buildTournamentJoinUrl('tid', 'tpk'))).toEqual({
      type: 'tournament',
      id: 'tid',
      pubkey: 'tpk',
    });
  });
});
