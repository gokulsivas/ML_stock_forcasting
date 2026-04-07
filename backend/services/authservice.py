from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from sqlalchemy import text, create_engine
import bcrypt


SECRET_KEY = "nse-stock-predictor-secret-key-change-in-production-2024"
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24


DB_URL = "postgresql://postgres:admin@localhost:5432/market_data"

engine = create_engine(DB_URL, pool_pre_ping=True)


# ── Password helpers (using bcrypt directly, no passlib) ──────────────────────
def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT helpers ────────────────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return get_user_by_id(int(user_id))
    except JWTError:
        return None


# ── DB helpers ─────────────────────────────────────────────────────────────────
def get_user_by_email(email: str) -> Optional[dict]:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT id, username, email, password_hash FROM users WHERE email = :e"),
            {"e": email}
        ).fetchone()
        return dict(row._mapping) if row else None


def get_user_by_username(username: str) -> Optional[dict]:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT id, username, email FROM users WHERE username = :u"),
            {"u": username}
        ).fetchone()
        return dict(row._mapping) if row else None


def get_user_by_id(user_id: int) -> Optional[dict]:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT id, username, email FROM users WHERE id = :id"),
            {"id": user_id}
        ).fetchone()
        return dict(row._mapping) if row else None


def create_user(username: str, email: str, password: str) -> Optional[dict]:
    hashed = get_password_hash(password)
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                INSERT INTO users (username, email, password_hash)
                VALUES (:u, :e, :h)
                RETURNING id, username, email
            """),
            {"u": username, "e": email, "h": hashed}
        ).fetchone()
        conn.commit()
        return dict(row._mapping) if row else None


def authenticate_user(email: str, password: str) -> Optional[dict]:
    user = get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    return user