from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.models import User
from app.schemas.auth import LoginIn, RegisterIn, TokenOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Email already registered")
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
        phone=data.phone,
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(
        access_token=create_access_token(str(user.id), role=user.role),
        user_id=user.id,
        email=user.email,
        role=user.role,
        name=user.name,
    )


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    return TokenOut(
        access_token=create_access_token(str(user.id), role=user.role),
        user_id=user.id,
        email=user.email,
        role=user.role,
        name=user.name,
    )


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "phone": user.phone,
        "role": user.role,
        "lang": user.lang,
        "home_city": user.home_city,
        "prefs": user.prefs or {},
    }


@router.put("/me")
def update_me(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for k in ("name", "phone", "lang", "home_city", "age_range", "gender"):
        if k in payload:
            setattr(user, k, payload[k])
    if "prefs" in payload and isinstance(payload["prefs"], dict):
        merged = {**(user.prefs or {}), **payload["prefs"]}
        user.prefs = merged
    db.commit()
    db.refresh(user)
    return {"ok": True}
