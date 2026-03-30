/**
 * @fileoverview Mnemonic Service -- BIP-39 seed phrase generation with NIP-06 Nostr key derivation.
 *
 * This is the most security-critical service in the app. It handles:
 * - BIP-39 mnemonic generation (12 or 24 words via @scure/bip39)
 * - NIP-06 Nostr key derivation (m/44'/1237'/0'/0/0 via @scure/bip32)
 * - Encrypted mnemonic storage in localStorage (XOR with pubkey-derived key)
 * - Auth source tracking (mnemonic, nsec, amber, nip46, legacy)
 * - Unified seed flag (same mnemonic for Nostr + Breez wallet)
 *
 * Architecture:
 * - NEW USERS: Single 12-word mnemonic -> Nostr key + Breez wallet (unified backup)
 * - EXISTING NSEC USERS: Their nsec + SEPARATE Breez mnemonic (two backups)
 * - AMBER USERS: Amber holds Nostr key + SEPARATE Breez mnemonic (two backups)
 *
 * @see NIP-06 https://github.com/nostr-protocol/nips/blob/master/06.md
 * @see BIP-39 https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
 *
 * Handles BIP-39 mnemonic generation and NIP-06 Nostr key derivation.
 * Also prepares for Breez wallet initialization with the same seed.
 * 
 * Architecture:
 * - NEW USERS: Single 12-word mnemonic → Nostr key + Breez wallet (unified backup)
 * - EXISTING NSEC USERS: Their nsec + SEPARATE Breez mnemonic (two backups)
 * - AMBER USERS: Amber holds Nostr key + SEPARATE Breez mnemonic (two backups)
 * 
 * ============================================================================
 * ⚠️⚠️⚠️ CRITICAL WARNING - WALLET RECOVERY DEPENDS ON THIS FILE ⚠️⚠️⚠️
 * ============================================================================
 * 
 * This service handles the most sensitive data in the entire application:
 * user mnemonics (seed phrases) that control their Bitcoin funds AND Nostr identity.
 * 
 * RULES FOR MODIFYING THIS FILE:
 * 
 * 1. STORAGE KEYS - NEVER CHANGE
 *    The localStorage keys below are used to store encrypted mnemonics.
 *    If you change them, users will LOSE ACCESS to their stored wallets.
 *    They would need to re-enter their mnemonic to recover.
 * 
 * 2. ENCRYPTION METHODS - NEVER CHANGE
 *    The deriveEncryptionKey and xorEncrypt functions define how mnemonics
 *    are encrypted. Changing the algorithm means existing encrypted data
 *    cannot be decrypted.
 * 
 * 3. DERIVATION PATH - NEVER CHANGE
 *    The NIP-06 derivation path is a standard. Changing it means the same
 *    mnemonic produces DIFFERENT Nostr keys, breaking user identity.
 * 
 * 4. BIP-39 WORDLIST - COMES FROM @scure/bip39
 *    Using the English wordlist. Don't change this or add custom words.
 * 
 * If you need to add NEW features, create NEW storage keys and functions.
 * Keep backward compatibility with existing stored data.
 * 
 * Last verified working: December 2024
 * ============================================================================
 */

import { generateMnemonic as bip39Generate, mnemonicToSeedSync, validateMnemonic as bip39Validate } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { getPublicKey } from 'nostr-tools';

/**
 * ⚠️ NIP-06 DERIVATION PATH - DO NOT MODIFY ⚠️
 * 
 * This is the standard Nostr key derivation path as defined in NIP-06.
 * Path: m/44'/1237'/<account>'/0/0
 * 
 * - 44' = BIP-44 purpose (HD wallets)
 * - 1237' = Nostr coin type (registered)
 * - 0' = Account 0
 * - 0/0 = External chain, first key
 * 
 * Changing this path means:
 * - Same mnemonic → Different Nostr keys
 * - Users lose their identity and followers
 * - Cannot recover existing accounts
 */
const NOSTR_DERIVATION_PATH = "m/44'/1237'/0'/0/0";

/**
 * ⚠️⚠️⚠️ STORAGE KEYS - ABSOLUTELY DO NOT CHANGE ⚠️⚠️⚠️
 * 
 * These localStorage key names are used to persist encrypted wallet data.
 * Users' wallets depend on these exact key names to recover their data.
 * 
 * CONSEQUENCES OF CHANGING THESE:
 * - Users appear to have no wallet on existing devices
 * - Encrypted mnemonics become inaccessible
 * - Users must re-enter recovery phrase manually
 * - Could lead to permanent loss of funds if user forgot phrase
 * 
 * If you need additional storage, ADD new keys, don't modify existing ones.
 */
