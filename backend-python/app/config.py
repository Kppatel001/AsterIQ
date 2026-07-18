from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuration is env-driven so the same image runs in every environment."""

    app_name: str = "Asteriq API"
    environment: str = "development"

    # Supabase / Postgres
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/asteriq"

    # Firebase — used to verify the ID tokens the Next.js frontend already issues,
    # so the Python service accepts the same logins without a second auth system.
    firebase_project_id: str = ""

    redis_url: str = "redis://localhost:6379/0"

    # Comma-separated list of admin emails that bypass all credit limits.
    admin_emails: str = "kartavyap43@gmail.com"

    cors_origins: str = "http://localhost:3000,https://aster-iq-in.vercel.app"

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
