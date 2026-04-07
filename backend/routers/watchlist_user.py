from fastapi import APIRouter, HTTPException, Header
from sqlalchemy import text, create_engine
from typing import Optional
from backend.services.authservice import verify_token

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

DB_URL = "postgresql://postgres:admin@localhost:5432/market_data"
engine = create_engine(DB_URL, pool_pre_ping=True)

def _require_user(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = verify_token(authorization.split(" ")[1])
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user

@router.get("/")
async def get_watchlist(authorization: Optional[str] = Header(None)):
    user = _require_user(authorization)
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT symbol, added_at FROM user_watchlist WHERE user_id = :uid ORDER BY added_at DESC"),
            {"uid": user["id"]}
        ).fetchall()
    return [{"symbol": r.symbol, "added_at": str(r.added_at)} for r in rows]

@router.post("/{symbol}")
async def add_to_watchlist(symbol: str, authorization: Optional[str] = Header(None)):
    user = _require_user(authorization)
    with engine.connect() as conn:
        conn.execute(
            text("INSERT INTO user_watchlist (user_id, symbol) VALUES (:uid, :sym) ON CONFLICT DO NOTHING"),
            {"uid": user["id"], "sym": symbol.upper()}
        )
        conn.commit()
    return {"message": f"{symbol.upper()} added to watchlist"}

@router.delete("/{symbol}")
async def remove_from_watchlist(symbol: str, authorization: Optional[str] = Header(None)):
    user = _require_user(authorization)
    with engine.connect() as conn:
        conn.execute(
            text("DELETE FROM user_watchlist WHERE user_id = :uid AND symbol = :sym"),
            {"uid": user["id"], "sym": symbol.upper()}
        )
        conn.commit()
    return {"message": f"{symbol.upper()} removed from watchlist"}

@router.delete("/")
async def clear_watchlist(authorization: Optional[str] = Header(None)):
    user = _require_user(authorization)
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM user_watchlist WHERE user_id = :uid"), {"uid": user["id"]})
        conn.commit()
    return {"message": "Watchlist cleared"}