const STORAGE_KEYS = {
    /** Encrypted Nostr/unified mnemonic - DO NOT RENAME */
    MNEMONIC_ENCRYPTED: 'cdg_mnemonic_enc',
    /** Salt for Nostr/unified mnemonic encryption - DO NOT RENAME */
    MNEMONIC_SALT: 'cdg_mnemonic_salt',
    /** Authentication source type - DO NOT RENAME */
    AUTH_SOURCE: 'cdg_auth_source', // 'mnemonic' | 'nsec' | 'amber' | 'nip46'
    /** Encrypted Breez-specific mnemonic (for non-mnemonic users) - DO NOT RENAME */
    BREEZ_MNEMONIC_ENCRYPTED: 'cdg_breez_mnemonic_enc',
    /** Salt for Breez mnemonic encryption - DO NOT RENAME */
    BREEZ_MNEMONIC_SALT: 'cdg_breez_mnemonic_salt',
    /** Flag: true if Nostr + Breez use same mnemonic - DO NOT RENAME */
    HAS_UNIFIED_SEED: 'cdg_unified_seed',
} as const; // `as const` prevents accidental modification

/** How the user authenticated -- determines backup strategy and key management */
export type AuthSource = 'mnemonic' | 'nsec' | 'amber' | 'nip46' | 'legacy';

/**
 * Generate a new 12-word BIP-39 mnemonic (128 bits of entropy).
 *
 * @returns Space-separated mnemonic phrase (12 words from BIP-39 English wordlist)
 */
export const generateMnemonic = (): string => {
    // 128 bits = 12 words
    return bip39Generate(wordlist, 128);
};

/**
 * Generate a 24-word BIP-39 mnemonic (256 bits of entropy).
 *
 * More secure but harder to back up. Used rarely.
 *
 * @returns Space-separated mnemonic phrase (24 words)
 */
export const generateMnemonic24 = (): string => {
    // 256 bits = 24 words
    return bip39Generate(wordlist, 256);
};

/**
 * Validate a BIP-39 mnemonic phrase against the English wordlist.
 *
 * Checks word count, wordlist membership, and checksum validity.
 *
 * @param mnemonic - Space-separated mnemonic phrase to validate
 * @returns True if the mnemonic is valid BIP-39
 */
export const validateMnemonic = (mnemonic: string): boolean => {
    return bip39Validate(mnemonic, wordlist);
};

/**
 * Derive Nostr keypair from mnemonic using NIP-06 standard
 * Derivation path: m/44'/1237'/0'/0/0
 * 
 * @param mnemonic - 12 or 24 word BIP-39 mnemonic
 * @returns { privateKey: Uint8Array, publicKey: string, privateKeyHex: string }
 */
export const deriveNostrKeyFromMnemonic = (mnemonic: string): {
    privateKey: Uint8Array;
    publicKey: string;
    privateKeyHex: string;
} => {
    if (!validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
    }

    // Convert mnemonic to seed (no passphrase)
    const seed = mnemonicToSeedSync(mnemonic);

    // Derive HD key
    const hdKey = HDKey.fromMasterSeed(seed);

    // Derive at NIP-06 path
    const derivedKey = hdKey.derive(NOSTR_DERIVATION_PATH);

    if (!derivedKey.privateKey) {
        throw new Error('Failed to derive private key');
    }

    const privateKey = derivedKey.privateKey;
    const privateKeyHex = bytesToHex(privateKey);
    const publicKey = getPublicKey(privateKey);

    return {
        privateKey,
        publicKey,
        privateKeyHex
    };
};

/**
 * Get the raw seed from mnemonic (for Breez SDK initialization)
 * 
 * @param mnemonic - 12 or 24 word BIP-39 mnemonic
 * @returns seed as Uint8Array
 */
export const getSeedFromMnemonic = (mnemonic: string): Uint8Array => {
    if (!validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
    }
    return mnemonicToSeedSync(mnemonic);
};

