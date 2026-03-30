/**
 * @file useQrScanner.ts
 * @description Hook for QR code scanning with automatic platform detection.
 * Uses the Capacitor native barcode scanner (Google Barcode Scanner module)
 * on Android/iOS, and falls back to a web-based scanner using the camera
 * MediaStream API + jsQR library on desktop/PWA.
 *
 * The web scanner continuously reads frames from a video element, draws them
 * to an off-screen canvas, and runs jsQR on the pixel data every animation frame.
 *
 * The native scanner delegates to the OS barcode scanning UI and returns results
 * via a one-shot promise.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import {
    isNativeScanningSupported,
    isScannerAvailable,
    startNativeScan,
    checkPermissions,
    requestPermissions,
    isGoogleBarcodeScannerModuleAvailable,
    installGoogleBarcodeScannerModule,
    openSettings
} from '../services/nativeQrScanner';

/**
 * Props for the {@link useQrScanner} hook.
 *
 * @property videoRef - Ref to the `<video>` element used by the web scanner.
 * @property canvasRef - Ref to the `<canvas>` element for frame analysis.
 * @property onScan - Callback invoked with the decoded QR data string.
 * @property active - Whether scanning should be active. Starts/stops the scanner.
 */
interface UseQrScannerProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    onScan?: (data: string) => void;
    active: boolean;
}

/**
 * Return type for the {@link useQrScanner} hook.
 *
 * @property isCameraLoading - Whether the camera is initializing.
 * @property cameraError - Error message if camera access failed, or null.
 * @property scannedData - The last decoded QR data string, or null.
 * @property restart - Function to restart the scanner (web or native).
 * @property logs - Timestamped debug log messages.
 * @property isNativeScanner - Whether the native scanner is being used.
 * @property startNativeScan - Triggers a native scan (user-initiated).
 * @property permissionStatus - Current camera permission state.
 * @property openAppSettings - Opens the OS app settings for permission management.
 */
interface UseQrScannerReturn {
    isCameraLoading: boolean;
    cameraError: string | null;
    scannedData: string | null;
    restart: () => void;
    logs: string[];
    isNativeScanner: boolean;
    startNativeScan: () => Promise<void>;
    permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
    openAppSettings: () => Promise<void>;
}

/**
 * QR code scanner hook with native/web platform detection.
 *
 * On mount, checks for Capacitor native scanning support. If available (and
 * the Google Barcode Scanner module is installed), sets `isNativeScanner=true`
 * and waits for user-initiated `startNativeScan()` calls. Otherwise, falls
 * back to a web scanner that requests the device camera, streams to a video
 * element, and runs jsQR per animation frame.
 *
 * The `onScan` callback is stored in a ref to prevent scanner restarts when
 * the callback identity changes.
 *
 * @param props - {@link UseQrScannerProps}
 * @returns {@link UseQrScannerReturn}
 */
