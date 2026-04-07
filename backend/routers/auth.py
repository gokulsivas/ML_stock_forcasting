from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from backend.schemas.authschemas import UserSignup, UserLogin
from backend.services.authservice import (
    authenticate_user, create_user, create_access_token,
    get_user_by_username, get_user_by_email, verify_token
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup")
async def signup(data: UserSignup):
    if get_user_by_email(data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    if get_user_by_username(data.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    user = create_user(data.username, data.email, data.password)
    if not user:
        raise HTTPException(status_code=500, detail="Failed to create user")
    token = create_access_token({"sub": str(user["id"])})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]}
    }

@router.post("/login")
async def login(data: UserLogin):
    user = authenticate_user(data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(user["id"])})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]}
    }

@router.get("/me")
async def get_me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = verify_token(authorization.split(" ")[1])
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user