/**
 * ⚠️ ENCRYPTION KEY DERIVATION - DO NOT MODIFY ALGORITHM ⚠️
 * 
 * This function derives the encryption key used to protect stored mnemonics.
 * Uses user's public key as part of the encryption key.
 * 
 * WARNING: This algorithm MUST remain unchanged because:
 * - Existing encrypted mnemonics were encrypted with this exact algorithm
 * - Changing it = cannot decrypt existing user data
 * - Users would lose access to their wallets
 * 
 * The algorithm: XOR of pubkey bytes with salt, repeating as needed
 * Output: 32-byte key
 * 
 * NOTE: This is basic protection against casual reading.
 * For production improvements, ADD a migration path, don't replace.
 */
const deriveEncryptionKey = (pubkey: string, salt: Uint8Array): Uint8Array => {
    // ⚠️ DO NOT MODIFY - existing data encrypted with this algorithm
    // Combine pubkey and salt to create encryption key
    // Simple derivation: interleave pubkey bytes with salt
    const pubkeyBytes = new TextEncoder().encode(pubkey);
    const key = new Uint8Array(32);
    
    for (let i = 0; i < 32; i++) {
        key[i] = (pubkeyBytes[i % pubkeyBytes.length] ^ salt[i % salt.length]) & 0xFF;
    }
    
    return key;
};

/**
 * ⚠️ XOR ENCRYPTION - DO NOT MODIFY ALGORITHM ⚠️
 * 
 * XOR-based encryption for local storage.
 * Used for both encryption and decryption (XOR is symmetric).
 * 
 * WARNING: This function MUST remain unchanged because:
 * - Existing data was encrypted with this exact algorithm
 * - Changing it = cannot decrypt existing user mnemonics
 * - Key repeats cyclically for data longer than key
 * 
 * Same function works for both encrypt and decrypt due to XOR properties.
 */
const xorEncrypt = (data: Uint8Array, key: Uint8Array): Uint8Array => {
    // ⚠️ DO NOT MODIFY - existing data encrypted with this algorithm
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ key[i % key.length];
    }
    return result;
};

/**
 * Encrypt and store the mnemonic locally
 * 
 * @param mnemonic - The mnemonic to store
 * @param pubkey - User's public key (used for encryption)
 * @param isBreezMnemonic - If true, stores as separate Breez mnemonic
 */
export const storeMnemonicEncrypted = (
    mnemonic: string,
    pubkey: string,
    isBreezMnemonic: boolean = false
): void => {
    // Generate random salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = deriveEncryptionKey(pubkey, salt);

    // Encrypt mnemonic
    const mnemonicBytes = new TextEncoder().encode(mnemonic);
    const encrypted = xorEncrypt(mnemonicBytes, key);

    // Store encrypted mnemonic and salt
    const storageKeyEnc = isBreezMnemonic ? STORAGE_KEYS.BREEZ_MNEMONIC_ENCRYPTED : STORAGE_KEYS.MNEMONIC_ENCRYPTED;
    const storageKeySalt = isBreezMnemonic ? STORAGE_KEYS.BREEZ_MNEMONIC_SALT : STORAGE_KEYS.MNEMONIC_SALT;

    localStorage.setItem(storageKeyEnc, bytesToHex(encrypted));
    localStorage.setItem(storageKeySalt, bytesToHex(salt));

    console.log(`🔐 Mnemonic stored encrypted (${isBreezMnemonic ? 'Breez' : 'Nostr'})`);
};

/**
 * Retrieve and decrypt the stored mnemonic
 * 
 * @param pubkey - User's public key (used for decryption)
 * @param isBreezMnemonic - If true, retrieves Breez mnemonic
 * @returns Decrypted mnemonic or null if not found
 */
export const retrieveMnemonicEncrypted = (
    pubkey: string,
    isBreezMnemonic: boolean = false
): string | null => {
    const storageKeyEnc = isBreezMnemonic ? STORAGE_KEYS.BREEZ_MNEMONIC_ENCRYPTED : STORAGE_KEYS.MNEMONIC_ENCRYPTED;
    const storageKeySalt = isBreezMnemonic ? STORAGE_KEYS.BREEZ_MNEMONIC_SALT : STORAGE_KEYS.MNEMONIC_SALT;

    const encryptedHex = localStorage.getItem(storageKeyEnc);
    const saltHex = localStorage.getItem(storageKeySalt);

    if (!encryptedHex || !saltHex) {
        return null;
    }

    try {
        const encrypted = hexToBytes(encryptedHex);
        const salt = hexToBytes(saltHex);
        const key = deriveEncryptionKey(pubkey, salt);

        // Decrypt
        const decrypted = xorEncrypt(encrypted, key);
        const mnemonic = new TextDecoder().decode(decrypted);

        // Validate the decrypted mnemonic
        if (!validateMnemonic(mnemonic)) {
            console.error('Decrypted mnemonic is invalid - possible corruption or wrong key');
            return null;
        }

        return mnemonic;
    } catch (e) {
        console.error('Failed to decrypt mnemonic:', e);
        return null;
    }
};

