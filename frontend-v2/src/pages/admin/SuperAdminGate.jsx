// pages/admin/SuperAdminGate.jsx
// Second factor on the super admin panel: a code emailed to the admin,
// required before the panel renders.
//
// This is a step-up check on an already-authenticated session, not a
// login. It cannot grant access — only confirm that whoever holds the
// session also controls the admin's mailbox. Verification lasts an hour,
// so a stolen session is not permanently elevated.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { platformApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { Spinner } from '@/components/primitives/Primitives';
import Button from '@/components/primitives/Button';
import { ZapIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

export default function SuperAdminGate({ children }) {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [error, setError] = useState(null);

  const statusQuery = useQuery({
    queryKey: ['super-admin', 'status'],
    queryFn: platformApi.superAdminStatus,
    enabled: !!user,
  });

  const requestCode = useMutation({
    mutationFn: platformApi.requestSuperAdminCode,
    onSuccess: (d) => { setSentTo(d.sent_to); setError(null); },
    onError: (e) => setError(apiError(e)),
  });

  const verifyCode = useMutation({
    mutationFn: () => platformApi.verifySuperAdminCode(code),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['super-admin', 'status'] });
    },
    onError: (e) => setError(apiError(e)),
  });

  if (authLoading || statusQuery.isPending) {
    return <Centered><Spinner size="lg" /></Centered>;
  }

  if (!user) {
    return (
      <Centered>
        <h1 className="type-display-md">Sign in first</h1>
        <p className="type-body-md" style={{ color: 'rgba(251,247,240,0.75)' }}>
          The admin panel needs a signed-in account.
        </p>
        <Button variant="primary" onClick={() => navigate('/login')}>Sign in</Button>
      </Centered>
    );
  }

  if (!statusQuery.data?.is_super_admin) {
    return (
      <Centered>
        <h1 className="type-display-md">Not an admin account</h1>
        <p className="type-body-md" style={{ color: 'rgba(251,247,240,0.75)' }}>
          {user.email} doesn&apos;t have super admin access.
        </p>
        <Button variant="ghost-canvas" onClick={() => navigate('/')}>Back to Festify</Button>
      </Centered>
    );
  }

  // Already verified in the last hour — show the panel.
  if (statusQuery.data?.verified) return children;

  return (
    <Centered>
      <ZapIcon size={40} filled style={{ color: 'var(--color-accent)' }} />
      <h1 className="type-display-md">Admin verification</h1>

      {!sentTo ? (
        <>
          <p className="type-body-md" style={{ color: 'rgba(251,247,240,0.75)', maxWidth: 380 }}>
            To open the admin panel, we&apos;ll email a 6-digit code to{' '}
            <strong style={{ color: 'var(--color-canvas)' }}>{user.email}</strong>.
          </p>
          <Button
            variant="primary"
            isLoading={requestCode.isPending}
            onClick={() => requestCode.mutate()}
          >
            Email me a code
          </Button>
        </>
      ) : (
        <>
          <p className="type-body-md" style={{ color: 'rgba(251,247,240,0.75)', maxWidth: 380 }}>
            Code sent to <strong style={{ color: 'var(--color-canvas)' }}>{sentTo}</strong>. It expires in 10 minutes.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            className="input-field"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) verifyCode.mutate(); }}
            style={{
              maxWidth: 240, fontFamily: 'var(--font-mono)',
              letterSpacing: '0.4em', textAlign: 'center', fontSize: 20,
            }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <Button
              variant="primary"
              isDisabled={code.length !== 6}
              isLoading={verifyCode.isPending}
              onClick={() => verifyCode.mutate()}
            >
              Verify
            </Button>
            <Button
              variant="ghost-canvas"
              isLoading={requestCode.isPending}
              onClick={() => { setCode(''); requestCode.mutate(); }}
            >
              Resend
            </Button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="type-body-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
      )}
    </Centered>
  );
}

function Centered({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-ink)', color: 'var(--color-canvas)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 'var(--space-xl)', padding: 'var(--space-xl)', textAlign: 'center',
    }}>
      {children}
    </div>
  );
}
