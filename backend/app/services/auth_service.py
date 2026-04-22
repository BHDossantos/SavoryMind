from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from ..models.user import User
from ..schemas.auth import UserRegister, UserLogin
from ..core.security import hash_password, verify_password, create_access_token
from .seed_data import seed_database, seed_consumer_data, seed_diner_data


def register(db: Session, data: UserRegister) -> tuple[str, User]:
    if db.query(User).filter(User.email == data.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered.")

    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        account_type=data.account_type,
        display_name=data.display_name,
        restaurant_name=data.display_name if data.account_type == "restaurant" else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if data.account_type == "restaurant":
        seed_database(db, user_id=user.id)
    elif data.account_type == "consumer":
        seed_consumer_data(db, user_id=user.id)
    else:
        seed_diner_data(db, user_id=user.id)

    token = create_access_token(user.id, user.email)
    return token, user


def login(db: Session, data: UserLogin) -> tuple[str, User]:
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    token = create_access_token(user.id, user.email)
    return token, user
