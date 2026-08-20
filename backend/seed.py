"""Seed the database with realistic demo content.

Idempotent: re-running wipes the rows it previously created (matched by
the marker emails / college domains below) and recreates them, so it is
safe to run repeatedly during development. It never touches rows it did
not create.

Usage:  python seed.py
"""
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, ".")
from app.core.supabase_client import get_supabase  # noqa: E402

sb = get_supabase()

SEED_EMAILS = [
    "aarav.seed@festify.dev",
    "diya.seed@festify.dev",
    "kabir.seed@festify.dev",
]
SEED_DOMAINS = ["bits-pilani.seed", "iitb.seed", "srcc.seed"]


def now_plus(days: int, hour: int = 18) -> str:
    d = datetime.now(timezone.utc) + timedelta(days=days)
    return d.replace(hour=hour, minute=0, second=0, microsecond=0).isoformat()


# ---------------------------------------------------------------- wipe
print("clearing previous seed data...")
users = sb.table("users").select("id").in_("email", SEED_EMAILS).execute().data
user_ids = [u["id"] for u in users]
colleges = sb.table("colleges").select("id").in_("domain", SEED_DOMAINS).execute().data
college_ids = [c["id"] for c in colleges]

if user_ids:
    org_ids = list({
        r["org_group_id"]
        for r in sb.table("org_member_roles").select("org_group_id").in_("user_id", user_ids).execute().data
    })
    event_ids = []
    if org_ids:
        event_ids = [e["id"] for e in sb.table("events").select("id").in_("org_group_id", org_ids).execute().data]

    if event_ids:
        tier_ids = [t["id"] for t in sb.table("ticket_tiers").select("id").in_("event_id", event_ids).execute().data]
        for table, col in [
            ("event_hypes", "event_id"), ("event_reviews", "event_id"),
            ("event_wishlist", "event_id"), ("event_waitlist", "event_id"),
            ("event_banners", "event_id"), ("event_co_hosts", "event_id"),
            ("bulk_purchase_requests", "event_id"), ("org_feedback_requests", "event_id"),
        ]:
            sb.table(table).delete().in_(col, event_ids).execute()
        if tier_ids:
            sb.table("team_size_override_requests").delete().in_("ticket_tier_id", tier_ids).execute()
        sb.table("tickets").delete().in_("event_id", event_ids).execute()
        if org_ids:
            sb.table("org_payouts").delete().in_("org_group_id", org_ids).execute()
        sb.table("orders").delete().in_("event_id", event_ids).execute()
        sb.table("ticket_tiers").delete().in_("event_id", event_ids).execute()
        sb.table("events").delete().in_("id", event_ids).execute()
    if org_ids:
        sb.table("org_follows").delete().in_("org_group_id", org_ids).execute()
        sb.table("org_member_roles").delete().in_("org_group_id", org_ids).execute()
        sb.table("org_groups").delete().in_("id", org_ids).execute()
    sb.table("organizer_applications").delete().in_("applicant_id", user_ids).execute()
    sb.table("users").delete().in_("id", user_ids).execute()
if college_ids:
    sb.table("colleges").delete().in_("id", college_ids).execute()

# ------------------------------------------------------------ colleges
print("seeding colleges...")
colleges = sb.table("colleges").insert([
    {"name": "BITS Pilani", "domain": "bits-pilani.seed"},
    {"name": "IIT Bombay", "domain": "iitb.seed"},
    {"name": "SRCC Delhi", "domain": "srcc.seed"},
]).execute().data
bits, iitb, srcc = colleges

# --------------------------------------------------------------- users
print("seeding users...")
aarav, diya, kabir = sb.table("users").insert([
    {"email": SEED_EMAILS[0], "full_name": "Aarav Sharma", "google_id": "seed-aarav",
     "college_id": bits["id"], "customer_level": "prime"},
    {"email": SEED_EMAILS[1], "full_name": "Diya Nair", "google_id": "seed-diya",
     "college_id": iitb["id"], "customer_level": "gold"},
    {"email": SEED_EMAILS[2], "full_name": "Kabir Rao", "google_id": "seed-kabir",
     "college_id": srcc["id"], "customer_level": "bronze"},
]).execute().data

