from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    google_client_id: str = ""
    jwt_secret: str = ""

    # Temporary stopgap: the spec (§4) describes Super Admin as a separate,
    # non-users-table auth system that hasn't been built yet. Until it
    # exists, super-admin-gated actions (issuing bans, adding college
    # admins) check membership in this comma-separated allowlist of
    # regular-user emails instead. Replace with real super-admin auth
    # before this touches production.
    super_admin_emails: str = ""

    # Comma-separated list of browser origins allowed to call this API.
    # Local Vite dev is allowed by default; production frontend origins
    # (Vercel) must be added via the CORS_ORIGINS env var on Render.
    # Deliberately not "*": credentialed requests carrying the JWT cannot
    # use a wildcard origin, so a real list is required either way.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""

    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    firebase_service_account_path: str = ""

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_mail: str = ""
    smtp_password: str = ""

    # Email over HTTPS, used in preference to SMTP when a key is present.
    # Render's free instances block outbound traffic to every SMTP port
    # (25, 465, 587) as of September 2025, so SMTP cannot work there at
    # all -- but port 443 is open, and these providers send over it.
    # Local development keeps using SMTP, since no key is set there.
    resend_api_key: str = ""
    brevo_api_key: str = ""

    # Self-hosted relay: a mail API running on a developer machine and
    # published over an HTTPS tunnel. Render blocks outbound SMTP but not
    # port 443, so this reaches Gmail by proxy through that machine.
    # Preferred over the other transports when set, because it is the one
    # deliberately configured for this deployment.
    local_api_key: str = ""
    local_mail_url: str = "https://envy-twilight-happiest.ngrok-free.dev/mail"

    # The From address for HTTP providers. Falls back to SMTP_MAIL so a
    # deployment that already has that set does not need a second var.
    email_from: str = ""
    email_from_name: str = "Festify"


settings = Settings()
