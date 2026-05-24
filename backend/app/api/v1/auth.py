from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.security import oauth2_scheme

from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Registers a new system user, salts and hashes their raw password string,
    and returns the unique database entity profile.
    """
    # 1. Check if the user identity profile already exists
    query = select(User).where(User.email == user_in.email)
    result = await db.execute(query)
    existing_user = result.scalars().first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address is already registered in our system."
        )
    
    # 2. Cryptographically salt and hash the plaintext password
    hashed_pwd = get_password_hash(user_in.password)
    
    # 3. Instantiate the SQLAlchemy user record
    new_user = User(
        email=user_in.email,
        hashed_password=hashed_pwd,
        full_name=user_in.full_name
    )
    
    # 4. Commit transactionally to PostgreSQL
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user


from app.core.security import oauth2_scheme  # Make sure to import it!

@router.get("/me", response_model=UserResponse)
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    """
    Decodes the incoming user access token and fetches their live identity profile.
    """
    # 1. For now, this placeholder ensures your routing and Swagger locks work.
    # 2. Next, you'll add the jwt.decode logic here using the 'token' string.
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Token decoding layer implementation pending."
    )

@router.post("/login", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    Verifies user authentication claims against stored record profiles.
    Returns a stateless OAuth2 bearer token upon verification success.
    """
    # 1. Look up the user context profile by email
    # Note: OAuth2PasswordRequestForm standardizes the identifier text input as 'username'
    query = select(User).where(User.email == form_data.username)
    result = await db.execute(query)
    user = result.scalars().first()
    
    # 2. Enforce timing safety by verifying credentials strictly if user context exists
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email identity credentials or password entry.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 3. Mint the signed application access token token
    access_token = create_access_token(subject=user.email)
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }