// pages/admin/SuperLoginPage.jsx
// Standalone super admin sign-in at /super.
//
// The panel used to sit behind Google sign-in: you became a normal user
// first, then a flag on that account decided whether the panel opened.
// This is a login of its own -- an approved email and a code sent to it,
// with no Google step and no password to leak. Only addresses in
// super_admins can receive a code, so an unapproved one can never get a
// session regardless of what it submits.
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/primitives/Button';
import { superAuthApi } from '@/lib/api/endpoints';
import { apiError, tokenStore } from '@/lib/api/client';
import { ShieldIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon } from '@/components/icons/Icons';
import './super-login.css';

export default function SuperLoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const codeRef = useRef(null);

  // Resend cooldown, so the button cannot be hammered into the rate
  // limit the server enforces anyway.
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  useEffect(() => { if (step === 'code') codeRef.current?.focus(); }, [step]);

  const request = useMutation({
    mutationFn: () => superAuthApi.requestCode(email.trim().toLowerCase()),
    onSuccess: () => { setError(null); setStep('code'); setSeconds(45); },
    onError: (e) => setError(apiError(e)),
  });

  const verify = useMutation({
    mutationFn: () => superAuthApi.verifyCode(email.trim().toLowerCase(), code),
    onSuccess: (data) => {
      // Same token store the rest of the app reads, so every existing
      // authenticated call keeps working after this login.
      tokenStore.set(data.access_token);
      setStep('done');
      setTimeout(() => { window.location.href = '/super/dashboard'; }, 700);
    },
    onError: (e) => { setError(apiError(e)); setCode(''); },
  });

  return (
    <div className="super-login">
      <div className="super-login__grid" aria-hidden="true" />

      <motion.div
        className="super-login__card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="super-login__badge"><ShieldIcon size={22} /></div>
        <h1 className="super-login__title">Admin access</h1>
        <p className="super-login__sub">
          {step === 'email' && 'Sign in with an approved admin email.'}
          {step === 'code' && <>We sent a 6-digit code to <strong>{email}</strong>.</>}
          {step === 'done' && 'Verified. Opening the panel…'}
        </p>

        <AnimatePresence mode="wait">
          {step === 'email' && (
            <motion.form
              key="email"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.22 }}
              onSubmit={(e) => { e.preventDefault(); if (email.includes('@')) request.mutate(); }}
            >
              <label className="super-login__label" htmlFor="admin-email">Email address</label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                autoFocus
                className="super-login__input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                variant="primary" fullWidth type="submit"
                isDisabled={!email.includes('@')}
                isLoading={request.isPending}
                style={{ marginTop: 'var(--space-lg)' }}
              >
                Send code <ArrowRightIcon size={15} />
              </Button>
            </motion.form>
          )}

          {step === 'code' && (
            <motion.form
              key="code"
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.22 }}
              onSubmit={(e) => { e.preventDefault(); if (code.length === 6) verify.mutate(); }}
            >
              <label className="super-login__label" htmlFor="admin-code">6-digit code</label>
              <input
                id="admin-code"
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="super-login__input super-login__input--code"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <Button
                variant="primary" fullWidth type="submit"
                isDisabled={code.length !== 6}
                isLoading={verify.isPending}
                style={{ marginTop: 'var(--space-lg)' }}
              >
                Verify and continue
              </Button>

              <div className="super-login__row">
                <button type="button" className="super-login__link"
                  onClick={() => { setStep('email'); setCode(''); setError(null); }}>
                  <ArrowLeftIcon size={13} /> Change email
                </button>
                <button
                  type="button"
                  className="super-login__link"
                  disabled={seconds > 0 || request.isPending}
                  onClick={() => request.mutate()}
                >
                  {seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}
                </button>
              </div>
            </motion.form>
          )}

          {step === 'done' && (
            <motion.div
              key="done"
              className="super-login__done"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <CheckIcon size={40} />
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p role="alert" className="super-login__error">{error}</p>}

        <button className="super-login__back" onClick={() => navigate('/')}>
          Back to Festify
        </button>
      </motion.div>

      <p className="super-login__foot">
        Access is limited to approved addresses. Codes expire in 10 minutes.
      </p>
    </div>
  );
}
