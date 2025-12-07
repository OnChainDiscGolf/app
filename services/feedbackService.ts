/**
 * Feedback Service
 * 
 * Collects app logs, device info, and sends feedback via Gift Wrap (NIP-59)
 * to the developer's npub for review.
 */

import { nip19 } from 'nostr-tools';
import { sendDirectMessage, getSession, getRelays } from './nostrService';
import { isBreezInitialized } from './breezService';
import { getAuthSource, hasUnifiedSeed } from './mnemonicService';

// Developer's feedback npub - receives all feedback via encrypted Gift Wrap
const FEEDBACK_NPUB = 'npub1xg8nc32sw6u3m337wzhk8gs3nqmh73r86z6a93s3hetca4jvktls68qyue';
// Pre-decoded hex for the above npub (verified correct)
const FEEDBACK_HEX = '320f3c455076b91dc63e70af63a21198377f4467d0b5d2c611be578ed64cb2ff';

// Decode npub to hex pubkey
const getFeedbackPubkey = (): string => {
    try {
        const decoded = nip19.decode(FEEDBACK_NPUB);
        if (decoded.type === 'npub') {
            const hex = decoded.data as string;
            console.log('📧 Feedback will be sent to:', hex.slice(0, 8) + '...');
            return hex;
        }
    } catch (e) {
        console.error('Failed to decode feedback npub:', e);
    }
    // Fallback to pre-decoded hex
    console.log('📧 Using fallback feedback pubkey');
    return FEEDBACK_HEX;
};

// App version - update this with your build process
const APP_VERSION = '0.1.0';

// Session start time for duration tracking
const sessionStartTime = Date.now();

// Error log buffer - captures recent console errors
const errorBuffer: { timestamp: number; message: string; stack?: string }[] = [];
const MAX_ERROR_BUFFER = 50;

// Warning log buffer - captures recent console warnings
const warningBuffer: { timestamp: number; message: string }[] = [];
const MAX_WARNING_BUFFER = 30;

// Navigation history buffer
const navigationHistory: { timestamp: number; path: string }[] = [];
const MAX_NAV_HISTORY = 20;

// Initialize error capture (call once on app start)
export const initErrorCapture = () => {
    // Capture console.error
    const originalError = console.error;
    console.error = (...args) => {
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        errorBuffer.push({
            timestamp: Date.now(),
            message: message.slice(0, 500), // Limit message size
            stack: new Error().stack?.split('\n').slice(2, 6).join('\n')
        });

        // Keep buffer size limited
        while (errorBuffer.length > MAX_ERROR_BUFFER) {
            errorBuffer.shift();
        }

        originalError.apply(console, args);
    };

    // Capture console.warn
    const originalWarn = console.warn;
    console.warn = (...args) => {
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        warningBuffer.push({
            timestamp: Date.now(),
            message: message.slice(0, 300) // Limit message size
        });

        // Keep buffer size limited
        while (warningBuffer.length > MAX_WARNING_BUFFER) {
            warningBuffer.shift();
        }

        originalWarn.apply(console, args);
    };
};

// Track navigation (call from your router)
export const trackNavigation = (path: string) => {
    navigationHistory.push({
        timestamp: Date.now(),
        path
    });

    while (navigationHistory.length > MAX_NAV_HISTORY) {
        navigationHistory.shift();
    }
};

// Get device and browser info (streamlined - removed low-value fields)
const getDeviceInfo = () => {
    const ua = navigator.userAgent;

    // Detect platform
    let platform = 'Unknown';
    if (/Android/i.test(ua)) platform = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS';
    else if (/Windows/i.test(ua)) platform = 'Windows';
    else if (/Mac/i.test(ua)) platform = 'macOS';
    else if (/Linux/i.test(ua)) platform = 'Linux';

    // Detect browser
    let browser = 'Unknown';
    if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Edg/i.test(ua)) browser = 'Edge';
    else if (/Chrome/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua)) browser = 'Safari';

    // Check if PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;

    // Session duration in minutes
    const sessionMinutes = Math.round((Date.now() - sessionStartTime) / 60000);

    return {
        platform,
        browser,
        isPWA,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        online: navigator.onLine,
        sessionDuration: `${sessionMinutes} min`
    };
};

