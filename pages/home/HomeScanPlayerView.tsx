/**
 * @file HomeScanPlayerView.tsx
 *
 * QR code scanner view for adding players to a round by scanning their
 * Nostr identity QR code. Supports two modes:
 *
 * 1. **Native scanner** (Capacitor) -- shows a "Start Scanning" prompt that
 *    opens the device camera via the native plugin.
 * 2. **Web scanner** -- renders a live `<video>` feed with a viewfinder
 *    overlay and processes frames via `useQrScanner`.
 *
 * Accessible from the player selection step; navigates back to
 * `select_players` on close or successful scan.
 */

import React from 'react';
import { Icons } from '../../components/Icons';
import { HomeScanPlayerViewProps } from './homeTypes';

/**
 * QR scanner view component for adding players to a round.
 * Renders either a native camera prompt or an inline web camera feed
 * depending on the platform.
 */
export const HomeScanPlayerView: React.FC<HomeScanPlayerViewProps> = ({
    isCameraLoading,
    cameraError,
    logs,
    videoRef,
    canvasRef,
    restart,
    isNativeScanner,
    permissionStatus,
    startNativeScan,
    openAppSettings,
    setView,
}) => {
    // Native Scanner UI - Shows a prompt to start the native camera
    if (isNativeScanner) {
        return (
            <div className="relative h-full bg-gradient-to-b from-slate-900 to-black flex flex-col">
                {/* Header */}
                <div className="p-4 flex items-center justify-between">
                    <button
                        onClick={() => setView('select_players')}
                        className="p-3 bg-slate-800 rounded-full text-white hover:bg-slate-700 transition-colors"
                    >
                        <Icons.Close size={24} />
                    </button>
                    <h2 className="text-lg font-bold text-white">Scan Player QR</h2>
                    <div className="w-12" /> {/* Spacer for centering */}
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
                    {/* Camera Icon */}
                    <div className="w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border-2 border-blue-500/30">
                        <Icons.Camera size={64} className="text-blue-400" />
                    </div>

                    {/* Instructions */}
                    <div className="text-center space-y-2">
                        <h3 className="text-xl font-bold text-white">Ready to Scan</h3>
                        <p className="text-slate-400 text-sm max-w-xs">
                            Tap the button below to open your camera and scan a player's QR code
                        </p>
                    </div>

                    {/* Error Display */}
                    {cameraError && (
                        <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4 max-w-xs">
                            <p className="text-red-400 text-sm text-center">{cameraError}</p>
                            {permissionStatus === 'denied' && (
                                <button
                                    onClick={openAppSettings}
                                    className="mt-3 w-full bg-red-500/20 text-red-400 py-2 rounded-lg text-sm font-bold hover:bg-red-500/30 transition-colors"
                                >
                                    Open Settings
                                </button>
                            )}
                        </div>
                    )}

                    {/* Scan Button */}
                    <button
                        onClick={startNativeScan}
                        disabled={isCameraLoading}
                        className="w-full max-w-xs bg-gradient-to-r from-blue-500/70 via-purple-500/70 to-cyan-500/70 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCameraLoading ? (
                            <span className="flex items-center justify-center space-x-2">
                                <Icons.Zap size={20} className="animate-spin" />
                                <span>Opening Camera...</span>
                            </span>
                        ) : (
                            <span className="flex items-center justify-center space-x-2">
                                <Icons.Camera size={20} />
                                <span>Start Scanning</span>
                            </span>
                        )}
                    </button>

                    {/* Debug Logs (collapsed by default) */}
                    {logs.length > 0 && (
                        <details className="w-full max-w-xs">
                            <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-400">
                                Debug Logs
                            </summary>
                            <div className="mt-2 bg-black/50 p-2 rounded text-[10px] text-green-400 font-mono border border-green-900/50">
                                {logs.map((l, i) => <div key={i}>{l}</div>)}
                            </div>
                        </details>
                    )}
                </div>
            </div>
        );
    }

    // Web Scanner UI - Shows the video feed with QR overlay
    return (
        <div className="relative h-full bg-black flex flex-col">
            <div className="flex-1 relative overflow-hidden">
                <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover z-10"
                    muted={true}
                    autoPlay={true}
                    playsInline={true}
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Debug Logs */}
                <div className="absolute top-20 left-4 right-4 z-50 pointer-events-none">
                    <div className="bg-black/70 p-2 rounded text-[10px] text-green-400 font-mono border border-green-900/50 shadow-lg backdrop-blur-sm">
                        {logs.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                </div>

                {/* QR Viewfinder */}
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <div className="w-64 h-64 border-2 border-blue-400 rounded-lg relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                        {!isCameraLoading && (
                            <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-blue-400 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                        )}
                        {/* Corner markers */}
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>
                    </div>
                </div>

                {/* Camera Error Display */}
                {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/80">
                        <div className="bg-slate-900 border border-red-500/40 rounded-2xl p-6 max-w-xs mx-4 text-center">
                            <Icons.AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
                            <h3 className="text-white font-bold mb-2">Camera Error</h3>
                            <p className="text-slate-400 text-sm mb-4">{cameraError}</p>
                            <button
                                onClick={restart}
                                className="w-full bg-blue-500 text-white py-2 rounded-lg font-bold hover:bg-blue-400 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading indicator */}
                {isCameraLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-25 bg-black/50">
                        <div className="text-center">
                            <Icons.Zap size={48} className="text-blue-400 animate-spin mx-auto mb-2" />
                            <p className="text-white text-sm">Starting camera...</p>
                        </div>
                    </div>
                )}

                {/* Manual Restart Button */}
                <div className="absolute bottom-32 left-0 right-0 z-50 flex justify-center pointer-events-auto">
                    <button
                        onClick={restart}
                        className="bg-blue-500/80 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-xs font-bold backdrop-blur-sm transition-all"
                    >
                        Restart Camera
                    </button>
                </div>

                {/* Close Button */}
                <button
                    onClick={() => setView('select_players')}
                    className="absolute top-4 left-4 z-30 p-3 bg-black/50 rounded-full text-white hover:bg-black/70 backdrop-blur-sm"
                >
                    <Icons.Close size={24} />
                </button>

                {/* Instructions */}
                <div className="absolute bottom-4 left-4 right-4 z-30 text-center">
                    <p className="text-white/80 text-sm bg-black/50 rounded-lg py-2 px-4 backdrop-blur-sm">
                        Point camera at a player's QR code
                    </p>
                </div>
            </div>
        </div>
    );
};
