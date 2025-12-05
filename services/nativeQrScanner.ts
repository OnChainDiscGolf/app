/**
 * Native QR Scanner Service
 * Uses @capacitor-mlkit/barcode-scanning for native camera-based QR scanning
 * Falls back to web-based scanning when native is not available
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

export interface ScanResult {
    success: boolean;
    data?: string;
    error?: string;
    cancelled?: boolean;
}

/**
 * Check if native scanning is supported
 */
export const isNativeScanningSupported = (): boolean => {
    return Capacitor.isNativePlatform();
};

/**
 * Check if the scanner module is available
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
 * Check and request camera permissions
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
 * Request camera permissions
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
 * Start native QR code scanning
 * Returns a promise that resolves when a code is scanned or cancelled
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
 * Check if Google Barcode Scanner module is available (Android only)
 * This is required for newer Android devices
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
 * Install Google Barcode Scanner module (Android only)
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
 * Open app settings (useful when permissions are permanently denied)
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





