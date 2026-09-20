import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { QRService, QRPayload } from '../services/qr';
import { QRGenerator } from '../components/QRGenerator';
import { QRScanner } from '../components/QRScanner';
import { useAuth } from '../context/AuthContext';
import { QrCode, ShieldCheck, RefreshCw, Laptop, CheckCircle2, LogOut, Globe, ExternalLink, Edit3, Copy, Check, Signal, Wifi, Info, Smartphone, AlertTriangle, ArrowLeft } from 'lucide-react';
import { DeviceConnection } from '../types';

interface DeviceConnectionPageProps {
  onNavigate?: (page: string) => void;
}

export const DeviceConnectionPage: React.FC<DeviceConnectionPageProps> = ({ onNavigate }) => {
  const { role } = useAuth();
  const [connection, setConnection] = useState<DeviceConnection>(StorageService.getDeviceConnection());
  const [qrToken, setQrToken] = useState<string>(() => QRService.createConnectionToken());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // QR Code Format Mode: 'url' (Open Web App in Phone Browser) vs 'payload' (In-App Instant Scanner)
  const [qrFormat, setQrFormat] = useState<'url' | 'payload'>('url');

  // Network Mode: 'wifi' (Local Router IP) vs 'cloudflare' (5G Mobile Data)
  const [networkMode, setNetworkMode] = useState<'wifi' | 'cloudflare'>('wifi');
  
  // Public Cloudflare Tunnel / Domain URL (optional for remote mobile data)
  const [cloudflareUrl, setCloudflareUrl] = useState<string>('');
  
  // Local Wi-Fi IP URL (Defaults to PC LAN IP on active Wi-Fi adapter)
  const [localWifiUrl, setLocalWifiUrl] = useState<string>('http://192.168.1.37:5173');

  // Active target URL for QR Code based on selected network mode
  const targetUrl = networkMode === 'cloudflare' ? cloudflareUrl : localWifiUrl;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        setLocalWifiUrl(origin);
      } else {
        const port = window.location.port || '5173';
        setLocalWifiUrl(`http://192.168.1.37:${port}`);
      }

      if (origin && (origin.includes('trycloudflare.com') || origin.includes('loca.lt') || origin.includes('vercel.app'))) {
        setCloudflareUrl(origin);
        setNetworkMode('cloudflare');
      }

      // Auto-fetch active Cloudflare tunnel URL if runner script is active
      const checkTunnel = () => {
        fetch('/tunnel-url.json?t=' + Date.now())
          .then(res => res.json())
          .then(data => {
            if (data?.url && data.active) {
              setCloudflareUrl(data.url);
              // Switch to cloudflare mode if active and on localhost
              if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                setNetworkMode('cloudflare');
              }
            }
          })
          .catch(() => {});
      };

      checkTunnel();
      const tunnelInterval = setInterval(checkTunnel, 3000);

      // Check URL search query for ?token=MC-... and auto connect
      const searchParams = new URLSearchParams(window.location.search);
      const urlToken = searchParams.get('token');
      if (urlToken) {
        const payload = QRService.parseConnectionToken(urlToken);
        if (payload) {
          handleScanSuccess(payload);
        }
      }

      return () => clearInterval(tunnelInterval);
    }
  }, []);

  const handleCopyLink = () => {
    if (!targetUrl) return;
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateNewQR = () => {
    const newToken = QRService.createConnectionToken();
    setQrToken(newToken);
    setSuccessMessage('Generated new secure connection QR Token.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDisconnect = () => {
    const updated: DeviceConnection = {
      ...connection,
      status: 'offline',
      lastSync: 'Disconnected',
    };
    StorageService.saveDeviceConnection(updated);
    setConnection(updated);
  };

  const handleScanSuccess = (payload: QRPayload) => {
    const updated: DeviceConnection = {
      id: `dev-conn-${Date.now()}`,
      token: payload.token,
      caregiverName: payload.caregiverName,
      elderlyName: payload.elderlyName,
      connectedAt: new Date().toISOString(),
      status: 'online',
      lastSync: 'Just now',
    };
    StorageService.saveDeviceConnection(updated);
    setConnection(updated);
    setSuccessMessage('✓ Device Connected & Profile Synced Successfully!');
  };

  // QR Code payload string generation
  const elderly = StorageService.getElderlyProfile();
  const caregiver = StorageService.getCaregiverProfile();
  const caregiverName = caregiver?.name || 'Caregiver';
  const elderlyName = elderly?.name || 'Patient';

  const qrCodeValue = qrFormat === 'payload'
    ? JSON.stringify({
        protocol: 'mindcare',
        action: 'connect',
        token: qrToken,
        caregiverName,
        elderlyName,
        createdAt: Date.now(),
      })
    : `${targetUrl}?token=${qrToken}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 text-slate-900">
      {onNavigate && (
        <div className="flex items-center justify-between pb-2">
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </button>
        </div>
      )}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <QrCode className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900">QR Device Connection & Network Pairing</h1>
        <p className="text-sm text-slate-600">
          Pair caregiver phone/tablet with elderly device over 5G/4G Mobile Data (Cloudflare HTTPS) or Local Wi-Fi network.
        </p>
      </div>

      {/* Instant Pairing Instructions Banner */}
      <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>How to Open & Connect SIROI on Your Mobile Phone:</span>
        </div>
        <div className="text-xs text-emerald-900 leading-relaxed space-y-2 pl-7">
          <p>
            <strong>Option 1 — Open in Mobile Browser (Same Wi-Fi):</strong> Connect your phone to the same Wi-Fi router (e.g. <code>bwrouter</code>). Scan the QR code below with your phone's native camera, or open Chrome/Safari on your phone and go to <code className="bg-emerald-100 px-2 py-0.5 rounded font-mono font-bold text-emerald-950">{localWifiUrl}</code>.
          </p>
          <p>
            <strong>Option 2 — In-App Pairing Token:</strong> If SIROI is already open on the phone, tap <strong>Connect Elderly Device</strong> (or open camera on the right), and point at the QR code or enter token <code className="bg-emerald-100 px-2 py-0.5 rounded font-mono font-bold text-emerald-950">{qrToken}</code>.
          </p>
          <p>
            <strong>Option 3 — 5G/4G Cellular Mobile Data:</strong> If your phone is not on the same Wi-Fi, select <strong>5G / 4G Cloudflare Tunnel</strong> below and paste your active tunnel domain URL.
          </p>
        </div>
      </div>

      {/* Network Mode Selection Tabs */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-md space-y-4">
        <div className="text-xs font-bold uppercase text-slate-400 text-center tracking-wider">
          Select Connection Network:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setNetworkMode('wifi')}
            className={`p-4 rounded-2xl border-2 transition flex items-start gap-3 text-left cursor-pointer ${
              networkMode === 'wifi'
                ? 'bg-teal-50 border-teal-600 shadow-md'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className={`p-2.5 rounded-xl ${networkMode === 'wifi' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                Home Wi-Fi Network <span className="bg-teal-100 text-teal-800 text-[10px] px-2 py-0.5 rounded-full font-bold">Recommended</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">When mobile phone & laptop are on the same Wi-Fi router (192.168.1.37).</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setNetworkMode('cloudflare')}
            className={`p-4 rounded-2xl border-2 transition flex items-start gap-3 text-left cursor-pointer ${
              networkMode === 'cloudflare'
                ? 'bg-teal-50 border-teal-600 shadow-md'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className={`p-2.5 rounded-xl ${networkMode === 'cloudflare' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
              <Signal className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                5G / 4G Mobile Data <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Cloudflare Tunnel</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Optional public HTTPS tunnel for cellular connections away from home Wi-Fi.</p>
            </div>
          </button>
        </div>
      </div>

      {/* Network Target URL Banner */}
      <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-teal-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 w-full">
          <div className="w-10 h-10 bg-teal-500/20 text-teal-300 rounded-2xl flex items-center justify-center shrink-0 border border-teal-500/40">
            <Globe className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 space-y-1.5 w-full">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-teal-400">
                Active Web Target ({networkMode === 'wifi' ? 'Local Wi-Fi LAN' : 'Cloudflare 5G HTTPS'})
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </div>
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => {
                  if (networkMode === 'cloudflare') {
                    setCloudflareUrl(e.target.value);
                  } else {
                    setLocalWifiUrl(e.target.value);
                  }
                }}
                placeholder={networkMode === 'wifi' ? 'http://192.168.1.37:5173' : 'Paste active Cloudflare URL (e.g. https://xxxx.trycloudflare.com)'}
                className="w-full max-w-md bg-slate-800/80 text-teal-200 text-xs font-mono font-bold px-3 py-2 rounded-xl border border-teal-500/40 focus:ring-2 focus:ring-teal-400 outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs flex items-center gap-1 transition shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {networkMode === 'wifi' && (
              <div className="flex items-center gap-2 text-[11px] text-teal-300/80 font-medium">
                <span>Wi-Fi IP Presets:</span>
                <button
                  type="button"
                  onClick={() => setLocalWifiUrl('http://192.168.1.37:5173')}
                  className="underline hover:text-white cursor-pointer font-mono"
                >
                  192.168.1.37:5173
                </button>
                <span>|</span>
                <button
                  type="button"
                  onClick={() => setLocalWifiUrl('http://localhost:5173')}
                  className="underline hover:text-white cursor-pointer font-mono"
                >
                  localhost:5173
                </button>
              </div>
            )}
          </div>
        </div>

        <a
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md"
        >
          Open App URL <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-900 font-extrabold p-4 rounded-2xl text-center animate-fade-in flex items-center justify-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Connected Devices Dashboard Tile */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-teal-50 text-teal-700 rounded-2xl">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-slate-900">Connected Elderly Device</h3>
                <span
                  className={`text-xs font-extrabold px-3 py-0.5 rounded-full ${
                    connection.status === 'online'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {connection.status === 'online' ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Caregiver: <strong>{connection.caregiverName}</strong> | Elderly: <strong>{connection.elderlyName}</strong>
              </p>
            </div>
          </div>

          <div className="text-right text-xs text-slate-500 font-semibold hidden sm:block">
            <div>Last Sync: {connection.lastSync}</div>
            <div className="font-mono text-teal-700 font-bold">{connection.token}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            onClick={handleGenerateNewQR}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm rounded-xl transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" /> Generate New QR
          </button>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-sm rounded-xl transition flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" /> Disconnect Device
          </button>
        </div>
      </div>

      {/* Role Dependent QR Display or Scanner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Caregiver View: Generate QR */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl text-center space-y-4">
          <span className="text-xs uppercase font-extrabold tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            Caregiver QR Generator
          </span>
          <h3 className="text-xl font-extrabold text-slate-900">Caregiver QR Code</h3>

          {/* QR Format Switcher (Web App Browser Link vs In-App Scanner) */}
          <div className="flex bg-slate-100 p-1 rounded-2xl max-w-sm mx-auto">
            <button
              type="button"
              onClick={() => setQrFormat('url')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition cursor-pointer ${
                qrFormat === 'url' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌐 Open Web App QR
            </button>
            <button
              type="button"
              onClick={() => setQrFormat('payload')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition cursor-pointer ${
                qrFormat === 'payload' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚡ In-App Token QR
            </button>
          </div>

          <p className="text-xs text-slate-600">
            {qrFormat === 'url'
              ? `Scan with phone camera to open SIROI in mobile browser via ${networkMode === 'wifi' ? 'Wi-Fi (192.168.1.37)' : 'Cloudflare HTTPS'}.`
              : 'Scan using the SIROI in-app scanner to pair elderly device.'}
          </p>

          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 inline-block shadow-md">
            <QRGenerator value={qrCodeValue} size={220} />
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-mono text-slate-700 space-y-1 text-left">
            <div className="flex items-center justify-between">
              <span>Token: <strong className="text-teal-700">{qrToken}</strong></span>
              <span className="text-[10px] text-teal-800 font-bold bg-teal-100 px-2 py-0.5 rounded-full">
                {qrFormat === 'url' ? (networkMode === 'wifi' ? 'Wi-Fi Browser URL' : 'Cloudflare URL') : 'SIROI JSON'}
              </span>
            </div>
            {qrFormat === 'url' && (
              <div className="text-[11px] text-slate-500 truncate">URL: {targetUrl}</div>
            )}
          </div>
        </div>

        {/* Elderly View: Camera Scanner */}
        <div>
          <QRScanner onScanSuccess={handleScanSuccess} />
        </div>
      </div>
    </div>
  );
};
