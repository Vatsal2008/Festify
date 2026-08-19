// pages/auth/LoginPage.jsx — Google sign-in.
//
// The API authenticates with Google only (POST /auth/google exchanges a
// Google ID token for the app JWT); there is no password endpoint. The
// email/password forms this page used to show could never have worked,
// so they're gone rather than left as dead UI. Google also creates the
// account on first sign-in, which makes "sign up" and "sign in" the same
// action — hence one panel instead of a sign-in/sign-up toggle.
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { authApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { useToast } from '@/store/uiStore';
import { GraduationCapIcon, SparklesIcon, ZapIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

export default function LoginPage() {
  const { renderGoogleButton, isLoading, isAuthenticated, isGoogleConfigured } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const buttonRef = useRef(null);

  // Already signed in (e.g. hit /login directly with a live session).
  useEffect(() => {
    if (isAuthenticated) {
      const returnUrl = sessionStorage.getItem('festify_return_url') || '/';
      sessionStorage.removeItem('festify_return_url');
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) return;
    renderGoogleButton(buttonRef.current, {
      onSuccess: (profile) => {
        const returnUrl = sessionStorage.getItem('festify_return_url')
          // First-time users go through onboarding; returning users don't.
          || (profile?.college_verified_at ? '/' : '/onboarding');
        sessionStorage.removeItem('festify_return_url');
        navigate(returnUrl, { replace: true });
      },
      onError: (err) => setError(err.message),
    });
  }, [renderGoogleButton, navigate, isAuthenticated]);

  return (
    <div className="auth-split-wrapper">
      <div className="auth-split-card">
        <div className="auth-form-side">
          <div>
            <p className="type-label-mono" style={{ color: 'var(--color-accent)', marginBottom: 4 }}>Festify Portal</p>
            <h1 className="type-display-md" style={{ color: 'var(--color-ink)' }}>Sign in</h1>
            <p className="type-body-sm" style={{ color: 'rgba(22,16,31,0.65)', marginTop: 'var(--space-sm)' }}>
              New here? Signing in with Google creates your account.
            </p>
          </div>

          {!isGoogleConfigured && (
            <div role="alert" style={{ padding: 'var(--space-lg)', border: '2px solid var(--color-error)', background: 'var(--color-error-bg)', borderRadius: 'var(--radius-md)' }}>
              <p className="type-body-sm">
                Google sign-in isn&apos;t configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> and rebuild.
              </p>
            </div>
          )}

          {/* Google renders its own button here. It must be a real
              click on Google's element -- One Tap gets suppressed by
              browsers and reports back as "dismissed". */}
          <div style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>
            <div ref={buttonRef} />
            {isLoading && (
              <span style={{ marginLeft: 12, display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(22, 16, 31,0.3)', borderTopColor: 'var(--color-ink)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
            )}
          </div>

          {error && (
            <p role="alert" className="type-body-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
          )}

          <p className="type-body-xs" style={{ color: 'rgba(22,16,31,0.55)' }}>
            By continuing you agree to Festify&apos;s Terms &amp; Privacy Policy.
          </p>

          {/* No separate admin sign-in: admin access is a role on your
              normal Google account, granted from the admin panel. */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, borderTop: 'var(--border-hairline)' }}>
            <button onClick={() => navigate('/')} className="login-guest-link" style={{ fontSize: 12 }}>
              Browse as guest
            </button>
          </div>
        </div>

        {/* ── Brand panel ── */}
        <div
          className="auth-overlay-panel"
          style={{
            backgroundImage: 'linear-gradient(135deg, rgba(22,16,31,0.86) 0%, rgba(11,7,20,0.96) 100%), url(/media/hero-poster.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xl)' }}>
            <SparklesIcon size={48} style={{ color: 'var(--color-accent)' }} />
            <div>
              <h2 className="type-display-lg" style={{ color: 'var(--color-canvas)', marginBottom: 'var(--space-sm)' }}>
                Every fest, one place.
              </h2>
              <p className="type-body-md" style={{ color: 'rgba(251, 247, 240,0.85)', maxWidth: 340, lineHeight: 1.5 }}>
                Book tickets, hype the events you want, and keep every QR code in one wallet — across colleges all over India.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Onboarding ────────────────────────────────────────────────────
export function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const { user, refreshUser } = useAuth();

  const handleScroll = (e) => {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 10) setHasScrolled(true);
  };

  const sendOtp = async () => {
    setBusy(true);
    try {
      await authApi.requestCollegeOtp(email);
      toast.success(`Code sent to ${email}. It expires in 10 minutes.`);
      setStep(3);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmOtp = async () => {
    setBusy(true);
    try {
      await authApi.confirmCollegeOtp(otp);
      await refreshUser();
      toast.success('College email verified.');
      setStep(4);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === 1) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-xl)' }}>
      <div className="onboarding-step">
        <h1 className="type-display-md">Terms &amp; Conditions</h1>
        <p className="type-body-md" style={{ color: 'rgba(22, 16, 31,0.7)' }}>Please read and accept before using Festify</p>
        <div className="onboarding-tos" onScroll={handleScroll}>
          <p><strong>1. Platform Use:</strong> Festify is a marketplace for college events. Organizers are fully liable for their events.</p><br/>
          <p><strong>2. One Account:</strong> You may hold multiple roles — attendee, organizer, Prime member, and Pass holder.</p><br/>
          <p><strong>3. Ticketing:</strong> All purchases are final per the refund policy. Razorpay transaction fees are non-refundable.</p><br/>
          <p><strong>4. Resale:</strong> In-app resale only. Prices can only go down from original purchase price.</p><br/>
          <p><strong>5. Reviews:</strong> Only ticket buyers can review. Reviews are moderated.</p><br/>
          <p><strong>6. Trust &amp; Safety:</strong> Festify may ban organizers for violations. College admins handle college-domain issues.</p><br/>
          <p><strong>7. Prime Status:</strong> Prime is earned through attendance and spend — it cannot be purchased. Prime Pass is a separate paid subscription.</p><br/>
          <p><strong>8. Content:</strong> You are responsible for any content you upload. Festify moderates all media.</p><br/>
          <p><strong>9. Governing Law:</strong> These terms are governed by Indian law.</p><br/>
          <p><em>Scroll to the bottom to accept these terms.</em></p>
        </div>
        <button
          onClick={() => setStep(2)}
          disabled={!hasScrolled}
          className="btn btn--primary btn--full"
          style={{ opacity: hasScrolled ? 1 : 0.4, cursor: hasScrolled ? 'pointer' : 'not-allowed' }}
        >
          {hasScrolled ? 'I Accept — Continue' : 'Scroll to read all terms'}
        </button>
      </div>
    </div>
  );

  if (step === 2) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-xl)' }}>
      <div className="onboarding-step">
        <GraduationCapIcon size={64} style={{ color: 'var(--color-ink)' }} />
        <h1 className="type-display-md">Are you a college student?</h1>
        <p className="type-body-md" style={{ color: 'rgba(22, 16, 31,0.7)' }}>
          Verify your college email to unlock college-only events and get a student badge.
        </p>
        <div style={{ width: '100%' }}>
          <input
            type="email"
            className="input-field"
            placeholder="your.name@college.edu"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ marginBottom: 'var(--space-lg)' }}
          />
          <button
            onClick={sendOtp}
            className="btn btn--primary btn--full"
            style={{ marginBottom: 'var(--space-md)' }}
            disabled={busy || !email.includes('@')}
          >
            {busy ? 'Sending…' : 'Send verification code'}
          </button>
          <button onClick={() => setStep(4)} className="btn btn--ghost btn--full">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );

  if (step === 3) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-xl)' }}>
      <div className="onboarding-step">
        <h1 className="type-display-md">Enter your code</h1>
        <p className="type-body-md" style={{ color: 'rgba(22, 16, 31,0.7)' }}>
          We sent a 6-digit code to <strong>{email}</strong>.
        </p>
        <div style={{ width: '100%' }}>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            className="input-field"
            placeholder="000000"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ marginBottom: 'var(--space-lg)', fontFamily: 'var(--font-mono)', letterSpacing: '0.4em', textAlign: 'center' }}
          />
          <button onClick={confirmOtp} className="btn btn--primary btn--full" style={{ marginBottom: 'var(--space-md)' }} disabled={busy || otp.length !== 6}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
          <button onClick={() => setStep(2)} className="btn btn--ghost btn--full">Use a different email</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-xl)' }}>
      <div className="onboarding-step" style={{ color: 'var(--color-canvas)' }}>
        <SparklesIcon size={72} style={{ color: 'var(--color-accent)' }} />
        <h1 className="type-display-lg" style={{ color: 'var(--color-canvas)' }}>Welcome to Festify!</h1>
        <p className="type-body-md" style={{ color: 'rgba(251, 247, 240,0.8)' }}>
          You&apos;re a{' '}
          <strong style={{ color: 'var(--color-accent)', textTransform: 'capitalize' }}>
            {user?.customer_level || 'Bronze'}
          </strong>{' '}
          member. Attend events, earn points, and climb to Prime.
        </p>
        <button onClick={() => navigate('/')} className="btn btn--primary" style={{ fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ZapIcon size={16} filled /> Explore Events
        </button>
      </div>
    </div>
  );
}
