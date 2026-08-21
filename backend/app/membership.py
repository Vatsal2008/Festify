"""Two separate things that had become one.

`customer_level` was doing double duty. It held the gamification tier --
bronze, silver, gold, platinum -- and buying a Prime Pass overwrote it
with the literal string "prime". So a subscription silently destroyed
the tier a user had earned by attending events, and there was no way
back: nothing recorded what their level had been.

Downstream, the profile rendered a level badge reading PRIME, a Prime
badge reading PRIME, and a pass badge reading PRIME PASS, all at once,
because all three were reading the same overloaded column.

They are unrelated concepts and are now derived separately:

  Level   comes from users.lifetime_events_attended and nothing else.
          It is earned, permanent, and cannot be bought.
  Prime   comes from an active row in prime_passes and nothing else.
          It is paid for, expires, and says nothing about attendance.

Neither is stored as a flag anywhere, so the two can never contradict
each other or need reconciling after a payment.
"""
from datetime import datetime, timezone

# Thresholds are minimum events attended. Ordered low to high; the
# level is the last tier whose threshold has been met.
LEVEL_TIERS = [
    {"key": "bronze",   "label": "Bronze",   "min_events": 0},
    {"key": "silver",   "label": "Silver",   "min_events": 3},
    {"key": "gold",     "label": "Gold",     "min_events": 6},
    {"key": "platinum", "label": "Platinum", "min_events": 11},
]


def level_for(events_attended: int | None) -> dict:
    """The tier this attendance count earns, and the distance to the next.

    Returns the progress the UI needs to draw a bar that means something:
    a count toward a real threshold rather than a percentage invented
    from the tier's index, which is what the profile drew before and
    which moved even when the user had attended nothing.
    """
    attended = max(0, int(events_attended or 0))

    current = LEVEL_TIERS[0]
    for tier in LEVEL_TIERS:
        if attended >= tier["min_events"]:
            current = tier
        else:
            break

    index = LEVEL_TIERS.index(current)
    nxt = LEVEL_TIERS[index + 1] if index + 1 < len(LEVEL_TIERS) else None

    if nxt:
        span = nxt["min_events"] - current["min_events"]
        done = attended - current["min_events"]
        # span is never zero: thresholds strictly increase.
        percent = round(min(100, max(0, done * 100 / span)))
        remaining = max(0, nxt["min_events"] - attended)
    else:
        # The top tier has nothing above it. A bar that sits at 100 with
        # no next label reads as complete rather than as broken.
        percent, remaining = 100, 0

    return {
        "key": current["key"],
        "label": current["label"],
        "events_attended": attended,
        "next_key": nxt["key"] if nxt else None,
        "next_label": nxt["label"] if nxt else None,
        "next_at": nxt["min_events"] if nxt else None,
        "events_to_next": remaining,
        "percent": percent,
        "is_max": nxt is None,
    }


def prime_status(active_pass: dict | None) -> dict:
    """Subscription state, derived only from the pass row.

    An expired pass is not an active one, and get_active_pass already
    settles expiry on read, so a missing or non-active row is simply
    "not a member" with nothing further to check.
    """
    if not active_pass:
        return {"is_prime": False, "expires_at": None, "plan": None}

    expires = active_pass.get("expires_at")
    if expires:
        try:
            if datetime.fromisoformat(str(expires).replace("Z", "+00:00")) < datetime.now(timezone.utc):
                return {"is_prime": False, "expires_at": None, "plan": None}
        except ValueError:
            pass

    return {
        "is_prime": True,
        "expires_at": expires,
        "plan": active_pass.get("plan"),
    }
