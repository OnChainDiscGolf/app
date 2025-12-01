/**
 * Feedback Service
 * 
 * Collects app logs, device info, and sends feedback via Gift Wrap (NIP-59)
 * to the developer's npub for review.
 */

import { nip19 } from 'nostr-tools';
import { sendGiftWrap } from './giftWrapService';
import { getSession, getRelays } from './nostrService';

// Developer's feedback npub - receives all feedback via encrypted Gift Wrap
const FEEDBACK_NPUB = 'npub1xg8nc32sw6u3m337wzhk8gs3nqmh73r86z6a93s3hetca4jvktls68qyue';

// Decode npub to hex pubkey
const getFeedbackPubkey = (): string => {
    try {
        const decoded = nip19.decode(FEEDBACK_NPUB);
        if (decoded.type === 'npub') {
            return decoded.data as string;
        }
    } catch (e) {
        console.error('Failed to decode feedback npub:', e);
    }
    // Fallback hex (pre-decoded)
    return '3207cf1150ed7239c67ce15ec7441199defc88cf684eba5884bcbc7b5932cb7f';
};

// App version - update this with your build process
const APP_VERSION = '0.1.0';

// Error log buffer - captures recent console errors
const errorBuffer: { timestamp: number; message: string; stack?: string }[] = [];
const MAX_ERROR_BUFFER = 50;

// Navigation history buffer
const navigationHistory: { timestamp: number; path: string }[] = [];
const MAX_NAV_HISTORY = 20;

// Initialize error capture (call once on app start)
export const initErrorCapture = () => {
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

// Get device and browser info
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
    
    return {
        platform,
        browser,
        isPWA,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        pixelRatio: window.devicePixelRatio,
        language: navigator.language,
        online: navigator.onLine,
        userAgent: ua.slice(0, 200) // Truncate UA
    };
};

// Get app state snapshot
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
        let walletBalance = 0;
        if (proofsRaw) {
            try {
                const proofs = JSON.parse(proofsRaw);
                walletBalance = proofs.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
            } catch { }
        }
        
        return {
            hasActiveRound,
            walletMode,
            authMethod: authMethod || 'none',
            mintCount: mints.length,
            activeMint: mints.find((m: any) => m.isActive)?.nickname || 'Unknown',
            walletBalance: walletBalance > 0 ? `${walletBalance} sats` : 'Empty'
        };
    } catch (e) {
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
    logs.navigation = getNavigationHistory();
    
    return logs;
};

// Send feedback via Gift Wrap
export const sendFeedback = async (payload: FeedbackPayload): Promise<{ success: boolean; error?: string }> => {
    try {
        const session = getSession();
        if (!session?.sk) {
            return { success: false, error: 'Not logged in. Please create a profile first.' };
        }
        
        const feedbackPubkey = getFeedbackPubkey();
        const relays = getRelays();
        
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
        
        // Send as Gift Wrap (encrypted, private)
        await sendGiftWrap(
            JSON.stringify(feedbackContent, null, 2),
            session.sk,
            feedbackPubkey,
            relays,
            14 // Kind 14 = chat message
        );
        
        console.log('✅ Feedback sent successfully');
        return { success: true };
        
    } catch (error) {
        console.error('Failed to send feedback:', error);
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

