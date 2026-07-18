"""Plan sizing — must stay in step with backend/plans.ts on the Next.js side."""

PLAN_CREDITS: dict[str, int] = {
    "free": 2000,
    "starter": 20000,
    "pro": 75000,
    "business": 250000,
}

MODE_COST: dict[str, int] = {
    "ask": 5,
    "architect": 15,
    "ceo": 20,
    "fix": 20,
    "improve": 25,
    "auto": 30,
    "build": 40,
    "project": 150,
}


def daily_allowance(plan_id: str) -> int:
    """Monthly credits divided over 30 days: 66 / 666 / 2500 / 8333."""
    return PLAN_CREDITS.get(plan_id, PLAN_CREDITS["free"]) // 30


def cost_for(mode: str, has_attachment: bool = False) -> int:
    return MODE_COST.get(mode, MODE_COST["auto"]) + (5 if has_attachment else 0)