/**
 * Check if the user has an encrypted mnemonic stored in localStorage.
 *
 * @param isBreezMnemonic - If true, checks for the separate Breez mnemonic
 * @returns True if an encrypted mnemonic exists
 */
export const hasStoredMnemonic = (isBreezMnemonic: boolean = false): boolean => {
    const storageKey = isBreezMnemonic ? STORAGE_KEYS.BREEZ_MNEMONIC_ENCRYPTED : STORAGE_KEYS.MNEMONIC_ENCRYPTED;
    return localStorage.getItem(storageKey) !== null;
};

/**
 * Get the authentication source (how the user logged in).
 *
 * Checks the modern storage key first, then falls back to legacy
 * `auth_method` for backward compatibility.
 *
 * @returns AuthSource type, or null if not authenticated
 */
export const getAuthSource = (): AuthSource | null => {
    const source = localStorage.getItem(STORAGE_KEYS.AUTH_SOURCE);
    if (!source) {
        // Check for legacy auth
        const authMethod = localStorage.getItem('auth_method');
        if (authMethod === 'local') return 'legacy';
        if (authMethod === 'amber') return 'amber';
        if (authMethod === 'nip46') return 'nip46';
        return null;
    }
    return source as AuthSource;
};

/**
 * Set the authentication source in localStorage.
 *
 * @param source - The auth method used for login
 */
export const setAuthSource = (source: AuthSource): void => {
    localStorage.setItem(STORAGE_KEYS.AUTH_SOURCE, source);
};

/**
 * Check if user has unified seed (Nostr + Breez from same mnemonic)
 */
export const hasUnifiedSeed = (): boolean => {
    return localStorage.getItem(STORAGE_KEYS.HAS_UNIFIED_SEED) === 'true';
};

/**
 * Set unified seed flag
 */
export const setUnifiedSeed = (unified: boolean): void => {
    localStorage.setItem(STORAGE_KEYS.HAS_UNIFIED_SEED, unified ? 'true' : 'false');
};

/**
 * Clear all mnemonic-related storage
 */
export const clearMnemonicStorage = (): void => {
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    console.log('🧹 Mnemonic storage cleared');
};

/**
 * Generate a new identity from mnemonic
 * This is the main function for new user onboarding
 * 
 * @returns Object with mnemonic and derived keys
 */
export const generateNewIdentity = (): {
    mnemonic: string;
    privateKey: Uint8Array;
    publicKey: string;
    privateKeyHex: string;
} => {
    const mnemonic = generateMnemonic();
    const keys = deriveNostrKeyFromMnemonic(mnemonic);

    return {
        mnemonic,
        ...keys
    };
};

/**
 * Create identity from existing mnemonic (recovery flow)
 */
export const recoverIdentityFromMnemonic = (mnemonic: string): {
    privateKey: Uint8Array;
    publicKey: string;
    privateKeyHex: string;
} | null => {
    if (!validateMnemonic(mnemonic)) {
        return null;
    }

    return deriveNostrKeyFromMnemonic(mnemonic);
};

/**
 * Split mnemonic into word array for display
 */
export const splitMnemonicToWords = (mnemonic: string): string[] => {
    return mnemonic.trim().split(/\s+/);
};

/**
 * Join words back into mnemonic
 */
export const joinWordsToMnemonic = (words: string[]): string => {
    return words.map(w => w.trim().toLowerCase()).join(' ');
};

/**
 * Get a random subset of word indices for backup verification
 * Returns indices (0-based) for user to verify
 */
export const getVerificationIndices = (wordCount: number, verifyCount: number = 3): number[] => {
    const indices: number[] = [];
    while (indices.length < verifyCount) {
        const idx = Math.floor(Math.random() * wordCount);
        if (!indices.includes(idx)) {
            indices.push(idx);
        }
    }
    return indices.sort((a, b) => a - b);
};

// Export storage keys for external use if needed
export { STORAGE_KEYS };

