import datetime
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

# 1. Initialize the password-hashing context using the industry-standard bcrypt algorithm
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Global Cryptographic Constants
ALGORITHM = "HS256"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Compares a plaintext password against a stored database hash using a constant-time
    comparison algorithm to prevent timing side-channel attacks.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Generates a secure, salted, cryptographic bcrypt hash from a plaintext password.
    """
    return pwd_context.hash(password)


def create_access_token(subject: Union[str, Any], expires_delta: datetime.timedelta = None) -> str:
    """
    Generates a cryptographically signed JWT access token.
    The payload typically embeds the user's primary identifying attribute (e.g., email or ID).
    """
    if expires_delta:
        expire = datetime.datetime.now(datetime.timezone.utc) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    # Define the standardized JWT Claims Payload (sub = subject, exp = expiration time)
    to_encode = {
        "exp": expire,
        "sub": str(subject)
    }
    
    # Sign the token using our global secret key and the HMAC-SHA256 protocol
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt