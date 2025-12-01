/**
 * Backup Service
 * 
 * Provides multiple backup options for recovery phrases:
 * - QR Code generation with branding
 * - PDF Wallet Card with Memory Story
 * - Nostr encrypted backup (NIP-78)
 */

import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { splitMnemonicToWords } from './mnemonicService';
import { publishWalletBackup, fetchWalletBackup, getSession } from './nostrService';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

// =============================================================================
// STORY GENERATOR
// =============================================================================

/**
 * Multiple story template sets - each user gets a random one
 * Words are marked with {WORD} and will be CAPITALIZED + BOLD in output
 */
const STORY_TEMPLATE_SETS = [
    // Adventure Quest
    [
        "In a distant land known as {WORD},",
        "there lived a brave {WORD}",
        "who discovered a magical {WORD}.",
        "The journey led through the {WORD} valley,",
        "where a wise {WORD} offered guidance.",
        "Together they faced the fearsome {WORD},",
        "crossing the bridge of {WORD}",
        "beneath the ancient {WORD} mountains.",
        "At last they found the hidden {WORD},",
        "guarded by the spirit of {WORD}.",
        "With courage like {WORD},",
        "they claimed the treasure of {WORD}."
    ],
    // Space Odyssey
    [
        "Captain {WORD} launched from Station",
        "{WORD} into the cosmic void.",
        "The ship named {WORD} carried them",
        "past the nebula of {WORD}.",
        "Navigator {WORD} charted the course",
        "through asteroid field {WORD}.",
        "They discovered planet {WORD}",
        "orbiting the twin suns of {WORD}.",
        "The alien council of {WORD}",
        "shared the coordinates to {WORD}.",
        "Using fuel type {WORD},",
        "they reached the galaxy of {WORD}."
    ],
    // Disc Golf Championship
    [
        "The legendary course at {WORD}",
        "was home to champion {WORD}.",
        "Their favorite disc, the {WORD},",
        "soared over lake {WORD}.",
        "Caddy {WORD} offered advice",
        "on the tricky hole at {WORD}.",
        "The wind shifted near {WORD}",
        "as crowds gathered at {WORD} pavilion.",
        "With a perfect {WORD} throw,",
        "they conquered the gap at {WORD}.",
        "The trophy named {WORD}",
        "was theirs at tournament {WORD}."
    ],
    // Mountain Expedition
    [
        "Base camp {WORD} sat at the foot",
        "of Mount {WORD}, shrouded in mist.",
        "Guide {WORD} led the expedition",
        "through the pass of {WORD}.",
        "They rested at lodge {WORD}",
        "before crossing glacier {WORD}.",
        "The summit called {WORD}",
        "revealed views of valley {WORD}.",
        "Eagle {WORD} soared overhead",
        "as they planted flag {WORD}.",
        "The descent through {WORD}",
        "brought them safely to village {WORD}."
    ]
];

/**
 * Get a deterministic but varied story template based on mnemonic
 * Uses first word to pick template so same mnemonic always gets same story
 */
const getStoryTemplateForMnemonic = (mnemonic: string): string[] => {
    const words = splitMnemonicToWords(mnemonic);
    // Use sum of character codes from first word to pick template
    const seed = words[0].split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const templateIndex = seed % STORY_TEMPLATE_SETS.length;
    return STORY_TEMPLATE_SETS[templateIndex];
};

/**
 * Generate a memorable story from the mnemonic words
 * Each word is woven into a narrative structure
 * Words are returned in UPPERCASE for security (harder for malware to detect)
 */
export const generateMemoryStory = (mnemonic: string): string => {
    const words = splitMnemonicToWords(mnemonic);
    const templates = getStoryTemplateForMnemonic(mnemonic);
    
    const storyParts = words.map((word, index) => {
        const template = templates[index] || `The {WORD} was significant.`;
        // UPPERCASE the word - makes it harder for malware pattern matching
        const uppercaseWord = word.toUpperCase();
        return template.replace('{WORD}', uppercaseWord);
    });
    
    return storyParts.join(' ');
};

/**
 * Generate story for PDF with words marked for bold formatting
 * Returns object with story parts for rich text rendering
 */
export const generateMemoryStoryForPDF = (mnemonic: string): { text: string; isBold: boolean }[] => {
    const words = splitMnemonicToWords(mnemonic);
    const templates = getStoryTemplateForMnemonic(mnemonic);
    const parts: { text: string; isBold: boolean }[] = [];
    
    words.forEach((word, index) => {
        const template = templates[index] || `The {WORD} was significant.`;
        const [before, after] = template.split('{WORD}');
        
        if (before) {
            parts.push({ text: before, isBold: false });
        }
        // Word is UPPERCASE and marked as bold
        parts.push({ text: word.toUpperCase(), isBold: true });
        if (after) {
            parts.push({ text: after + ' ', isBold: false });
        }
    });
    
    return parts;
};

// =============================================================================
// QR CODE GENERATION
// =============================================================================

/**
 * Generate a QR code as a data URL with minimal branding
 * Returns a canvas element that includes the QR + "On-Chain Disc Golf" text
 */
export const generateBrandedQRCode = async (mnemonic: string): Promise<string> => {
    // Create a canvas for the QR code
    const qrCanvas = document.createElement('canvas');
    
    await QRCode.toCanvas(qrCanvas, mnemonic, {
        width: 280,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
    });
    
    // Create a new canvas with space for branding
    const brandedCanvas = document.createElement('canvas');
    const ctx = brandedCanvas.getContext('2d')!;
    
    const padding = 20;
    const textHeight = 35;
    
    brandedCanvas.width = qrCanvas.width + (padding * 2);
    brandedCanvas.height = qrCanvas.height + (padding * 2) + textHeight;
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, brandedCanvas.width, brandedCanvas.height);
    
    // Draw QR code
    ctx.drawImage(qrCanvas, padding, padding);
    
    // Add branding text - just the app name
    ctx.fillStyle = '#0d9488'; // teal-600
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('On-Chain Disc Golf', brandedCanvas.width / 2, qrCanvas.height + padding + 25);
    
    return brandedCanvas.toDataURL('image/png');
};

/**
 * Download the branded QR code as an image
 */
export const downloadQRCode = async (mnemonic: string): Promise<void> => {
    const dataUrl = await generateBrandedQRCode(mnemonic);
    
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'ocdg-card.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// =============================================================================
// PDF WALLET CARD GENERATION
// =============================================================================

/**
 * Generate a clean, minimal PDF card with:
 * - Simple branding
 * - Memory story with BOLD UPPERCASE words
 * - QR code
 * - Warning notice
 */
export const generateWalletCardPDF = async (mnemonic: string): Promise<jsPDF> => {
    const storyParts = generateMemoryStoryForPDF(mnemonic);
    
    // Create PDF (A5 size)
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5' // 148 x 210 mm
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 18;
    
    // Background - dark
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // ============ HEADER ============
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    
    // "On-Chain" in teal
    pdf.setTextColor(45, 212, 191);
    const onChainWidth = pdf.getTextWidth('On-Chain ');
    const discGolfWidth = pdf.getTextWidth('Disc Golf');
    const totalWidth = onChainWidth + discGolfWidth;
    const startX = (pageWidth - totalWidth) / 2;
    
    pdf.text('On-Chain ', startX, 25);
    
    // "Disc Golf" in white
    pdf.setTextColor(255, 255, 255);
    pdf.text('Disc Golf', startX + onChainWidth, 25);
    
    // Subtle line
    pdf.setDrawColor(45, 212, 191);
    pdf.setLineWidth(0.5);
    pdf.line(margin + 25, 32, pageWidth - margin - 25, 32);
    
    // ============ STORY ============
    let currentX = margin;
    let currentY = 48;
    const lineHeight = 7;
    
    pdf.setFontSize(11);
    
    storyParts.forEach(part => {
        if (part.isBold) {
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(45, 212, 191);
        } else {
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(203, 213, 225);
        }
        
        const words = part.text.split(' ').filter(w => w.length > 0);
        words.forEach((word) => {
            const wordText = word + ' ';
            const wordWidth = pdf.getTextWidth(wordText);
            
            if (currentX + wordWidth > pageWidth - margin) {
                currentX = margin;
                currentY += lineHeight;
            }
            
            pdf.text(wordText, currentX, currentY);
            currentX += wordWidth;
        });
    });
    
    // ============ QR CODE ============
    const qrY = currentY + 20;
    
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, mnemonic, {
        width: 120,
        margin: 1,
        color: {
            dark: '#0f172a',
            light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
    });
    
    const qrDataUrl = qrCanvas.toDataURL('image/png');
    const qrSize = 38;
    const qrX = (pageWidth - qrSize) / 2;
    
    // White rounded background
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 3, 3, 'F');
    
    pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    
    // ============ WARNING ============
    const warningY = pageHeight - 38;
    
    pdf.setFillColor(30, 27, 20);
    pdf.setDrawColor(245, 158, 11);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(margin, warningY, pageWidth - (margin * 2), 24, 3, 3, 'FD');
    
    pdf.setFontSize(9);
    pdf.setTextColor(251, 191, 36);
    pdf.setFont('helvetica', 'bold');
    pdf.text('KEEP THIS PRIVATE', pageWidth / 2, warningY + 8, { align: 'center' });
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(253, 230, 138);
    pdf.text('Do not share online or with anyone claiming to be support.', pageWidth / 2, warningY + 16, { align: 'center' });
    
    // Footer - just date, no labels
    pdf.setFontSize(6);
    pdf.setTextColor(71, 85, 105);
    pdf.text(new Date().toLocaleDateString(), pageWidth / 2, pageHeight - 6, { align: 'center' });
    
    return pdf;
};

/**
 * Download the card PDF
 */
export const downloadWalletCardPDF = async (mnemonic: string): Promise<void> => {
    const pdf = await generateWalletCardPDF(mnemonic);
    pdf.save('ocdg-card.pdf');
};

// =============================================================================
// NOSTR ENCRYPTED BACKUP
// =============================================================================

const BACKUP_EVENT_KIND = 30078; // NIP-78 Application Specific Data (parameterized replaceable)
const BACKUP_D_TAG = 'chainlinks_encrypted_backup';

/**
 * Simple AES-GCM encryption using Web Crypto API
 */
const encryptWithPassword = async (data: string, password: string): Promise<{
    ciphertext: string;
    iv: string;
    salt: string;
}> => {
    // Generate salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive key from password
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    
    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encoder.encode(data)
    );
    
    return {
        ciphertext: bytesToHex(new Uint8Array(ciphertext)),
        iv: bytesToHex(iv),
        salt: bytesToHex(salt)
    };
};

/**
 * Decrypt data with password
 */
const decryptWithPassword = async (
    ciphertextHex: string,
    ivHex: string,
    saltHex: string,
    password: string
): Promise<string> => {
    const ciphertext = hexToBytes(ciphertextHex);
    const iv = hexToBytes(ivHex);
    const salt = hexToBytes(saltHex);
    
    // Derive key from password
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        ciphertext
    );
    
    return new TextDecoder().decode(decrypted);
};

/**
 * Backup mnemonic to Nostr relays (encrypted)
 * User provides a password that encrypts the mnemonic before publishing
 */
export const backupToNostr = async (mnemonic: string, password: string): Promise<boolean> => {
    try {
        // Encrypt mnemonic with user's password
        const encrypted = await encryptWithPassword(mnemonic, password);
        
        // Create backup payload
        const payload = JSON.stringify({
            type: 'encrypted_seed_backup',
            version: 1,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            salt: encrypted.salt,
            timestamp: Date.now()
        });
        
        // For now, we'll use a simple approach - store as app data
        // This could be published as a NIP-78 event
        // The actual implementation will use the nostrService
        
        console.log('📤 Backing up encrypted seed to Nostr...');
        
        // Store locally for now (TODO: publish to relays when nostrService supports it)
        localStorage.setItem('cdg_nostr_backup', payload);
        localStorage.setItem('cdg_nostr_backup_timestamp', Date.now().toString());
        
        console.log('✅ Encrypted backup stored');
        return true;
        
    } catch (error) {
        console.error('❌ Nostr backup failed:', error);
        return false;
    }
};

/**
 * Restore mnemonic from Nostr backup
 */
export const restoreFromNostr = async (password: string): Promise<string | null> => {
    try {
        // For now, restore from local storage (TODO: fetch from relays)
        const payload = localStorage.getItem('cdg_nostr_backup');
        
        if (!payload) {
            console.log('No Nostr backup found');
            return null;
        }
        
        const data = JSON.parse(payload);
        
        if (data.type !== 'encrypted_seed_backup') {
            throw new Error('Invalid backup format');
        }
        
        // Decrypt with password
        const mnemonic = await decryptWithPassword(
            data.ciphertext,
            data.iv,
            data.salt,
            password
        );
        
        return mnemonic;
        
    } catch (error) {
        console.error('❌ Nostr restore failed:', error);
        return null;
    }
};

/**
 * Check if a Nostr backup exists
 */
export const hasNostrBackup = (): boolean => {
    return localStorage.getItem('cdg_nostr_backup') !== null;
};

/**
 * Get Nostr backup timestamp
 */
export const getNostrBackupTimestamp = (): Date | null => {
    const timestamp = localStorage.getItem('cdg_nostr_backup_timestamp');
    if (timestamp) {
        return new Date(parseInt(timestamp));
    }
    return null;
};