# ---------------------------------------------------------- org groups
print("seeding org groups...")
orgs = sb.table("org_groups").insert([
    {"name": "TechFest BITS", "college_id": bits["id"], "is_college_committee": True,
     "trust_tier": "trusted", "successful_event_count": 12, "score": 8420},
    {"name": "Mood Indigo Collective", "college_id": iitb["id"], "is_college_committee": True,
     "trust_tier": "verified", "successful_event_count": 5, "score": 4100},
    {"name": "Campus Beats", "college_id": None, "is_college_committee": False,
     "trust_tier": "new", "successful_event_count": 1, "score": 500},
]).execute().data
techfest, moodi, beats = orgs

sb.table("org_member_roles").insert([
    {"org_group_id": techfest["id"], "user_id": aarav["id"], "role": "leader", "granted_by": aarav["id"]},
    {"org_group_id": moodi["id"], "user_id": diya["id"], "role": "leader", "granted_by": diya["id"]},
    {"org_group_id": beats["id"], "user_id": kabir["id"], "role": "leader", "granted_by": kabir["id"]},
    {"org_group_id": techfest["id"], "user_id": diya["id"], "role": "manager", "granted_by": aarav["id"]},
]).execute()

# -------------------------------------------------------------- events
print("seeding events...")
EVENTS = [
    (techfest, "HackSprint 2026", "Hackathon", "BITS Pilani, Rajasthan", 12, 800,
     "A 36-hour hackathon bringing together student developers from across India. "
     "Rs 5L+ prize pool, mentors from top startups, and free food throughout.\n\n"
     "Track 1: AI/ML\nTrack 2: FinTech\nTrack 3: Open Innovation\n\nTeam size: 2-4 members.",
     [("Early Bird", 199, 200, False), ("General", 349, 400, False), ("BITS Students", 99, 200, True)]),
    (moodi, "Mood Indigo Night", "Music", "IIT Bombay, Powai", 20, 3000,
     "The biggest college music night in the country returns. Headline act, three supporting "
     "sets, and an open-air stage under the Powai sky.",
     [("General Admission", 499, 2000, False), ("Front Stage", 1299, 400, False)]),
    (beats, "Open Mic Sundays", "Comedy", "Cafe Terrace, Delhi", 5, 120,
     "Six comics, one mic, zero filter. New material night -- expect chaos, expect gold.",
     [("Entry", 149, 120, False)]),
    (techfest, "RoboWars Championship", "Sports", "BITS Pilani Arena", 34, 500,
     "Combat robotics at its loudest. 32 teams, single elimination, one champion.",
     [("Spectator", 249, 450, False), ("BITS Students", 99, 50, True)]),
    (moodi, "Design Systems Workshop", "Workshop", "IIT Bombay, Lecture Hall 21", 8, 60,
     "A hands-on afternoon building a component library from scratch. Laptops required.",
     [("Workshop Seat", 0, 60, False)]),
    (beats, "Indie Theatre: Ashes", "Theatre", "Studio Black Box, Delhi", 26, 90,
     "An original one-act about three siblings and a house they can't agree to sell.",
     [("General", 299, 90, False)]),
    (techfest, "AI & The Future of Work", "Talk", "BITS Pilani Auditorium", 15, 400,
     "A keynote and panel on what actually changes when models get good at our jobs.",
     [("Free Entry", 0, 400, False)]),
    (moodi, "Retro Night: 90s Bollywood", "Party", "IIT Bombay Gymkhana", 3, 700,
     "One night, all 90s. Dress code strongly encouraged.",
     [("Entry", 399, 700, False)]),
    (beats, "Street Dance Battle", "Cultural", "Connaught Place, Delhi", 45, 250,
     "1v1 knockout battles across breaking, popping and hip-hop. Judges from three cities.",
     [("Spectator", 199, 200, False), ("Competitor", 349, 50, False)]),
    (techfest, "CodeClash: Competitive Programming", "Hackathon", "BITS Pilani, Lab Complex", 18, 300,
     "Three hours, eight problems, one leaderboard. ICPC-style rules, individual entry.",
     [("Entry", 149, 250, False), ("BITS Students", 0, 50, True)]),
    (moodi, "Sunburn Campus Edition", "Music", "IIT Bombay Open Grounds", 40, 5000,
     "Two stages, six artists, one very long night. The biggest campus EDM night of the year.",
     [("Early Bird", 799, 1500, False), ("General", 1199, 3000, False), ("VIP Deck", 2499, 500, False)]),
    (beats, "Poetry & Chai", "Cultural", "Hauz Khas, Delhi", 7, 60,
     "Open-floor poetry with unlimited chai. Bring a piece or just come to listen.",
     [("Entry", 99, 60, False)]),
    (techfest, "Startup Pitch Night", "Talk", "BITS Pilani Innovation Hub", 22, 200,
     "Eight student teams pitch to a panel of investors. Audience votes for the people's choice.",
     [("Free Entry", 0, 200, False)]),
    (moodi, "Photography Walk: Old Bombay", "Workshop", "Fort, Mumbai", 11, 40,
     "A guided morning walk through Fort and Ballard Estate. Any camera, phones included.",
     [("Walk Ticket", 249, 40, False)]),
    (beats, "Stand-Up Showcase: Fresh Faces", "Comedy", "The Loft, Delhi", 30, 150,
     "Eight new comics, seven minutes each. Some of it will land.",
     [("Entry", 249, 150, False)]),
    (techfest, "Inter-College Football Cup", "Sports", "BITS Pilani Sports Ground", 50, 1200,
     "Sixteen colleges, knockout format, one trophy. Finals under lights.",
     [("Day Pass", 149, 900, False), ("Season Pass", 399, 300, False)]),
    (moodi, "Improv Night", "Theatre", "IIT Bombay Drama Studio", 16, 120,
     "Long-form improv built entirely from audience suggestions. No two shows alike.",
     [("Entry", 199, 120, False)]),
    (beats, "Silent Disco Rooftop", "Party", "Connaught Place Rooftop, Delhi", 9, 400,
     "Three channels, three DJs, zero noise complaints. Headphones provided.",
     [("Entry", 599, 400, False)]),
]

