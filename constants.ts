/**
 * @file Application-wide constants for On-Chain Disc Golf.
 *
 * Contains game defaults (hole count, par), course/player presets used for
 * demo and quick-start flows, and external service configuration (Breez SDK).
 *
 * WARNING: Some values in this file are critical for wallet functionality.
 * See individual JSDoc comments before modifying.
 */

// ============================================================================
// GAME DEFAULTS
// ============================================================================

/**
 * Default number of holes for a new round when no course preset is selected.
 * Standard disc golf courses are 9 or 18 holes.
 */
export const DEFAULT_HOLE_COUNT = 18;

/**
 * Default par per hole used when computing total course par.
 * Most disc golf holes are par 3; the total course par is derived as
 * `DEFAULT_PAR * holeCount` unless overridden by a course preset.
 */
export const DEFAULT_PAR = 3;

/**
 * Well-known disc golf courses offered as quick-select options during round
 * setup. Each entry provides the course name and its total par so users can
 * skip manual configuration.
 */
export const COURSE_PRESETS = [
  { name: "Oak Grove", par: 54 },
  { name: "Blue Ribbon Pines", par: 62 },
  { name: "Maple Hill", par: 60 },
  { name: "DeLaVeaga", par: 58 },
];

/**
 * Placeholder player entries used for demo and onboarding flows.
 * Names reference top professional disc golfers; handicaps are illustrative.
 */
export const SAMPLE_PLAYERS = [
  { name: "Paul McBeth", handicap: -5 },
  { name: "Ricky Wysocki", handicap: -4 },
  { name: "Simon Lizotte", handicap: -3 },
  { name: "Calvin Heimburg", handicap: -3 },
];

/**
 * Placeholder LNURL-encoded string used in development/demo contexts when a
 * real Lightning invoice or payment QR code is not yet available.
 */
export const MOCK_QR_CODE = "lnurl1dp68gurn8ghj7um5v93kketj9ehx2amn9uh8wetvdskkkmn0wah22efd95mnw7r95a5";

// ============================================================================
// BREEZ SDK CONFIGURATION
// ============================================================================

/**
 * Breez SDK API Key -- loaded from the `VITE_BREEZ_API_KEY` environment variable.
 *
 * This is a PEM-encoded X.509 certificate used to authenticate with Breez
 * services (Greenlight LSP). Set it in your `.env` file (see `.env.example`).
 * If missing or empty, Breez wallet features will not initialize and the user
 * will be limited to Cashu and NWC wallet modes.
 *
 * @see {@link ../services/breezService.ts}
 */
export const BREEZ_API_KEY = import.meta.env.VITE_BREEZ_API_KEY || '';