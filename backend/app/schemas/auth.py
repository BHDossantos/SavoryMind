from typing import Optional
from pydantic import BaseModel, Field, field_validator


class UserRegister(BaseModel):
    email: str = Field(min_length=5, max_length=150)
    password: str = Field(min_length=6, max_length=100)
    account_type: str = Field(default="restaurant")
    display_name: str = Field(min_length=2, max_length=100)

    @field_validator("account_type")
    @classmethod
    def validate_account_type(cls, v: str) -> str:
        if v not in ("consumer", "restaurant"):
            raise ValueError("account_type must be 'consumer' or 'restaurant'")
        return v


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    account_type: str
    display_name: str
    restaurant_name: Optional[str] = None
    plan: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
