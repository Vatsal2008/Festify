// components/domain/TicketGroupPanel.jsx
//
// Group sharing, from the ticket you already hold.
//
// Sharing used to require inviting people by user id, which means
// knowing who they are inside Festify. There is no user directory here,
// and building one would make every account searchable by strangers --
// a cost paid by everyone so a few people can find their friends. A key
// sent over WhatsApp moves that to a channel people already use and
// exposes nobody.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { Avatar, Spinner } from '@/components/primitives/Primitives';
import { groupsApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { useToast } from '@/store/uiStore';
import { UsersIcon, CheckIcon, XIcon } from '@/components/icons/Icons';
import './domain.css';

export default function TicketGroupPanel({ event, ticketCount }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const groupsQuery = useQuery({
    queryKey: ['ticket-groups', 'mine'],
    queryFn: groupsApi.mine,
  });

  const group = (groupsQuery.data ?? []).find((g) => g.event?.id === event?.id);

  const refresh = () => qc.invalidateQueries({ queryKey: ['ticket-groups'] });

  const create = useMutation({
    mutationFn: () => groupsApi.create(event.id),
    onSuccess: () => { refresh(); toast.success('Group created. Share the key with your friends.'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const act = useMutation({
    mutationFn: ({ kind, userId }) =>
      kind === 'assign' ? groupsApi.assign(group.id, userId)
        : kind === 'unassign' ? groupsApi.unassign(group.id, userId)
        : kind === 'remove' ? groupsApi.removeMember(group.id, userId)
        : groupsApi.rotateKey(group.id),
    onSuccess: (_d, { kind }) => {
      refresh();
      qc.invalidateQueries({ queryKey: ['tickets'] });
      toast.success(
        kind === 'assign' ? 'Ticket assigned.'
          : kind === 'unassign' ? 'Ticket taken back.'
          : kind === 'remove' ? 'Removed from the group.'
          : 'New key issued — the old one no longer works.'
      );
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(group.join_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(`Group key: ${group.join_key}`);
    }
  };

  const shareWhatsApp = () => {
    const text = `Join my group for ${event.title} on Festify.\nGroup key: ${group.join_key}\n\nOpen Festify → Profile → Join a group, and enter the key.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  if (groupsQuery.isLoading) {
    return <div className="tg" style={{ display: 'grid', placeItems: 'center', minHeight: 100 }}><Spinner /></div>;
  }

  // Nothing to share with a single ticket, so nothing is offered.
  if (!group && (ticketCount ?? 0) < 2) return null;

  if (!group) {
    return (
      <section className="tg" aria-label="Share these tickets">
        <h2 className="type-label-mono tg__title"><UsersIcon size={14} /> Share these tickets</h2>
        <p className="tg__body">
          You have {ticketCount} tickets for this event. Make a group and you get a key to send your
          friends — each one who joins is given a ticket automatically.
        </p>
        <Button variant="primary" isLoading={create.isPending} onClick={() => create.mutate()}>
          Create group
        </Button>
      </section>
    );
  }

  const pending = act.isPending ? act.variables?.userId : null;

  return (
    <section className="tg" aria-label="Ticket group">
      <div className="tg__head">
        <h2 className="type-label-mono tg__title"><UsersIcon size={14} /> {group.name}</h2>
        <Badge variant={group.seats_free ? 'warning' : 'success'}>
          {group.seats_taken}/{group.size} seated
        </Badge>
      </div>

      {group.is_leader && (
        <div className="tg__key-block">
          <p className="tg__key-label">Group key — share this, not a link</p>
          <div className="tg__key-row">
            <code className="tg__key">{group.join_key}</code>
            <Button variant="secondary" size="sm" onClick={copyKey}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="primary" size="sm" onClick={shareWhatsApp}>Share</Button>
          </div>
          <p className="tg__key-hint">
            They open Festify, go to Profile → Join a group, and enter it.
          </p>
        </div>
      )}

      <ul className="tg__members">
        {group.members.map((m) => (
          <li key={m.user_id} className="tg__member">
            <Avatar name={m.name} src={m.avatar_url} size="sm" />
            <div className="tg__member-main">
              <p className="tg__member-name">
                {m.name}
                {m.is_leader && <span className="tg__leader">Leader</span>}
              </p>
              <p className="tg__member-sub">
                {m.has_ticket
                  ? <><CheckIcon size={12} /> {m.booking_code}</>
                  : 'No ticket yet'}
              </p>
            </div>

            {group.is_leader && !m.is_leader && (
              <div className="tg__member-actions">
                {m.has_ticket ? (
                  <Button variant="ghost" size="sm" isLoading={pending === m.user_id}
                    onClick={() => act.mutate({ kind: 'unassign', userId: m.user_id })}>
                    Take back
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" isLoading={pending === m.user_id}
                    isDisabled={!group.seats_free}
                    onClick={() => act.mutate({ kind: 'assign', userId: m.user_id })}>
                    Give ticket
                  </Button>
                )}
                <button className="tg__kick" aria-label={`Remove ${m.name}`}
                  onClick={() => act.mutate({ kind: 'remove', userId: m.user_id })}>
                  <XIcon size={13} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {group.is_leader && (
        <div className="tg__foot">
          <p className="tg__note">
            {group.seats_free
              ? `${group.seats_free} ticket${group.seats_free === 1 ? '' : 's'} still free — the next person to use the key gets one.`
              : 'Every ticket in this group is taken.'}
          </p>
          <Button variant="ghost" size="sm" onClick={() => act.mutate({ kind: 'rotate' })}>
            New key
          </Button>
        </div>
      )}

      {/* Said plainly rather than discovered by a member hunting for a
          Leave button that is not there. */}
      {!group.is_leader && (
        <p className="tg__note">
          These tickets belong to {group.members.find((m) => m.is_leader)?.name ?? 'the leader'}.
          Ask them if you need to hand yours back.
        </p>
      )}
    </section>
  );
}