// Get app state snapshot (enhanced with wallet and auth details)
const getAppState = () => {
    try {
        // Get relevant localStorage items (not sensitive data)
        const hasActiveRound = !!localStorage.getItem('cdg_active_round');
        const mintsRaw = localStorage.getItem('cdg_mints');
        const mints = mintsRaw ? JSON.parse(mintsRaw) : [];
        const walletMode = localStorage.getItem('cdg_wallet_mode') || 'cashu';
        const authMethod = localStorage.getItem('auth_method');

        // Calculate wallet balance from proofs (without exposing proofs)
        const proofsRaw = localStorage.getItem('cdg_proofs');
        let cashuBalance = 0;
        if (proofsRaw) {
            try {
                const proofs = JSON.parse(proofsRaw);
                cashuBalance = proofs.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
            } catch { /* ignore parse errors */ }
        }

        // Auth source (more detailed than authMethod)
        const authSource = getAuthSource();

        // Check NWC connection
        const hasNwcConnection = !!localStorage.getItem('cdg_nwc_string');

        // Check Breez status
        const breezInitialized = isBreezInitialized();
        const breezLightningAddress = localStorage.getItem('cdg_breez_lightning_address') || null;

        // Unified seed status
        const unifiedSeed = hasUnifiedSeed();

        // Usage stats (counts only, no sensitive data)
        const roundHistoryRaw = localStorage.getItem('cdg_round_history');
        const roundHistoryCount = roundHistoryRaw ? JSON.parse(roundHistoryRaw).length : 0;

        const contactsRaw = localStorage.getItem('cdg_contacts');
        const contactCount = contactsRaw ? JSON.parse(contactsRaw).length : 0;

        const recentPlayersRaw = localStorage.getItem('cdg_recent_players');
        const recentPlayersCount = recentPlayersRaw ? JSON.parse(recentPlayersRaw).length : 0;

        // Gateway registrations summary
        const gatewayRaw = localStorage.getItem('gateway_registrations');
        let gatewayStatus = 'none';
        if (gatewayRaw) {
            try {
                const gateways = JSON.parse(gatewayRaw);
                const successful = gateways.filter((g: any) => g.success).length;
                gatewayStatus = `${successful}/${gateways.length} active`;
            } catch { /* ignore */ }
        }

        return {
            // Core state
            hasActiveRound,
            walletMode,

            // Auth details
            authMethod: authMethod || 'none',
            authSource: authSource || 'unknown',
            hasUnifiedSeed: unifiedSeed,

            // Wallet details
            cashuBalance: cashuBalance > 0 ? `${cashuBalance} sats` : 'Empty',
            mintCount: mints.length,
            activeMint: mints.find((m: any) => m.isActive)?.nickname || 'Unknown',
            hasNwcConnection,
            breezInitialized,
            breezLightningAddress: breezLightningAddress ? 'set' : 'none',
            gatewayStatus,

            // Usage stats
            roundHistoryCount,
            contactCount,
            recentPlayersCount
        };
    } catch (_e) {
        return { error: 'Failed to capture app state' };
    }
};

// Get recent errors
const getRecentErrors = () => {
    return errorBuffer.slice(-20).map(e => ({
        time: new Date(e.timestamp).toISOString(),
        message: e.message,
        stack: e.stack
    }));
};

// Get recent warnings
const getRecentWarnings = () => {
    return warningBuffer.slice(-15).map(w => ({
        time: new Date(w.timestamp).toISOString(),
        message: w.message
    }));
};

// Get navigation history
const getNavigationHistory = () => {
    return navigationHistory.map(n => ({
        time: new Date(n.timestamp).toISOString(),
        path: n.path
    }));
};

export interface FeedbackPayload {
    type: 'bug' | 'feedback' | 'feature';
    message: string;
    includeLogs: boolean;
    includeDeviceInfo: boolean;
    currentPath?: string;
}

export interface CollectedLogs {
    device?: ReturnType<typeof getDeviceInfo>;
    appState?: ReturnType<typeof getAppState>;
    errors?: ReturnType<typeof getRecentErrors>;
    warnings?: ReturnType<typeof getRecentWarnings>;
    navigation?: ReturnType<typeof getNavigationHistory>;
    appVersion: string;
    timestamp: string;
}

// Collect all logs
export const collectLogs = (includeDevice: boolean = true): CollectedLogs => {
    const logs: CollectedLogs = {
        appVersion: APP_VERSION,
        timestamp: new Date().toISOString()
    };

    if (includeDevice) {
        logs.device = getDeviceInfo();
    }

    logs.appState = getAppState();
    logs.errors = getRecentErrors();
    logs.warnings = getRecentWarnings();
    logs.navigation = getNavigationHistory();

    return logs;
};

// Send feedback via encrypted DM (kind 4)
export const sendFeedback = async (payload: FeedbackPayload): Promise<{ success: boolean; error?: string }> => {
    try {
        console.log('📤 Starting feedback send...');

        const session = getSession();
        if (!session?.sk) {
            console.error('❌ No session/secret key found');
            return { success: false, error: 'Not logged in. Please create a profile first.' };
        }
        console.log('✓ Session found, sender pubkey:', session.pk?.slice(0, 8) + '...');

        const feedbackPubkey = getFeedbackPubkey();
        const relays = getRelays();
        console.log('✓ Target pubkey:', feedbackPubkey.slice(0, 8) + '...');
        console.log('✓ Relays:', relays.slice(0, 3).join(', '), `... (${relays.length} total)`);

        // Build the feedback content
        const feedbackContent: any = {
            type: payload.type,
            message: payload.message,
            currentPath: payload.currentPath || window.location.pathname,
            sentAt: new Date().toISOString()
        };

        // Add logs if requested
        if (payload.includeLogs) {
            feedbackContent.logs = collectLogs(payload.includeDeviceInfo);
        } else if (payload.includeDeviceInfo) {
            feedbackContent.device = getDeviceInfo();
        }

        console.log('✓ Feedback content prepared, type:', payload.type);

        // Format as readable message with JSON payload
        const messageText = `📬 FEEDBACK (${payload.type.toUpperCase()})\n\n${payload.message}\n\n---\n${JSON.stringify(feedbackContent, null, 2)}`;

        // Send as encrypted DM (kind 4) - universally supported
        console.log('📧 Sending via encrypted DM (kind 4)...');
        const event = await sendDirectMessage(feedbackPubkey, messageText);

        console.log('✅ Feedback sent successfully!');
        console.log('   Event ID:', event.id);
        console.log('   To:', FEEDBACK_NPUB);
        return { success: true };

    } catch (error) {
        console.error('❌ Failed to send feedback:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send feedback'
        };
    }
};

// Check if user can send feedback (has session with secret key)
export const canSendFeedback = (): boolean => {
    const session = getSession();
    return !!(session?.sk);
};

