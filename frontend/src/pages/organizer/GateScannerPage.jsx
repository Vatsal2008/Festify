// pages/organizer/GateScannerPage.jsx
// Replaces the mock scanner, which had a "tap the viewport to simulate a
// scan" button and matched codes by checking they started with "FTF-".
// This reads the camera, decodes real QR codes and posts them to
// /tickets/scan, and carries the gate controls that decide when codes go
// live and when scanning is accepted.
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardShell } from '@/components/layout';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { Spinner } from '@/components/primitives/Primitives';
import { gateApi, ticketsApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { useToast } from '@/store/uiStore';
import {
  CameraIcon, CheckIcon, XIcon, EyeIcon, EyeOffIcon, QrCodeIcon,
  UsersIcon, TicketIcon, AlertTriangleIcon,
} from '@/components/icons/Icons';
import '@/pages/pages.css';

// Ignore repeats of the same code inside this window. A camera runs at
// ~10fps and will decode the same ticket many times while it sits in
// frame; without this the second frame reports "already scanned" and the
// gate operator sees a red screen for a ticket that just worked.
const DEDUPE_MS = 3500;

export default function GateScannerPage() {
  const { orgId, eventId } = useParams();
  const toast = useToast();
  const qc = useQueryClient();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const lastSeen = useRef({ code: null, at: 0 });

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [result, setResult] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [history, setHistory] = useState([]);

  const gateQuery = useQuery({
    queryKey: ['gate', eventId],
    queryFn: () => gateApi.status(eventId),
    enabled: !!eventId,
    refetchInterval: 10000,
  });
  const gate = gateQuery.data;

  const mutateGate = useMutation({
    mutationFn: ({ action }) => gateApi[action](eventId),
    onSuccess: (data, { action }) => {
      qc.setQueryData(['gate', eventId], (old) => ({ ...(old ?? {}), ...data }));
      const messages = {
        revealQr: 'QR codes are now visible to ticket holders.',
        hideQr: 'QR codes hidden again.',
        open: 'Gate open — scanning is live.',
        close: 'Gate closed. Scans will be refused.',
      };
      toast.success(messages[action]);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const submitCode = useCallback(async (code) => {
    const trimmed = (code || '').trim();
    if (!trimmed) return;

    const now = Date.now();
    if (lastSeen.current.code === trimmed && now - lastSeen.current.at < DEDUPE_MS) return;
    lastSeen.current = { code: trimmed, at: now };

    try {
      const res = await ticketsApi.scan({ verify_code: trimmed, day_number: 1 });
      const entry = {
        ok: true,
        code: trimmed.slice(0, 8).toUpperCase(),
        name: res?.ticket?.owner_name || res?.owner?.full_name || 'Ticket holder',
        tier: res?.tier?.name || res?.ticket?.tier_name || '',
        at: new Date().toLocaleTimeString(),
      };
      setResult(entry);
      setHistory(h => [entry, ...h].slice(0, 12));
      qc.invalidateQueries({ queryKey: ['gate', eventId] });
      if (navigator.vibrate) navigator.vibrate(60);
    } catch (e) {
      const entry = {
        ok: false,
        code: trimmed.slice(0, 8).toUpperCase(),
        reason: apiError(e),
        at: new Date().toLocaleTimeString(),
      };
      setResult(entry);
      setHistory(h => [entry, ...h].slice(0, 12));
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    }
  }, [qc, eventId]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Rear camera on phones; falls back to whatever exists on a laptop.
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      const jsQR = (await import('jsqr')).default;
      const tick = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          const w = video.videoWidth, h = video.videoHeight;
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, w, h);
          const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {
            inversionAttempts: 'dontInvert',
          });
          if (found?.data) submitCode(found.data);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setCameraError(
        e?.name === 'NotAllowedError'
          ? 'Camera permission was refused. Allow it in your browser settings, then try again.'
          : e?.name === 'NotFoundError'
            ? 'No camera found on this device. Use manual entry below.'
            : `Could not start the camera: ${e?.message || e}`
      );
      setScanning(false);
    }
  }, [submitCode]);

  // Release the camera when leaving the page. A stream left running
  // keeps the device's camera light on and drains the battery.
  useEffect(() => () => stopCamera(), [stopCamera]);

  const gateOpen = !!gate?.gate_open;
  const qrLive = !!gate?.qr_revealed;

  return (
    <DashboardShell orgId={orgId} sidebarType="organizer">
      <div className="gate-page">
        <header className="gate-header">
          <div>
            <h1 className="type-display-md">Gate</h1>
            <p className="type-body-md" style={{ color: 'rgba(22,16,31,0.65)' }}>
              {gate?.title ? gate.title : 'Control codes and check attendees in'}
            </p>
          </div>
          {gateQuery.isPending ? <Spinner size="sm" /> : (
            <div className="gate-stats">
              <div><p className="gate-stat__value">{gate?.checked_in ?? 0}</p><p className="gate-stat__label">Checked in</p></div>
              <div><p className="gate-stat__value">{gate?.remaining ?? 0}</p><p className="gate-stat__label">Remaining</p></div>
              <div><p className="gate-stat__value">{gate?.tickets_issued ?? 0}</p><p className="gate-stat__label">Issued</p></div>
            </div>
          )}
        </header>

        {/* Two switches, in the order they get used: release codes so the
            queue can load them, then open the gate to start admitting. */}
        <div className="gate-controls">
          <div className={`gate-control ${qrLive ? 'gate-control--on' : ''}`}>
            <div className="gate-control__icon">{qrLive ? <EyeIcon size={20} /> : <EyeOffIcon size={20} />}</div>
            <div className="gate-control__body">
              <p className="gate-control__title">
                QR codes {qrLive ? 'released' : 'hidden'}
                <Badge variant={qrLive ? 'success' : 'default'}>{qrLive ? 'Live' : 'Held'}</Badge>
              </p>
              <p className="gate-control__text">
                {qrLive
                  ? 'Ticket holders can see their scannable code.'
                  : 'Holders see a placeholder. Release codes as the queue forms — the shorter the window, the less time a screenshot can circulate.'}
              </p>
            </div>
            <Button
              variant={qrLive ? 'ghost' : 'secondary'}
              size="sm"
              isLoading={mutateGate.isPending}
              onClick={() => mutateGate.mutate({ action: qrLive ? 'hideQr' : 'revealQr' })}
            >
              {qrLive ? 'Hide codes' : 'Release codes'}
            </Button>
          </div>

          <div className={`gate-control ${gateOpen ? 'gate-control--on' : ''}`}>
            <div className="gate-control__icon"><UsersIcon size={20} /></div>
            <div className="gate-control__body">
              <p className="gate-control__title">
                Gate {gateOpen ? 'open' : 'closed'}
                <Badge variant={gateOpen ? 'success' : 'warning'}>{gateOpen ? 'Admitting' : 'Closed'}</Badge>
              </p>
              <p className="gate-control__text">
                {gateOpen
                  ? 'Scans are being accepted.'
                  : 'Scans are refused while closed, so a scanner left running cannot admit people early.'}
              </p>
            </div>
            <Button
              variant={gateOpen ? 'ghost' : 'primary'}
              size="sm"
              isLoading={mutateGate.isPending}
              onClick={() => mutateGate.mutate({ action: gateOpen ? 'close' : 'open' })}
            >
              {gateOpen ? 'Close gate' : 'Open gate'}
            </Button>
          </div>
        </div>

        {!gateOpen && (
          <div className="gate-warning">
            <AlertTriangleIcon size={16} />
            <span>The gate is closed — scans will be refused until you open it.</span>
          </div>
        )}

        <div className="gate-scan-layout">
          <div>
            <div className="scanner-viewport scanner-viewport--live">
              <video ref={videoRef} playsInline muted className="scanner-video" />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {!scanning && (
                <div className="scanner-viewport__inner">
                  <CameraIcon size={44} />
                  <p className="type-body-sm" style={{ marginTop: 10, opacity: 0.7 }}>Camera is off</p>
                </div>
              )}
              {scanning && (
                <>
                  <div className="scanner-frame" aria-hidden="true" />
                  <motion.div
                    className="scanner-laser"
                    animate={{ top: ['12%', '88%', '12%'] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                    aria-hidden="true"
                  />
                </>
              )}
            </div>

            <div className="gate-scan-actions">
              {scanning
                ? <Button variant="danger" onClick={stopCamera}>Stop camera</Button>
                : <Button variant="primary" onClick={startCamera}><QrCodeIcon size={16} /> Start scanning</Button>}
            </div>

            {cameraError && (
              <div className="gate-warning gate-warning--error">
                <AlertTriangleIcon size={16} /><span>{cameraError}</span>
              </div>
            )}

            <div style={{ marginTop: 'var(--space-xl)' }}>
              <p className="type-label-mono" style={{ marginBottom: 'var(--space-md)' }}>Manual entry</p>
              <div style={{ display: 'flex' }}>
                <input
                  className="input-field"
                  placeholder="Paste or type the ticket code"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { submitCode(manualCode); setManualCode(''); } }}
                  style={{ borderRight: 'none', borderRadius: '8px 0 0 8px' }}
                />
                <Button
                  variant="secondary"
                  onClick={() => { submitCode(manualCode); setManualCode(''); }}
                  style={{ borderRadius: '0 8px 8px 0', flexShrink: 0 }}
                >
                  Check
                </Button>
              </div>
            </div>
          </div>

          <div>
            <AnimatePresence mode="wait">
              {result && (
                <motion.div
                  key={`${result.code}-${result.at}`}
                  className={`scanner-result ${result.ok ? 'scanner-result--success' : 'scanner-result--error'}`}
                  initial={{ opacity: 0, scale: 0.94, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  {result.ok
                    ? <CheckIcon size={38} style={{ color: 'var(--color-success)' }} />
                    : <XIcon size={38} style={{ color: 'var(--color-error)' }} />}
                  <p className="type-heading-md" style={{ marginTop: 8 }}>
                    {result.ok ? 'Admitted' : 'Refused'}
                  </p>
                  <p className="type-body-sm" style={{ fontFamily: 'var(--font-mono)' }}>{result.code}</p>
                  {result.ok
                    ? <p className="type-body-sm">{result.name}{result.tier ? ` · ${result.tier}` : ''}</p>
                    : <p className="type-body-sm">{result.reason}</p>}
                </motion.div>
              )}
            </AnimatePresence>

            {history.length > 0 && (
              <div style={{ marginTop: 'var(--space-xl)' }}>
                <p className="type-label-mono" style={{ marginBottom: 'var(--space-md)' }}>Recent</p>
                <div className="gate-history">
                  {history.map((h, i) => (
                    <motion.div
                      key={`${h.code}-${h.at}-${i}`}
                      className={`gate-history__row ${h.ok ? '' : 'gate-history__row--bad'}`}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <span>{h.ok ? <CheckIcon size={13} /> : <XIcon size={13} />}</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{h.code}</span>
                      <span className="gate-history__meta">{h.ok ? h.name : h.reason}</span>
                      <span className="gate-history__time">{h.at}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {history.length === 0 && (
              <div className="gate-empty">
                <TicketIcon size={36} />
                <p className="type-body-sm" style={{ marginTop: 10, opacity: 0.65 }}>
                  Scans will appear here as attendees come through.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
