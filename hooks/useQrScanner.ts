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

        // Check if video ref is ready
        if (!videoRef.current) {
            if (retryCount < 10) {
                log(`Video ref null, retrying (${retryCount + 1}/10)...`);
                setTimeout(() => startScanner(retryCount + 1), 100);
                return;
            } else {
                log("Video ref missing after retries. Aborting.");
                setCameraError("Camera initialization failed (Video Element Missing).");
                return;
            }
        }

        // Reset state
        setCameraError(null);
        setIsCameraLoading(true);
        setScannedData(null);

        try {
            // Stop any existing stream first
            stopScanner();

            let mediaStream: MediaStream;
            try {
                log("Requesting env camera...");
                // Check if mediaDevices exists
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error("navigator.mediaDevices not supported");
                }

                // Try environment camera first
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                log("Env camera acquired");
            } catch (envError) {
                log(`Env cam failed (${envError}), trying user...`);
                // Fallback to any video source
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
                log("User camera acquired");
            }

            if (!isMountedRef.current || !active) {
                log("Hook unmounted/inactive, stopping tracks");
                mediaStream.getTracks().forEach(track => track.stop());
                return;
            }

            streamRef.current = mediaStream;

            if (videoRef.current) {
                const video = videoRef.current;
                log("Attaching stream to video");
                video.srcObject = mediaStream;
                video.setAttribute('playsinline', 'true'); // Critical for iOS
                video.muted = true; // Critical for auto-play policies

                // Robust play handling
                try {
                    await video.play();
                    log("Video playing");
                } catch (playError) {
                    log(`Play failed: ${playError}`);
                    console.error("Video play failed", playError);
                }

                setIsCameraLoading(false);
                animationFrameRef.current = requestAnimationFrame(tick);
            }
        } catch (err) {
            log(`Error: ${err}`);
            console.error("Camera access denied or error", err);
            if (isMountedRef.current) {
                setIsCameraLoading(false);
                setCameraError(`Could not access camera: ${err}`);
            }
        }
    }, [active, stopScanner, tick, videoRef]);

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
    }, [active, startScanner, stopScanner]);

    return {
        isCameraLoading,
        cameraError,
        scannedData,
        restart: () => startScanner(0),
        logs
    };
};
