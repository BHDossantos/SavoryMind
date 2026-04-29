from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from ..models.user import User
from ..schemas.auth import UserRegister, UserLogin
from ..core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    REFRESH_TOKEN_TYPE,
)
from .seed_data import seed_database, seed_consumer_data, seed_diner_data


def _seed_for_type(db: Session, user: User) -> None:
    if user.account_type == "restaurant":
        seed_database(db, user.id)
    elif user.account_type == "consumer":
        seed_consumer_data(db, user.id)
    elif user.account_type == "diner":
        seed_diner_data(db, user.id)


def _issue_tokens(user: User) -> tuple[str, str]:
    return (
        create_access_token(user.id, user.email),
        create_refresh_token(user.id, user.email),
    )


def register(db: Session, data: UserRegister, employer_id: int = None) -> tuple[str, str, User]:
    if db.query(User).filter(User.email == data.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered.")

    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        account_type=data.account_type,
        display_name=data.display_name,
        restaurant_name=data.display_name if data.account_type == "restaurant" else None,
        employer_id=employer_id,
        # Staff accounts skip onboarding — they're created by the employer
        onboarding_completed=data.account_type == "staff",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Staff accounts don't get demo data seeded
    if data.account_type == "restaurant":
        seed_database(db, user_id=user.id)
    elif data.account_type == "consumer":
        seed_consumer_data(db, user_id=user.id)
    elif data.account_type == "diner":
        seed_diner_data(db, user_id=user.id)
    # staff: no seeding

    access, refresh = _issue_tokens(user)
    return access, refresh, user


def social_login(
    db: Session,
    provider: str,
    provider_id: str,
    email: str,
    name: str,
    avatar_url: str = "",
) -> tuple[str, str, User]:
    # 1. Exact match on social identity
    user = db.query(User).filter(
        User.social_provider == provider,
        User.social_id == provider_id,
    ).first()

    if not user and email:
        # 2. Match by email — link social account to existing user
        user = db.query(User).filter(User.email == email.lower()).first()
        if user:
            user.social_provider = provider
            user.social_id = provider_id
            if avatar_url and not user.avatar_url:
                user.avatar_url = avatar_url
            db.commit()

    if not user:
        # 3. Brand-new user — account_type set during onboarding step 0
        user = User(
            email=email.lower() if email else f"{provider}_{provider_id}@social",
            password_hash=None,
            account_type=None,
            display_name=name or email.split("@")[0] if email else provider,
            social_provider=provider,
            social_id=provider_id,
            avatar_url=avatar_url or None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access, refresh = _issue_tokens(user)
    return access, refresh, user


def login(db: Session, data: UserLogin) -> tuple[str, str, User]:
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    access, refresh = _issue_tokens(user)
    return access, refresh, user


def refresh_session(db: Session, refresh_token: str) -> tuple[str, str, User]:
    """Validate a refresh token and mint a new access + refresh pair.

    The refresh token is rotated on every call — clients must use the newly
    returned refresh token for the next refresh, and the old one is no longer
    accepted (because we'll add jti revocation in a follow-up). For now,
    rotation is just hygiene.
    """
    try:
        payload = decode_token(refresh_token, REFRESH_TOKEN_TYPE)
        user_id = int(payload.get("sub", 0))
    except (ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    access, new_refresh = _issue_tokens(user)
    return access, new_refresh, user
