from pydantic import BaseModel, Field, EmailStr


class UserRegister(BaseModel):
    email: str = Field(min_length=5, max_length=150)
    password: str = Field(min_length=6, max_length=100)
    restaurant_name: str = Field(min_length=2, max_length=100)


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    restaurant_name: str
    plan: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
