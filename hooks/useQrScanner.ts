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
        setLogs(prev => [...prev.slice(-4), `${new Date().toISOString().split('T')[1].slice(0, 8)}: ${msg}`]);
    };


    // Internal refs to track state across async operations and renders
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const isMountedRef = useRef(true);

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

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });

                if (code && code.data) {
                    setScannedData(code.data);
                    if (onScan) onScan(code.data);
                    // We don't stop automatically, let the parent decide
                }
            }
        }

        animationFrameRef.current = requestAnimationFrame(tick);
    }, [active, onScan, videoRef, canvasRef]);

    const startScanner = useCallback(async () => {
        if (!active) return;

        log("Starting scanner...");
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
                // Try environment camera first
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                log("Env camera acquired");
            } catch (envError) {
                log("Env cam failed, trying user...");
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
                log("Attaching to video ref");
                const video = videoRef.current;
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
                    // Sometimes play fails if the element isn't in DOM yet or user interaction is needed
                    // But usually with muted=true it works.
                }

                setIsCameraLoading(false);
                animationFrameRef.current = requestAnimationFrame(tick);
            } else {
                log("Video ref is null!");
            }
        } catch (err) {
            log(`Error: ${err}`);
            console.error("Camera access denied or error", err);
            if (isMountedRef.current) {
                setIsCameraLoading(false);
                setCameraError("Could not access camera. Please check permissions.");
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
        restart: startScanner,
        logs
    };
};
