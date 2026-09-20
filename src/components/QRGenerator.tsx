import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRGeneratorProps {
  value: string;
  size?: number;
}

export const QRGenerator: React.FC<QRGeneratorProps> = ({ value, size = 220 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }, (error) => {
        if (error) console.error('Error generating QR code', error);
      });
    }
  }, [value, size]);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-200 shadow-md">
      <canvas ref={canvasRef} className="rounded-lg max-w-full" />
    </div>
  );
};
