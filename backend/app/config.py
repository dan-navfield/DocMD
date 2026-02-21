from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "DocMD"
    debug: bool = False
    
    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_key: str = ""
    
    # Microsoft / SharePoint
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""
    microsoft_tenant_id: str = ""
    microsoft_redirect_uri: str = "http://localhost:8000/api/auth/microsoft/callback"
    
    # CORS
    frontend_url: str = "http://localhost:3000"
    
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
