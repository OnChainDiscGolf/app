import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';

interface UseQrScannerProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    onScan?: (data: string) => void;
    active: boolean;
}

export const useQrScanner = ({ videoRef, canvasRef, onScan, active }: UseQrScannerProps) => {
    const [isCameraLoading, setIsCameraLoading] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

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
                    // We don't stop automatically, let the parent decide
                }
            }
        }

        animationFrameRef.current = requestAnimationFrame(tick);
    }, [active, videoRef, canvasRef]); // Removed onScan from dependencies

    const startScanner = useCallback(async (retryCount = 0) => {
        if (!active) return;

        if (retryCount === 0) log("Starting scanner...");

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
                setTimeout(() => startScanner(retryCount + 1), 100);
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
        stopScanner(); // Stop old tracks, but clear timeout *after* this section

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
                    throw envError; // Throw the specific error if both fail
                }
            }

            // --- SUCCESS PATH ---

            // Clear the external timeout as acquisition was successful
            clearTimeout(timeoutId);

            streamRef.current = mediaStream;
            const video = videoRef.current;
            video.srcObject = mediaStream;

            // Robust play handling - Suppress AbortError
            try {
                await video.play();
                log("Video playing");
                setIsCameraLoading(false); // Only clear loading state on successful play
                animationFrameRef.current = requestAnimationFrame(tick);
            } catch (playError) {
                // Check if the component was aborted by a subsequent render/cleanup
                if ((playError as any).name === 'AbortError') {
                    log("Play aborted (harmless race condition) - Stream killed by cleanup.");
                    setIsCameraLoading(false); // CRITICAL: Clear loading state immediately on abort
                    return;
                }
                throw playError; // Throw other errors (NotAllowedError, etc.)
            }

        } catch (err) {
            // --- FAILURE PATH ---
            const errorName = (err as any).name || 'UnknownError';
            clearTimeout(timeoutId);
            stopScanner(); // Ensure tracks are stopped on failure

            log(`Critical Error: ${errorName}`);

            // Set error state to trigger the fallback UI
            setCameraError(errorName === 'NotAllowedError' ? "Access Denied: Check OS/Browser permissions." : `Camera failed: ${errorName}`);
            setIsCameraLoading(false);
        }
    }, [active, stopScanner, tick, videoRef]); // Removed startScanner dependency

    useEffect(() => {
        isMountedRef.current = true;

        if (active) {
            startScanner();
        } else {
            stopScanner();
        }

        return () => {
            isMountedRef.current = false;
            stopScanner();
        };
    }, [active, startScanner, stopScanner, videoRef.current]);

    return {
        isCameraLoading,
        cameraError,
        scannedData,
        restart: () => startScanner(0),
        logs
    };
};
