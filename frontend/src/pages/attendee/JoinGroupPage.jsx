// pages/attendee/JoinGroupPage.jsx
// The other end of the key: paste it, and a ticket is yours if the
// group still has one free.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageShell, TealBand, CanvasBand } from '@/components/layout';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { Avatar } from '@/components/primitives/Primitives';
import { groupsApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { useToast } from '@/store/uiStore';
import { CheckIcon, UsersIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

export default function JoinGroupPage() {
  const [key, setKey] = useState('');
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const groupsQuery = useQuery({ queryKey: ['ticket-groups', 'mine'], queryFn: groupsApi.mine });

  const join = useMutation({
    mutationFn: () => groupsApi.join(key),
    onSuccess: (g) => {
      setKey('');
      qc.invalidateQueries({ queryKey: ['ticket-groups'] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      const mine = g.members?.find((m) => m.has_ticket && !m.is_leader);
      toast.success(mine ? 'Joined — your ticket is in your wallet.' : 'Joined the group.');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const groups = groupsQuery.data ?? [];

  return (
    <PageShell>
      <TealBand variant="compact">
        <h1 className="type-display-md" style={{ color: 'var(--color-canvas)' }}>Groups</h1>
      </TealBand>

      <CanvasBand>
        <section className="jg">
          <h2 className="type-label-mono">Join a group</h2>
          <p className="jg__body">
            Whoever bought the tickets can send you a key. Enter it here and your ticket lands in
            your wallet.
          </p>
          <form
            className="jg__form"
            onSubmit={(e) => { e.preventDefault(); if (key.trim()) join.mutate(); }}
          >
            <input
              className="input-field jg__input"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="ABCD2345"
              maxLength={12}
              aria-label="Group key"
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" variant="primary" isLoading={join.isPending} isDisabled={!key.trim()}>
              Join
            </Button>
          </form>
        </section>

        <section className="jg__list" aria-label="Your groups">
          <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-lg)' }}>Your groups</h2>

          {groupsQuery.isSuccess && groups.length === 0 && (
            <div className="empty-state">
              <h2 className="empty-state__title">No groups yet</h2>
              <p className="empty-state__sub">
                Enter a key above, or create a group from a ticket you bought for several people.
              </p>
              <Button variant="primary" onClick={() => navigate('/me/tickets')}>Go to my tickets</Button>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.id} className="jg__card">
              <div className="jg__card-head">
                <div>
                  <p className="jg__card-title"><UsersIcon size={14} /> {g.event?.title ?? 'Event'}</p>
                  <p className="jg__card-sub">{g.name}</p>
                </div>
                <Badge variant={g.is_leader ? 'accent' : 'default'}>
                  {g.is_leader ? 'You lead this' : 'Member'}
                </Badge>
              </div>

              <div className="jg__card-members">
                {g.members.map((m) => (
                  <span key={m.user_id} className="jg__chip" title={m.name}>
                    <Avatar name={m.name} src={m.avatar_url} size="xs" />
                    {m.name.split(' ')[0]}
                    {m.has_ticket && <CheckIcon size={11} />}
                  </span>
                ))}
              </div>

              <div className="jg__card-foot">
                <span className="jg__card-count">{g.seats_taken}/{g.size} seated</span>
                <Button variant="secondary" size="sm" onClick={() => navigate('/me/tickets')}>
                  View tickets
                </Button>
              </div>
            </div>
          ))}
        </section>
      </CanvasBand>
    </PageShell>
  );
}
