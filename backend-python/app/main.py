from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, credits
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="2.0.0",
    description="Billing, credits and administration for the Asteriq AI platform.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(credits.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}
