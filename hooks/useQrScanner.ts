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

            const ctx = canvas.getContext('2d');
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

    const startScanner = useCallback(async () => {
        if (!active) return;

        // Reset state
        setCameraError(null);
        setIsCameraLoading(true);
        setScannedData(null);

        try {
            // Stop any existing stream first
            stopScanner();

            let mediaStream: MediaStream;
            try {
                // Try environment camera first
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
            } catch (envError) {
                console.warn("Environment camera failed, trying user camera...", envError);
                // Fallback to any video source
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            }

            if (!isMountedRef.current || !active) {
                mediaStream.getTracks().forEach(track => track.stop());
                return;
            }

            streamRef.current = mediaStream;

            if (videoRef.current) {
                const video = videoRef.current;
                video.srcObject = mediaStream;
                video.setAttribute('playsinline', 'true'); // Critical for iOS
                video.muted = true; // Critical for auto-play policies

                // Robust play handling
                try {
                    await video.play();
                } catch (playError) {
                    console.error("Video play failed", playError);
                    // Sometimes play fails if the element isn't in DOM yet or user interaction is needed
                    // But usually with muted=true it works.
                }

                setIsCameraLoading(false);
                animationFrameRef.current = requestAnimationFrame(tick);
            }
        } catch (err) {
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
        restart: startScanner
    };
};
