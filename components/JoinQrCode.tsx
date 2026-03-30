/**
 * @file JoinQrCode.tsx
 * @description Reusable QR code display component for round and tournament
 * join URLs. Renders a styled QR code image with a gradient border, title,
 * and optional subtitle. The QR image is generated via an external API.
 */

import React from 'react';
import { buildQrImageUrl } from '../utils/qrUrls';

/**
 * Props for the {@link JoinQrCode} component.
 *
 * @property joinUrl - The URL to encode in the QR code (e.g., a round join URL).
 * @property title - Primary label displayed below the QR code.
 * @property subtitle - Optional secondary text below the title.
 * @property size - QR code image size in pixels. Defaults to 200.
 */
interface JoinQrCodeProps {
  joinUrl: string;
  title: string;
  subtitle?: string;
  size?: number;
}

/**
 * Styled QR code card for sharing join URLs.
 *
 * Displays a QR code image inside a gradient-bordered container with a title
 * and optional subtitle. Used in the host's player selection view, scorecard,
 * and tournament lobby for inviting other players.
 *
 * @param props - {@link JoinQrCodeProps}
 * @returns The QR code card UI.
 */
export const JoinQrCode: React.FC<JoinQrCodeProps> = ({
  joinUrl,
  title,
  subtitle,
  size = 200,
}) => {
  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="bg-gradient-to-br from-emerald-400 via-cyan-500 to-teal-600 p-1 rounded-2xl shadow-2xl shadow-cyan-500/30 inline-block">
        <div className="bg-white p-3 rounded-xl">
          <img
            src={buildQrImageUrl(joinUrl, size)}
            className="w-48 h-48"
            alt="Join QR Code"
          />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        {subtitle && (
          <p className="text-xs text-slate-400">{subtitle}</p>
        )}
      </div>
    </div>
  );
};
