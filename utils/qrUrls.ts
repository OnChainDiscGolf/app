/**
 * @file qrUrls.ts
 * @description URL builders and parser for QR-code-based round and tournament
 * join flows. All join URLs follow the pattern:
 *   `https://app.onchaindiscgolf.com/join/{round|tournament}/{id}?p={pubkey}`
 *
 * These URLs are encoded into QR codes displayed by hosts/directors and scanned
 * by players. They also serve as deep links via Android App Links and iOS
 * Universal Links, handled by JoinHandler.tsx.
 */

/** Base URL for all join deep links. */
const APP_DOMAIN = 'https://app.onchaindiscgolf.com';

/**
 * Build a join URL for a round.
 *
 * @param roundId - The round's unique identifier.
 * @param hostPubkey - The Nostr pubkey of the round host.
 * @returns A full HTTPS URL for joining the round.
 */
export const buildRoundJoinUrl = (roundId: string, hostPubkey: string): string =>
  `${APP_DOMAIN}/join/round/${roundId}?p=${hostPubkey}`;

/**
 * Build a join URL for a tournament.
 *
 * @param tournamentId - The tournament's unique identifier.
 * @param directorPubkey - The Nostr pubkey of the tournament director.
 * @returns A full HTTPS URL for joining the tournament.
 */
export const buildTournamentJoinUrl = (tournamentId: string, directorPubkey: string): string =>
  `${APP_DOMAIN}/join/tournament/${tournamentId}?p=${directorPubkey}`;

/**
 * Build a QR code image URL using the external QR Server API.
 *
 * @param data - The string to encode in the QR code.
 * @param size - Image dimensions in pixels (square). Defaults to 200.
 * @returns A URL that returns a PNG QR code image.
 */
export const buildQrImageUrl = (data: string, size = 200): string =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;

/**
 * Parse a join URL (full HTTPS or path-only) into its components.
 *
 * Extracts the join type (`'round'` or `'tournament'`), the entity ID,
 * and the optional host/director pubkey from the `p` query parameter.
 *
 * @param url - The URL or path to parse (e.g., `/join/round/abc123?p=deadbeef`).
 * @returns Parsed join info, or `null` if the URL doesn't match the expected pattern.
 */
export const parseJoinUrl = (url: string): { type: 'round' | 'tournament'; id: string; pubkey?: string } | null => {
  try {
    // Handle both full URLs and path-only strings
    const fullUrl = url.startsWith('http') ? url : `${APP_DOMAIN}${url.startsWith('/') ? '' : '/'}${url}`;
    const parsed = new URL(fullUrl);

    // Match /join/round/:id or /join/tournament/:id
    const match = parsed.pathname.match(/^\/join\/(round|tournament)\/([^/]+)$/);
    if (!match) return null;

    const type = match[1] as 'round' | 'tournament';
    const id = match[2];
    const pubkey = parsed.searchParams.get('p') || undefined;

    return { type, id, pubkey };
  } catch {
    return null;
  }
};
