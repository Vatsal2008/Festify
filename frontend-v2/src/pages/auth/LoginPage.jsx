// pages/auth/LoginPage.jsx — Interactive Dual Sliding Panel Sign In & Sign Up
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { HERO_BACKGROUND_IMAGE } from '@/data/mockData';
import { GraduationCapIcon, SparklesIcon, ArrowRightIcon, ZapIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpCollege, setSignUpCollege] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  const handleGoogleLogin = () => {
    setLoading(true);
    login();
    const returnUrl = sessionStorage.getItem('festify_return_url') || '/';
    sessionStorage.removeItem('festify_return_url');
    setTimeout(() => { navigate(returnUrl); }, 900);
  };

  const handleSignInSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    login();
    setTimeout(() => { navigate('/'); }, 900);
  };

  const handleSignUpSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    login();
    setTimeout(() => { navigate('/onboarding'); }, 900);
  };

  return (
    <div className="auth-split-wrapper">
      <div className={`auth-split-card ${isSignUp ? 'auth-split-card--signup' : ''}`}>

        {/* ── Left Side: Sign In Form ── */}
        <div className="auth-form-side" style={{ opacity: isSignUp ? 0.3 : 1, pointerEvents: isSignUp ? 'none' : 'all' }}>
          <div>
            <p className="type-label-mono" style={{ color: 'var(--color-accent)', marginBottom: 4 }}>Festify Portal</p>
            <h1 className="type-display-md" style={{ color: 'var(--color-ink)' }}>Sign In</h1>
          </div>

          <button className="login-google-btn" onClick={handleGoogleLogin} disabled={loading || isLoading} aria-label="Sign in with Google">
            {loading || isLoading ? (
              <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(22, 16, 31,0.3)', borderTopColor: 'var(--color-ink)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
            ) : (
              <>
                <span className="login-google-btn__icon" aria-hidden="true">G</span>
                Continue with Google
              </>
            )}
          </button>

          <div className="login-divider">or sign in with email</div>

          <form onSubmit={handleSignInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div className="input-wrapper">
              <label className="input-label">Email address</label>
              <input
                type="email"
                className="input-field"
                placeholder="vatsal@example.com"
                value={signInEmail}
                onChange={e => setSignInEmail(e.target.value)}
                required
              />
            </div>
            <div className="input-wrapper">
              <label className="input-label">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={signInPassword}
                onChange={e => setSignInPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn--primary btn--full" style={{ marginTop: 8 }}>
              Sign In
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: 'var(--border-hairline)' }}>
            <button onClick={() => navigate('/college-admin/login')} className="login-guest-link" style={{ textDecoration: 'none', fontSize: 12 }}>
              College Admin →
            </button>
            <button onClick={() => navigate('/superadmin')} className="login-guest-link" style={{ textDecoration: 'none', fontSize: 12 }}>
              Super Admin →
            </button>
            <button onClick={() => navigate('/')} className="login-guest-link" style={{ fontSize: 12 }}>
              Browse Guest
            </button>
          </div>
        </div>

        {/* ── Right Side: Sign Up Form ── */}
        <div className="auth-form-side" style={{ opacity: isSignUp ? 1 : 0.3, pointerEvents: isSignUp ? 'all' : 'none' }}>
          <div>
            <p className="type-label-mono" style={{ color: 'var(--color-accent)', marginBottom: 4 }}>Join Festify</p>
            <h1 className="type-display-md" style={{ color: 'var(--color-ink)' }}>Create Account</h1>
          </div>

          <form onSubmit={handleSignUpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div className="input-wrapper">
              <label className="input-label">Full Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Vatsal Shah"
                value={signUpName}
                onChange={e => setSignUpName(e.target.value)}
                required
              />
            </div>
            <div className="input-wrapper">
              <label className="input-label">College Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="vatsal@bits.ac.in"
                value={signUpEmail}
                onChange={e => setSignUpEmail(e.target.value)}
                required
              />
            </div>
            <div className="input-wrapper">
              <label className="input-label">College / University</label>
              <input
                type="text"
                className="input-field"
                placeholder="BITS Pilani"
                value={signUpCollege}
                onChange={e => setSignUpCollege(e.target.value)}
              />
            </div>
            <div className="input-wrapper">
              <label className="input-label">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={signUpPassword}
                onChange={e => setSignUpPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn--primary btn--full" style={{ marginTop: 8 }}>
              Create Account
            </button>
          </form>

          <p className="type-body-xs" style={{ color: 'rgba(22, 16, 31,0.5)', textAlign: 'center' }}>
            By registering, you agree to Festify's Terms &amp; Privacy Policy.
          </p>
        </div>

        {/* ── Sliding Overlay Panel ── */}
        <div
          className="auth-overlay-panel"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(22, 16, 31, 0.88) 0%, rgba(22, 16, 31, 0.96) 100%), url(${HERO_BACKGROUND_IMAGE})`,
          }}
        >
          {!isSignUp ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xl)' }}>
              <SparklesIcon size={48} style={{ color: 'var(--color-accent)' }} />
              <div>
                <h2 className="type-display-lg" style={{ color: 'var(--color-canvas)', marginBottom: 'var(--space-sm)' }}>
                  New to Festify?
                </h2>
                <p className="type-body-md" style={{ color: 'rgba(251, 247, 240,0.85)', maxWidth: 320, lineHeight: 1.5 }}>
                  Discover fests, register for hackathons, and earn Prime access across top colleges in India.
                </p>
              </div>
              <button
                className="btn btn--ghost-canvas"
                onClick={() => setIsSignUp(true)}
                style={{ padding: '12px 32px', fontSize: 15, borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                Sign Up <ArrowRightIcon size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xl)' }}>
              <ZapIcon size={48} filled style={{ color: 'var(--color-accent)' }} />
              <div>
                <h2 className="type-display-lg" style={{ color: 'var(--color-canvas)', marginBottom: 'var(--space-sm)' }}>
                  Welcome Back!
                </h2>
                <p className="type-body-md" style={{ color: 'rgba(251, 247, 240,0.85)', maxWidth: 320, lineHeight: 1.5 }}>
                  Already have a Festify account? Sign in to access your ticket wallet and check-in codes.
                </p>
              </div>
              <button
                className="btn btn--ghost-canvas"
                onClick={() => setIsSignUp(false)}
                style={{ padding: '12px 32px', fontSize: 15, borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                Sign In <ArrowRightIcon size={16} />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// pages/auth/OnboardingPage.jsx
export function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleScroll = (e) => {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 10) setHasScrolled(true);
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
          <p><strong>5. Reviews:</strong> Only ticket buyers can review. Reviews are moderated. Bad-word detection is active.</p><br/>
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
          <button onClick={() => setStep(3)} className="btn btn--primary btn--full" style={{ marginBottom: 'var(--space-md)' }}>
            Verify College Email
          </button>
          <button onClick={() => setStep(3)} className="btn btn--ghost btn--full">
            Skip for now
          </button>
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
          You're a <strong style={{ color: 'var(--color-accent)' }}>Bronze</strong> member. Attend events, earn points, and climb to Prime.
        </p>
        <button onClick={() => navigate('/')} className="btn btn--primary" style={{ fontSize: 16 }}>
          Explore Events →
        </button>
      </div>
    </div>
  );
}