export const useQrScanner = ({ videoRef, canvasRef, onScan, active }: UseQrScannerProps): UseQrScannerReturn => {
    const [isCameraLoading, setIsCameraLoading] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [isNativeScanner, setIsNativeScanner] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
    const [nativeReady, setNativeReady] = useState(false);

    const log = (msg: string) => {
        const timestampedMsg = `${new Date().toISOString().split('T')[1].slice(0, 8)}: ${msg}`;
        setLogs(prev => [...prev.slice(-8), timestampedMsg]);
        console.log(`[QRScanner] ${msg}`);
    };

    // Internal refs to track state across async operations and renders
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const initializationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);

    // Use a ref for the callback to prevent restarting the scanner when the callback function identity changes
    const onScanRef = useRef(onScan);
    useEffect(() => {
        onScanRef.current = onScan;
    }, [onScan]);

    // Check if native scanning is available on mount
    useEffect(() => {
        const checkNativeSupport = async () => {
            if (isNativeScanningSupported()) {
                log("Checking native scanner support...");
                const available = await isScannerAvailable();
                
                if (available) {
                    // On Android, check if Google Barcode Scanner module is available
                    const moduleAvailable = await isGoogleBarcodeScannerModuleAvailable();
                    if (!moduleAvailable) {
                        log("Installing Google Barcode Scanner module...");
                        const installed = await installGoogleBarcodeScannerModule();
                        if (!installed) {
                            log("Module installation failed, falling back to web scanner");
                            setIsNativeScanner(false);
                            setNativeReady(false);
                            return;
                        }
                    }
                    
                    log("Native scanner available");
                    setIsNativeScanner(true);
                    setNativeReady(true);
                    
                    // Check permissions
                    const perm = await checkPermissions();
                    setPermissionStatus(perm);
                    log(`Permission status: ${perm}`);
                } else {
                    log("Native scanner not supported, using web scanner");
                    setIsNativeScanner(false);
                    setNativeReady(false);
                }
            } else {
                log("Not a native platform, using web scanner");
                setIsNativeScanner(false);
                setNativeReady(false);
            }
        };

        checkNativeSupport();
    }, []);

    const stopScanner = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (initializationTimeoutRef.current) {
            clearTimeout(initializationTimeoutRef.current);
            initializationTimeoutRef.current = null;
        }
    }, []);

    const tick = useCallback(() => {
        if (!isMountedRef.current || !active) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });

                if (code && code.data) {
                    setScannedData(code.data);
                    if (onScanRef.current) onScanRef.current(code.data);
                }
            }
        }

        animationFrameRef.current = requestAnimationFrame(tick);
    }, [active, videoRef, canvasRef]);

    // Native scan function
    const handleNativeScan = useCallback(async () => {
        if (!nativeReady) {
            log("Native scanner not ready");
            return;
        }

        setIsCameraLoading(true);
        setCameraError(null);
        log("Starting native scan...");

        try {
            // Check and request permissions if needed
            let perm = await checkPermissions();
            if (perm !== 'granted') {
                log("Requesting camera permission...");
                perm = await requestPermissions();
                setPermissionStatus(perm);
                
                if (perm !== 'granted') {
                    setCameraError("Camera permission denied. Please enable camera access in settings.");
                    setIsCameraLoading(false);
                    return;
                }
            }

            const result = await startNativeScan();
            
            if (result.success && result.data) {
                log(`Scanned: ${result.data.substring(0, 30)}...`);
                setScannedData(result.data);
                if (onScanRef.current) {
                    onScanRef.current(result.data);
                }
            } else if (result.cancelled) {
                log("Scan cancelled by user");
            } else if (result.error) {
                log(`Scan error: ${result.error}`);
                setCameraError(result.error);
            }
        } catch (error: any) {
            log(`Native scan error: ${error.message}`);
            setCameraError(error.message || "Scanner error");
        } finally {
            setIsCameraLoading(false);
        }
    }, [nativeReady]);

    // Web-based scanner start function
    const startWebScanner = useCallback(async (retryCount = 0) => {
        if (!active || isNativeScanner) return;

        if (retryCount === 0) log("Starting web scanner...");

        // Start safety timeout to prevent hanging the UI
        const timeoutId = setTimeout(() => {
            log("Initialization timeout reached!");
            setCameraError("CameraInitTimeout - Initialization took too long.");
            setIsCameraLoading(false);
            stopScanner();
        }, 5000);

        // Check if video ref is ready
        if (!videoRef.current) {
            if (retryCount < 10) {
                setTimeout(() => startWebScanner(retryCount + 1), 100);
                return;
            } else {
                setCameraError("Camera initialization failed (Video Element Missing).");
                clearTimeout(timeoutId);
                return;
            }
        }

        // Clear any previous attempts or errors
        setCameraError(null);
        setIsCameraLoading(true);
        stopScanner();

        try {
            let mediaStream: MediaStream;

            // Aggressive Camera Request (Generic first, then Environment fallback)
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
                log("Generic camera acquired");
            } catch (genericError) {
                try {
                    mediaStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment' }
                    });
                    log("Environment camera acquired via fallback");
                } catch (envError) {
                    throw envError;
                }
            }

            // --- SUCCESS PATH ---
            clearTimeout(timeoutId);

            streamRef.current = mediaStream;
            const video = videoRef.current;
            video.srcObject = mediaStream;

            // Robust play handling - Suppress AbortError
            try {
                await video.play();
                log("Video playing");
                setIsCameraLoading(false);
                animationFrameRef.current = requestAnimationFrame(tick);
            } catch (playError) {
                if ((playError as any).name === 'AbortError') {
                    log("Play aborted (harmless race condition)");
                    setIsCameraLoading(false);
                    return;
                }
                throw playError;
            }

        } catch (err) {
            // --- FAILURE PATH ---
            const errorName = (err as any).name || 'UnknownError';
            clearTimeout(timeoutId);
            stopScanner();

            log(`Critical Error: ${errorName}`);

            setCameraError(errorName === 'NotAllowedError' ? "Access Denied: Check OS/Browser permissions." : `Camera failed: ${errorName}`);
            setIsCameraLoading(false);
        }
    }, [active, isNativeScanner, stopScanner, tick, videoRef]);

    // Main effect to start/stop scanner based on active state
    useEffect(() => {
        isMountedRef.current = true;

        if (active) {
            if (isNativeScanner && nativeReady) {
                // Don't auto-start native scanner - it's triggered by user action
                log("Native scanner ready - waiting for user to initiate scan");
            } else if (!isNativeScanner) {
                // Start web scanner automatically
                startWebScanner();
            }
        } else {
            stopScanner();
        }

        return () => {
            isMountedRef.current = false;
            stopScanner();
        };
    }, [active, isNativeScanner, nativeReady, startWebScanner, stopScanner]);

    const handleOpenSettings = useCallback(async () => {
        await openSettings();
    }, []);

    return {
        isCameraLoading,
        cameraError,
        scannedData,
        restart: () => isNativeScanner ? handleNativeScan() : startWebScanner(0),
        logs,
        isNativeScanner,
        startNativeScan: handleNativeScan,
        permissionStatus,
        openAppSettings: handleOpenSettings
    };
};
