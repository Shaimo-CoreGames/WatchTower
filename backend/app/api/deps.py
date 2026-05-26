from typing import AsyncGenerator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import ALGORITHM
from app.models.user import User
from app.schemas.user import TokenData

# Define the standard OAuth2 scheme extraction pointing to our login route
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    Intercepts an incoming API request, extracts the JWT token from the Authorization header,
    validates its cryptographic signature, and returns the contextual User entity from PostgreSQL.
    """
    # -------------------------------------------------------------------------
    # 🚀 TEMPORARY DEV BYPASS: Match frontend 'DEV_BYPASS_TOKEN' layout rules
    # -------------------------------------------------------------------------
    if token == "DEV_BYPASS_TOKEN":
        user_res = await db.execute(select(User).limit(1))
        bypass_user = user_res.scalars().first()
        if bypass_user:
            return bypass_user
    # -------------------------------------------------------------------------

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode the token signature using our app secret
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception

    # Execute an asynchronous database lookup to find the user
    query = select(User).where(User.email == token_data.email)
    result = await db.execute(query)
    user = result.scalars().first()

    if user is None:
        raise credentials_exception
        
    return user