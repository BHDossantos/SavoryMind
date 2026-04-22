from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.config import settings
from ...core.security import get_current_user
from ...schemas.auth import UserRegister, UserLogin, TokenResponse, UserResponse, ProfileUpdate, SocialLoginRequest
from ...services import auth_service
from ...models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: UserRegister, db: Session = Depends(get_db)):
    token, user = auth_service.register(db, data)
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    token, user = auth_service.login(db, data)
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/social", response_model=TokenResponse, status_code=200)
def social_login(
    data: SocialLoginRequest,
    db: Session = Depends(get_db),
    x_social_secret: Optional[str] = Header(default=None),
):
    expected = getattr(settings, "social_login_secret", "dev-social-secret")
    if expected != "dev-social-secret" and x_social_secret != expected:
        raise HTTPException(status_code=403, detail="Invalid social login secret.")
    token, user = auth_service.social_login(
        db, data.provider, data.provider_id, data.email, data.name, data.avatar_url
    )
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.patch("/profile", response_model=UserResponse)
def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    was_no_type = current_user.account_type is None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)

    # First time a social user picks their account type → seed their demo data
    if was_no_type and current_user.account_type:
        auth_service._seed_for_type(db, current_user)

    return current_user
