// pages/attendee/PrimePassPage.jsx
// Prime Pass used to be UI copy with "TBD" prices and a button that
// raised a "Pricing coming soon" toast -- nothing could grant the pass.
// Plans, prices and benefits now come from the API, and the buttons run
// a real Razorpay purchase.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { PageShell, TealBand, CanvasBand } from '@/components/layout';
import { PrimePassBadge } from '@/components/domain';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { Spinner } from '@/components/primitives/Primitives';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/store/uiStore';
import { primePassApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { openCheckout } from '@/lib/payments/razorpay';
import { CheckIcon, SparklesIcon, ZapIcon } from '@/components/icons/Icons';
import { format } from 'date-fns';
import '@/pages/pages.css';

const PENDING_KEY = 'festify_pending_prime_pass';

export default function PrimePassPage() {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const plansQuery = useQuery({ queryKey: ['prime-pass', 'plans'], queryFn: primePassApi.plans });
  const mineQuery = useQuery({
    queryKey: ['prime-pass', 'mine'],
    queryFn: primePassApi.mine,
    enabled: isAuthenticated,
  });

  // A redirect-based payment method destroys the page that opened
  // Checkout, taking the success handler with it. The same reconciliation
  // the ticket wallet needed applies here.
  useEffect(() => {
    const pendingId = sessionStorage.getItem(PENDING_KEY);
    if (!pendingId || !isAuthenticated) return;
    sessionStorage.removeItem(PENDING_KEY);
    primePassApi.sync(pendingId)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['prime-pass'] });
        refreshUser?.();
        toast.success('Prime Pass activated.');
      })
      .catch(() => { /* nothing to reconcile */ });
  }, [isAuthenticated, qc, toast, refreshUser]);

  const buy = useMutation({
    mutationFn: async (plan) => {
      const order = await primePassApi.createOrder(plan);
      sessionStorage.setItem(PENDING_KEY, order.prime_pass_id);
      const result = await openCheckout({
        order,
        user,
        eventTitle: `Festify Prime Pass — ${order.plan.label}`,
      });
      sessionStorage.removeItem(PENDING_KEY);
      return primePassApi.verify(order.prime_pass_id, result);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prime-pass'] });
      refreshUser?.();
      toast.success('Welcome to Prime. Your pass is active.');
    },
    onError: (e) => {
      sessionStorage.removeItem(PENDING_KEY);
      toast.error(apiError(e));
    },
  });

  if (!isAuthenticated) {
    return (
      <PageShell>
        <CanvasBand>
          <div className="empty-state">
            <SparklesIcon size={56} />
            <h2 className="empty-state__title">Sign in to get Prime</h2>
            <Button variant="primary" onClick={() => navigate('/login')}>Sign in</Button>
          </div>
        </CanvasBand>
      </PageShell>
    );
  }

  const benefits = plansQuery.data?.benefits ?? [];
  const plans = plansQuery.data?.plans ?? [];
  const active = mineQuery.data?.pass;
  const hasPass = mineQuery.data?.has_prime_pass;

  if (mineQuery.isPending || plansQuery.isPending) {
    return (
      <PageShell>
        <CanvasBand>
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}><Spinner size="lg" /></div>
        </CanvasBand>
      </PageShell>
    );
  }

  if (hasPass) {
    return (
      <PageShell>
        <TealBand>
          <motion.div
            style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto' }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ display: 'inline-block', marginBottom: 'var(--space-lg)' }}
            >
              <SparklesIcon size={48} style={{ color: 'var(--color-accent)' }} />
            </motion.div>
            <h1 className="type-display-lg" style={{ color: 'var(--color-canvas)', marginBottom: 'var(--space-lg)' }}>
              You have <span style={{ color: 'var(--color-accent)' }}>Prime Pass</span>
            </h1>
            <PrimePassBadge />
            {active?.expires_at && (
              <p className="type-body-md" style={{ color: 'rgba(251,247,240,0.75)', marginTop: 'var(--space-lg)' }}>
                {active.plan === 'annual' ? 'Annual' : 'Monthly'} plan · renews {format(new Date(active.expires_at), 'd MMM yyyy')}
              </p>
            )}
          </motion.div>
        </TealBand>
        <CanvasBand>
          <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-xl)' }}>Your benefits</h2>
          <div className="prime-benefits">
            {benefits.map((b, i) => (
              <motion.div
                key={b} className="prime-benefit"
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
              >
                <span style={{ color: 'var(--color-success)' }}><CheckIcon size={16} /></span>
                <span className="type-body-md">{b}</span>
              </motion.div>
            ))}
          </div>
        </CanvasBand>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <TealBand>
        <motion.div
          style={{ textAlign: 'center', maxWidth: 580, margin: '0 auto' }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        >
          <h1 className="type-display-lg" style={{ color: 'var(--color-canvas)', marginBottom: 'var(--space-lg)' }}>
            Festify <span style={{ color: 'var(--color-accent)' }}>Prime Pass</span>
          </h1>
          <p className="type-body-md" style={{ color: 'rgba(251,247,240,0.8)' }}>
            Buy before general sale, get a dedicated ticket pool, and wear the badge.
          </p>
        </motion.div>
      </TealBand>

      <CanvasBand>
        <div className="prime-plans">
          {plans.map((plan, i) => {
            const isAnnual = plan.plan === 'annual';
            const monthlyPlan = plans.find(p => p.plan === 'monthly');
            const saving = isAnnual && monthlyPlan
              ? Math.round(100 - (plan.amount / (monthlyPlan.amount * 12)) * 100)
              : 0;
            return (
              <motion.div
                key={plan.plan}
                className={`prime-plan ${isAnnual ? 'prime-plan--featured' : ''}`}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
              >
                {isAnnual && saving > 0 && (
                  <Badge variant="accent" className="prime-plan__flag">Save {saving}%</Badge>
                )}
                <p className="type-label-mono">{plan.label}</p>
                <p className="prime-plan__price">
                  ₹{plan.amount}
                  <span className="prime-plan__unit">/{isAnnual ? 'year' : 'month'}</span>
                </p>
                {isAnnual && monthlyPlan && (
                  <p className="prime-plan__sub">
                    Works out to ₹{Math.round(plan.amount / 12)} a month
                  </p>
                )}
                <Button
                  variant={isAnnual ? 'primary' : 'secondary'}
                  fullWidth
                  isLoading={buy.isPending && buy.variables === plan.plan}
                  isDisabled={buy.isPending}
                  onClick={() => buy.mutate(plan.plan)}
                >
                  <ZapIcon size={15} filled /> Get {plan.label}
                </Button>
              </motion.div>
            );
          })}
        </div>

        <h2 className="type-label-mono" style={{ margin: 'var(--space-3xl) 0 var(--space-xl)', textAlign: 'center' }}>
          What you get
        </h2>
        <div className="prime-benefits prime-benefits--centered">
          {benefits.map((b, i) => (
            <motion.div
              key={b} className="prime-benefit"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05, duration: 0.35 }}
            >
              <span style={{ color: 'var(--color-success)' }}><CheckIcon size={16} /></span>
              <span className="type-body-md">{b}</span>
            </motion.div>
          ))}
        </div>
      </CanvasBand>
    </PageShell>
  );
}
