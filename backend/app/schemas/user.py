import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# Base properties shared across schemas
class UserBase(BaseModel):
    email: EmailStr = Field(..., description="The primary login email address of the user")
    full_name: Optional[str] = Field(None, max_length=100, description="The display name of the user")

# Properties to receive via API on User Registration
class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100, description="Plaintext password, validated for complexity requirements")

# Properties to return via API (Secure output layer)
class UserResponse(UserBase):
    id: int
    created_at: datetime.datetime
    
    # Enable Pydantic v2 to read SQLAlchemy lazy-loaded ORM attributes automatically
    model_config = ConfigDict(from_attributes=True)

# Schema for the OAuth2 standard password login token response
class Token(BaseModel):
    access_token: str
    token_type: str

# Embedded token metadata contents
class TokenData(BaseModel):
    email: Optional[str] = None