// pages/admin/SuperAdminGate.jsx
// Guards every /super/* panel route.
//
// The gate used to carry the whole step-up flow -- request a code, type
// it, verify -- on top of a Google session. Sign-in now lives at /super
// as a login of its own, so this is only a check: is there a session,
// is it a super admin, and has it passed the emailed code. Anything
// else sends the visitor to the door rather than trying to open it here.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { platformApi } from '@/lib/api/endpoints';
import { apiError, tokenStore } from '@/lib/api/client';
import { Spinner } from '@/components/primitives/Primitives';
import Button from '@/components/primitives/Button';
import { ShieldIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

export default function SuperAdminGate({ children }) {
  const navigate = useNavigate();
  const hasToken = !!tokenStore.get();

  const statusQuery = useQuery({
    queryKey: ['super-admin', 'status'],
    queryFn: platformApi.superAdminStatus,
    enabled: hasToken,
    retry: false,
  });

  const denied =
    !hasToken ||
    (statusQuery.isSuccess && (!statusQuery.data?.is_super_admin || !statusQuery.data?.verified));

  // Redirect in an effect, not during render -- navigating while
  // rendering is what produces the "cannot update during render"
  // warnings and, in a guard like this, a redirect loop.
  useEffect(() => {
    if (denied) navigate('/super', { replace: true });
  }, [denied, navigate]);

  if (!hasToken || statusQuery.isLoading) {
    return <Centered><Spinner size="lg" /></Centered>;
  }

  if (statusQuery.isError) {
    return (
      <Centered>
        <ShieldIcon size={36} style={{ color: 'var(--color-accent)' }} />
        <h1 className="type-display-md">Could not check your access</h1>
        <p className="type-body-md" style={{ color: 'rgba(251,247,240,0.75)', maxWidth: 420 }}>
          {apiError(statusQuery.error)}
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <Button variant="primary" onClick={() => statusQuery.refetch()}>Try again</Button>
          <Button variant="ghost-canvas" onClick={() => navigate('/super', { replace: true })}>
            Sign in again
          </Button>
        </div>
      </Centered>
    );
  }

  if (denied) return <Centered><Spinner size="lg" /></Centered>;

  return children;
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
