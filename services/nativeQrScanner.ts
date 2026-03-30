/**
 * @fileoverview Native QR Scanner Service -- ML Kit barcode scanning with web fallback.
 *
 * Wraps @capacitor-mlkit/barcode-scanning to provide native camera-based QR
 * scanning on Android/iOS. On web, scanning is handled elsewhere (html5-qrcode).
 *
 * Used for:
 * - Scanning round/tournament join QR codes
 * - Scanning Cashu tokens and Lightning invoices
 * - Scanning npub/nsec for player lookup
 *
 * The scanner module is dynamically imported to avoid bundling ML Kit on web.
 * Google Barcode Scanner module may need to be installed on newer Android devices.
 *
 * @see https://github.com/nicklucas/capacitor-mlkit
 */

import { Capacitor } from '@capacitor/core';

// Dynamic import to avoid issues on web
let BarcodeScanner: any = null;
let BarcodeFormat: any = null;
let LensFacing: any = null;

// Initialize the scanner module
const initScanner = async () => {
    if (BarcodeScanner) return true;
    
    try {
        const module = await import('@capacitor-mlkit/barcode-scanning');
        BarcodeScanner = module.BarcodeScanner;
        BarcodeFormat = module.BarcodeFormat;
        LensFacing = module.LensFacing;
        return true;
    } catch (error) {
        console.warn('[NativeQRScanner] ML Kit module not available:', error);
        return false;
    }
};

/** Result of a QR scan attempt */
export interface ScanResult {
    /** Whether a QR code was successfully read */
    success: boolean;
    /** The decoded QR code data (URL, token, invoice, etc.) */
    data?: string;
    /** Error message if the scan failed */
    error?: string;
    /** True if the user cancelled the scan */
    cancelled?: boolean;
}

/**
 * Check if native scanning is supported on the current platform.
 *
 * @returns True if running in a native Capacitor shell (iOS/Android)
 */
export const isNativeScanningSupported = (): boolean => {
    return Capacitor.isNativePlatform();
};

/**
 * Check if the ML Kit scanner module is loaded and hardware-supported.
 *
 * @returns True if native scanning can be used on this device
 */
export const isScannerAvailable = async (): Promise<boolean> => {
    if (!isNativeScanningSupported()) return false;
    
    try {
        await initScanner();
        if (!BarcodeScanner) return false;
        
        const result = await BarcodeScanner.isSupported();
        return result.supported;
    } catch (error) {
        console.warn('[NativeQRScanner] Scanner not available:', error);
        return false;
    }
};

/**
 * Check the current camera permission status without prompting the user.
 *
 * @returns Permission state: 'granted', 'denied', or 'prompt'
 */
export const checkPermissions = async (): Promise<'granted' | 'denied' | 'prompt'> => {
    if (!isNativeScanningSupported()) return 'denied';
    
    try {
        await initScanner();
        if (!BarcodeScanner) return 'denied';
        
        const status = await BarcodeScanner.checkPermissions();
        return status.camera;
    } catch (error) {
        console.error('[NativeQRScanner] Permission check failed:', error);
        return 'denied';
    }
};

/**
 * Request camera permissions from the user via the OS permission dialog.
 *
 * @returns Resulting permission state after the prompt
 */
export const requestPermissions = async (): Promise<'granted' | 'denied' | 'prompt'> => {
    if (!isNativeScanningSupported()) return 'denied';
    
    try {
        await initScanner();
        if (!BarcodeScanner) return 'denied';
        
        const status = await BarcodeScanner.requestPermissions();
        return status.camera;
    } catch (error) {
        console.error('[NativeQRScanner] Permission request failed:', error);
        return 'denied';
    }
};

/**
 * Start native QR code scanning using the rear camera.
 *
 * Opens the ML Kit scanner UI. Automatically requests camera permissions
 * if not yet granted. Resolves when a QR code is scanned or the user cancels.
 *
 * @returns Scan result with decoded data, or error/cancellation info
 */
export const startNativeScan = async (): Promise<ScanResult> => {
    if (!isNativeScanningSupported()) {
        return { success: false, error: 'Native scanning not supported on this platform' };
    }
    
    try {
        await initScanner();
        if (!BarcodeScanner) {
            return { success: false, error: 'Scanner module not available' };
        }
        
        // Check permissions first
        const permStatus = await checkPermissions();
        if (permStatus !== 'granted') {
            const requestResult = await requestPermissions();
            if (requestResult !== 'granted') {
                return { success: false, error: 'Camera permission denied' };
            }
        }
        
        // Start the scan
        const result = await BarcodeScanner.scan({
            formats: [BarcodeFormat.QrCode],
            lensFacing: LensFacing.Back,
        });
        
        if (result.barcodes && result.barcodes.length > 0) {
            const scannedData = result.barcodes[0].rawValue || result.barcodes[0].displayValue;
            if (scannedData) {
                return { success: true, data: scannedData };
            }
        }
        
        return { success: false, cancelled: true };
    } catch (error: any) {
        console.error('[NativeQRScanner] Scan error:', error);
        
        // Check if user cancelled
        if (error.message?.includes('cancelled') || error.code === 'SCAN_CANCELED') {
            return { success: false, cancelled: true };
        }
        
        return { success: false, error: error.message || 'Scan failed' };
    }
};

/**
 * Check if the Google Barcode Scanner module is available (Android only).
 *
 * Required for newer Android devices that use Google Play Services for
 * ML Kit barcode scanning. Returns true on iOS and web (not needed).
 *
 * @returns True if the module is available or not needed on this platform
 */
export const isGoogleBarcodeScannerModuleAvailable = async (): Promise<boolean> => {
    if (!isNativeScanningSupported() || Capacitor.getPlatform() !== 'android') {
        return true; // Not needed on iOS or web
    }
    
    try {
        await initScanner();
        if (!BarcodeScanner) return false;
        
        const result = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        return result.available;
    } catch (error) {
        console.warn('[NativeQRScanner] Google Barcode Scanner check failed:', error);
        return false;
    }
};

/**
 * Install the Google Barcode Scanner module via Google Play Services (Android only).
 *
 * This downloads the ML Kit model to the device. No-op on iOS and web.
 *
 * @returns True if installation succeeded or was not needed
 */
export const installGoogleBarcodeScannerModule = async (): Promise<boolean> => {
    if (!isNativeScanningSupported() || Capacitor.getPlatform() !== 'android') {
        return true;
    }
    
    try {
        await initScanner();
        if (!BarcodeScanner) return false;
        
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        return true;
    } catch (error) {
        console.error('[NativeQRScanner] Module installation failed:', error);
        return false;
    }
};

/**
 * Open the OS app settings page so the user can manually grant camera permission.
 *
 * Useful when camera permissions have been permanently denied.
 */
export const openSettings = async (): Promise<void> => {
    try {
        await initScanner();
        if (BarcodeScanner) {
            await BarcodeScanner.openSettings();
        }
    } catch (error) {
        console.error('[NativeQRScanner] Failed to open settings:', error);
    }
};














