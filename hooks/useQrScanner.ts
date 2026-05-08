/**
 * @file useQrScanner.ts
 * @description Hook for QR code scanning using an embedded in-app camera view.
 * Uses the MediaStream API + jsQR library on all platforms (web, iOS, Android)
 * to keep the camera feed inside the app UI rather than launching a full-screen
 * native OS scanner.
 *
 * The scanner continuously reads frames from a video element, draws them
 * to an off-screen canvas, and runs jsQR on the pixel data every animation frame.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { openSettings } from '../services/nativeQrScanner';

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
 * QR code scanner hook using an embedded in-app camera view.
 *
 * Requests the device camera via MediaStream API (preferring the rear/environment
 * camera), streams to a video element, and runs jsQR per animation frame on all
 * platforms (web, iOS, Android). The camera stays embedded in the app UI rather
 * than handing off to the OS scanner.
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
    const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

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

    // Embedded camera scanner start function
    const startWebScanner = useCallback(async (retryCount = 0) => {
        if (!active) return;

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

            // Prefer rear/environment camera for QR scanning; fall back to any camera
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                log("Environment camera acquired");
            } catch (envError) {
                console.warn("Environment camera unavailable, falling back to generic camera:", envError);
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
                log("Generic camera acquired via fallback");
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
    }, [active, stopScanner, tick, videoRef]);

    // Main effect to start/stop scanner based on active state
    useEffect(() => {
        isMountedRef.current = true;

        if (active) {
            startWebScanner();
        } else {
            stopScanner();
        }

        return () => {
            isMountedRef.current = false;
            stopScanner();
        };
    }, [active, startWebScanner, stopScanner]);

    const handleOpenSettings = useCallback(async () => {
        await openSettings();
    }, []);

    return {
        isCameraLoading,
        cameraError,
        scannedData,
        restart: () => startWebScanner(0),
        logs,
        isNativeScanner: false,
        startNativeScan: async () => {},
        permissionStatus,
        openAppSettings: handleOpenSettings
    };
};
