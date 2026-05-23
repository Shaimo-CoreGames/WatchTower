from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str
    API_V1_STR: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    DATABASE_URL: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()