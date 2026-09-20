import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { Camera, RefreshCw, CheckCircle2, ShieldCheck, AlertCircle, Key, Upload, Image as ImageIcon } from 'lucide-react';
import { QRService, QRPayload } from '../services/qr';

interface QRScannerProps {
  onScanSuccess: (payload: QRPayload) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess }) => {
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<QRPayload | null>(null);
  const [manualToken, setManualToken] = useState<string>('MC-DEMO-7789');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    setIsScanning(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available in unencrypted HTTP mobile context.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        requestAnimationFrame(tick);
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setHasCamera(false);
      setCameraError('Live camera access is restricted on mobile HTTP connections. You can upload a QR photo or pair with token below.');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    setIsScanning(false);
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const tick = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d');

      if (ctx && videoRef.current) {
        canvas.height = videoRef.current.videoHeight;
        canvas.width = videoRef.current.videoWidth;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          const payload = QRService.parseConnectionToken(code.data);
          if (payload) {
            setScannedResult(payload);
            stopCamera();
            return;
          }
        }
      }
    }
    if (isScanning) {
      animationFrameId.current = requestAnimationFrame(tick);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          const payload = QRService.parseConnectionToken(code.data);
          if (payload) {
            setScannedResult(payload);
            setCameraError(null);
          } else {
            setCameraError('QR Code read, but token format is unrecognized.');
          }
        } else {
          setCameraError('No QR Code detected in uploaded photo. Please try another image or use token.');
        }
      }
    };
    img.src = URL.createObjectURL(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    const payload = QRService.parseConnectionToken(manualToken.trim());
    if (payload) {
      setScannedResult(payload);
    }
  };

  const handleConfirmConnection = () => {
    if (scannedResult) {
      onScanSuccess(scannedResult);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border-2 border-teal-100 shadow-xl max-w-md mx-auto text-slate-800">
      <div className="text-center mb-4">
        <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-inner">
          <Camera className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-900">Connect Elderly Device</h3>
        <p className="text-sm text-slate-600">Scan QR Code from caregiver's device</p>
      </div>

      {/* Scanned Device Found View */}
      {scannedResult ? (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 text-center space-y-4 animate-fade-in">
          <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
              Device Found
            </span>
            <h4 className="text-xl font-bold text-slate-900 mt-2">{scannedResult.caregiverName}</h4>
            <p className="text-xs text-slate-600 mt-0.5">Caregiver Token: <code className="bg-white px-2 py-0.5 rounded font-mono font-bold">{scannedResult.token}</code></p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleConfirmConnection}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-lg rounded-xl shadow-lg shadow-emerald-600/30 transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" /> Connect Device Now
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Video Scanner Stream */}
          {hasCamera && !cameraError ? (
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square max-w-[280px] mx-auto border-4 border-slate-900 shadow-inner">
              <video ref={videoRef} className="w-full h-full object-cover" />
              {/* Overlay target box */}
              <div className="absolute inset-0 border-2 border-dashed border-teal-400 m-8 rounded-xl pointer-events-none flex items-center justify-center">
                <div className="w-full h-0.5 bg-teal-400/80 animate-pulse"></div>
              </div>
              <div className="absolute bottom-2 inset-x-0 text-center">
                <span className="bg-slate-900/80 text-teal-300 text-xs px-3 py-1 rounded-full backdrop-blur-sm font-semibold">
                  Point camera at Caregiver QR Code
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center text-xs text-amber-800 mb-4 space-y-2">
              <AlertCircle className="w-5 h-5 mx-auto text-amber-600" />
              <p>{cameraError || 'Camera stream disabled.'}</p>
            </div>
          )}

          {/* Image Upload Option */}
          <div className="mt-4 text-center">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 border border-slate-200"
            >
              <ImageIcon className="w-4 h-4 text-teal-600" /> Upload QR Photo from Gallery
            </button>
          </div>

          {/* Manual Token Fallback Input */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 text-center flex items-center justify-center gap-1.5">
                <Key className="w-4 h-4 text-teal-600" /> Or enter connection token manually:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="e.g. MC-DEMO-7789"
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center font-mono font-bold text-slate-900 uppercase focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl transition shadow-md"
                >
                  Pair
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};
