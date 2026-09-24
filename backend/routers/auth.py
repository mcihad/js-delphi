"""Authentication: password login, optional self registration and a dev login."""
from __future__ import annotations

import hashlib

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from backend.config import settings
from backend.deps import CurrentUser, DbSession
from backend.models import User
from backend.schemas import DevLoginRequest, LoginRequest, RegisterRequest, TokenOut, UserOut
from backend.security import hash_password, sign_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

_PALETTE = ["#4fc1ff", "#f48771", "#b5cea8", "#dcdcaa", "#c586c0", "#ce9178", "#9cdcfe", "#d7ba7d"]


def _color_for(username: str) -> str:
    return _PALETTE[int(hashlib.sha256(username.encode()).hexdigest(), 16) % len(_PALETTE)]


def issue_token(user: User) -> TokenOut:
    token = sign_token({"typ": "user", "uid": user.id}, settings.token_ttl_seconds)
    return TokenOut(token=token, user=UserOut.model_validate(user), expires_in=settings.token_ttl_seconds)


@router.post("/login", response_model=TokenOut)
def login(req: LoginRequest, db: DbSession) -> TokenOut:
    user = db.scalar(select(User).where(User.username == req.username))
    if user is None or not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Kullanıcı adı veya parola hatalı")
    return issue_token(user)


@router.post("/register", response_model=TokenOut, status_code=201)
def register(req: RegisterRequest, db: DbSession) -> TokenOut:
    first_user = (db.scalar(select(func.count(User.id))) or 0) == 0
    if not settings.allow_register and not first_user:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Kayıt kapalı")
    if db.scalar(select(User).where(User.username == req.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu kullanıcı adı alınmış")
    user = User(
        username=req.username,
        display_name=req.display_name or req.username,
        password_hash=hash_password(req.password),
        is_admin=first_user,
        color=_color_for(req.username),
    )
    db.add(user)
    db.commit()
    return issue_token(user)


@router.post("/dev", response_model=TokenOut)
def dev_login(req: DevLoginRequest, db: DbSession) -> TokenOut:
    """Password-less login for local development (disable with JSD_DEV_LOGIN=0)."""
    if not settings.dev_login:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Geliştirici girişi kapalı")
    user = db.scalar(select(User).where(User.username == req.username))
    if user is None:
        user = User(
            username=req.username,
            display_name=req.display_name or req.username,
            color=_color_for(req.username),
        )
        db.add(user)
        db.commit()
    elif user.password_hash:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu hesap parola ile korunuyor")
    return issue_token(user)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user


@router.get("/config")
def auth_config() -> dict[str, bool]:
    return {"dev_login": settings.dev_login, "allow_register": settings.allow_register}
