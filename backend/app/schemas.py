from pydantic import BaseModel


class OrgGroupCreate(BaseModel):
    name: str
    college_id: str | None = None
    is_college_committee: bool = False


class EventCreate(BaseModel):
    org_group_id: str
    title: str
    description: str | None = None
    category: str = "Cultural"
    venue: str | None = None
    starts_at: str
    ends_at: str | None = None
    capacity: int | None = None
    visibility: str = "public"


class TicketTierCreate(BaseModel):
    name: str
    price: float = 0
    pool_capacity: int
    is_college_only: bool = False


class OrderCreate(BaseModel):
    ticket_tier_id: str
    quantity: int = 1


class PaymentVerifyRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_signature: str


class TicketScanRequest(BaseModel):
    verify_code: str
    day_number: int = 1


class UserGroupCreate(BaseModel):
    name: str


class UserGroupInvite(BaseModel):
    user_id: str


class UserGroupRespond(BaseModel):
    accept: bool


class ReviewCreate(BaseModel):
    rating: int
    comment: str | None = None


class OrganizerApplicationCreate(BaseModel):
    college_id: str | None = None


class OrgBanCreate(BaseModel):
    stage: str
    reason: str | None = None
    override_escalation: bool = False


class OrgFlagCreate(BaseModel):
    reason: str


class CollegeAdminCreate(BaseModel):
    user_id: str
    college_id: str


class SuperAdminCreate(BaseModel):
    user_id: str


class SuperAdminOtpVerify(BaseModel):
    code: str


class SupportTicketCreate(BaseModel):
    category: str
    related_id: str | None = None
    routed_to: str = "super_admin"


class TicketTheftReportCreate(BaseModel):
    ticket_id: str


class BulkPurchaseRequestCreate(BaseModel):
    event_id: str
    requested_qty: int


class BulkPurchaseReviewRequest(BaseModel):
    approve: bool


class CoHostCreate(BaseModel):
    org_group_id: str
    is_billing_org: bool = False
    display_split_pct: float | None = None


class TicketAssignCreate(BaseModel):
    group_id: str
    recipient_id: str


class TicketAssignmentRespond(BaseModel):
    accept: bool


class TeamSizeOverrideCreate(BaseModel):
    requested_max: int


class TeamSizeOverrideReview(BaseModel):
    approve: bool
    granted_max: int | None = None


class EventPollCreate(BaseModel):
    question: str
    closes_at: str


class PollVoteRequest(BaseModel):
    vote: bool


class ChangeRequestCreate(BaseModel):
    poll_id: str | None = None
    change_details: str


class ChangeRequestDecision(BaseModel):
    approve: bool


class CollegeEmailVerifyRequest(BaseModel):
    college_email: str


class CollegeEmailVerifyConfirm(BaseModel):
    otp: str


class ScoringConfigSet(BaseModel):
    key: str
    value: dict | float | int | str | bool


class WaitlistJoin(BaseModel):
    quantity_requested: int = 1


class FeedbackRequestCreate(BaseModel):
    prime_user_id: str
    message: str


class CollegeAdminFlagCreate(BaseModel):
    reason: str
