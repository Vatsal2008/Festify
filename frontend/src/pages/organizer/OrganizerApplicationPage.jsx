// pages/organizer/OrganizerApplicationPage.jsx
// Two buttons pointed at /organizer-application and this page did not
// exist, so applying as an organizer navigated to nothing. The backend
// endpoints were already there and working.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { PageShell, TealBand, CanvasBand } from '@/components/layout';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { Spinner } from '@/components/primitives/Primitives';
import { adminApi, platformApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/store/uiStore';
import {
  UsersIcon, CheckIcon, GraduationCapIcon, AlertTriangleIcon,
  ArrowLeftIcon, SparklesIcon, TrophyIcon, BarChartIcon,
} from '@/components/icons/Icons';
import { format } from 'date-fns';
import '@/pages/pages.css';

const WHAT_YOU_GET = [
  { icon: <SparklesIcon size={18} />, title: 'Publish events', text: 'Create listings, set tiers and pricing, and open sales to the whole platform.' },
  { icon: <BarChartIcon size={18} />, title: 'Live dashboard', text: 'Track sales, revenue and check-ins as they happen.' },
  { icon: <UsersIcon size={18} />, title: 'Run a team', text: 'Add members, assign scanners, and control the gate on event day.' },
  { icon: <TrophyIcon size={18} />, title: 'Build a score', text: 'Well-run events raise your organizer score and surface you higher in discovery.' },
];

const STATUS_VARIANT = { pending: 'warning', approved: 'success', rejected: 'error' };

export default function OrganizerApplicationPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [collegeId, setCollegeId] = useState('');

  const collegesQuery = useQuery({ queryKey: ['colleges'], queryFn: platformApi.colleges });
  const mineQuery = useQuery({
    queryKey: ['organizer-applications', 'mine'],
    queryFn: adminApi.myApplications,
    enabled: isAuthenticated,
  });

  const apply = useMutation({
    mutationFn: () => adminApi.applyAsOrganizer(collegeId || null),
    onSuccess: () => {
      toast.success('Application submitted. You will hear back once it is reviewed.');
      qc.invalidateQueries({ queryKey: ['organizer-applications', 'mine'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (!isAuthenticated) {
    return (
      <PageShell>
        <CanvasBand>
          <div className="empty-state">
            <UsersIcon size={56} />
            <h2 className="empty-state__title">Sign in to apply</h2>
            <p className="empty-state__sub">Organizer applications are tied to your account.</p>
            <Button variant="primary" onClick={() => navigate('/login')}>Sign in</Button>
          </div>
        </CanvasBand>
      </PageShell>
    );
  }

  const applications = mineQuery.data ?? [];
  const pending = applications.find(a => a.status === 'pending');
  const approved = applications.find(a => a.status === 'approved');
  const alreadyOrganizer = (user?.org_memberships ?? []).length > 0;

  return (
    <PageShell>
      <TealBand variant="compact">
        <button onClick={() => navigate(-1)} className="back-link">
          <ArrowLeftIcon size={14} /> Back
        </button>
        <h1 className="type-display-md" style={{ color: 'var(--color-canvas)' }}>Become an organizer</h1>
        <p className="type-body-md" style={{ color: 'rgba(251,247,240,0.75)', marginTop: 'var(--space-sm)', maxWidth: 520 }}>
          Run your own events on Festify — sell tickets, manage a team and get paid.
        </p>
      </TealBand>

      <CanvasBand>
        <AnimatePresence mode="wait">
          {alreadyOrganizer ? (
            <motion.div key="already" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="apply-status apply-status--ok">
              <CheckIcon size={24} />
              <div>
                <h2 className="type-heading-sm">You are already an organizer</h2>
                <p className="type-body-md" style={{ opacity: 0.75 }}>
                  Head to your dashboard to create and manage events.
                </p>
              </div>
              <Button variant="primary" onClick={() => navigate(`/org/${user.org_memberships[0].org_id}/dashboard`)}>
                Open dashboard
              </Button>
            </motion.div>
          ) : approved ? (
            <motion.div key="approved" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="apply-status apply-status--ok">
              <CheckIcon size={24} />
              <div>
                <h2 className="type-heading-sm">Application approved</h2>
                <p className="type-body-md" style={{ opacity: 0.75 }}>
                  Sign out and back in to pick up your new organizer access.
                </p>
              </div>
            </motion.div>
          ) : pending ? (
            <motion.div key="pending" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="apply-status apply-status--pending">
              <Spinner size="sm" />
              <div>
                <h2 className="type-heading-sm">Application under review</h2>
                <p className="type-body-md" style={{ opacity: 0.75 }}>
                  Submitted {pending.created_at ? format(new Date(pending.created_at), 'd MMM yyyy') : 'recently'} ·
                  {' '}reviewed by {pending.routed_to === 'college_admin' ? 'your college admin' : 'the Festify team'}.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="apply-grid">
                <div>
                  <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-lg)' }}>What you get</h2>
                  <div className="apply-benefits">
                    {WHAT_YOU_GET.map((b, i) => (
                      <motion.div
                        key={b.title}
                        className="apply-benefit"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07, duration: 0.35 }}
                      >
                        <span className="apply-benefit__icon">{b.icon}</span>
                        <div>
                          <p className="apply-benefit__title">{b.title}</p>
                          <p className="apply-benefit__text">{b.text}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="apply-form">
                  <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-lg)' }}>Apply</h2>

                  <label className="apply-label" htmlFor="college">
                    <GraduationCapIcon size={14} /> Your college
                  </label>
                  <select
                    id="college"
                    className="input-field"
                    value={collegeId}
                    onChange={(e) => setCollegeId(e.target.value)}
                  >
                    <option value="">Not affiliated with a college</option>
                    {(collegesQuery.data ?? []).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  {/* Routing is worth stating plainly: who reviews the
                      application changes with this choice, and that
                      changes how long it takes. */}
                  <p className="apply-hint">
                    {collegeId
                      ? 'Your college admin reviews this application.'
                      : 'Without a college, the Festify team reviews this application, which usually takes longer.'}
                  </p>

                  <Button
                    variant="primary"
                    fullWidth
                    isLoading={apply.isPending}
                    onClick={() => apply.mutate()}
                    style={{ marginTop: 'var(--space-lg)' }}
                  >
                    Submit application
                  </Button>

                  {applications.some(a => a.status === 'rejected') && (
                    <div className="apply-note">
                      <AlertTriangleIcon size={15} />
                      <span>A previous application was declined. You can apply again.</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {applications.length > 0 && (
          <div style={{ marginTop: 'var(--space-3xl)' }}>
            <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-lg)' }}>Your applications</h2>
            <div className="apply-history">
              {applications.map(a => (
                <div key={a.id} className="apply-history__row">
                  <span className="type-body-sm">
                    {a.created_at ? format(new Date(a.created_at), 'd MMM yyyy, h:mm a') : '—'}
                  </span>
                  <span className="type-body-sm" style={{ opacity: 0.65 }}>
                    {a.routed_to === 'college_admin' ? 'College admin' : 'Festify team'}
                  </span>
                  <Badge variant={STATUS_VARIANT[a.status] ?? 'default'}>{a.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CanvasBand>
    </PageShell>
  );
}