created_events = []
for org, title, category, venue, in_days, capacity, desc, tiers in EVENTS:
    ev = sb.table("events").insert({
        "org_group_id": org["id"],
        "college_id": org["college_id"],
        "title": title,
        "description": desc,
        "category": category,
        "venue": venue,
        "starts_at": now_plus(in_days),
        "ends_at": now_plus(in_days, 23),
        "capacity": capacity,
        "status": "on_sale",
        "visibility": "public",
    }).execute().data[0]

    sb.table("ticket_tiers").insert([
        {"event_id": ev["id"], "name": n, "price": p, "pool_capacity": q, "is_college_only": c}
        for (n, p, q, c) in tiers
    ]).execute()
    created_events.append(ev)

# --------------------------------------------------- hype so lists sort
print("seeding hype...")
hype_rows = []
for idx, ev in enumerate(created_events):
    for u in [aarav, diya, kabir][: (idx % 3) + 1]:
        hype_rows.append({"event_id": ev["id"], "user_id": u["id"]})
sb.table("event_hypes").insert(hype_rows).execute()

print("\nseeded:")
print(f"  {len(colleges)} colleges, 3 users, {len(orgs)} org groups, {len(created_events)} events")
print(f"  organizer login for demo: {SEED_EMAILS[0]} (leader of TechFest BITS)")
