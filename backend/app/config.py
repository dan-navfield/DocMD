from pydantic import model_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "MDDoc"
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

    # ONLYOFFICE Document Server
    onlyoffice_url: str = "http://localhost:8080"
    onlyoffice_jwt_secret: str = "mddoc-onlyoffice-jwt-secret"
    onlyoffice_callback_base_url: str = "http://host.docker.internal:8000"
    onlyoffice_container_name: str = "mddoc-onlyoffice"

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_solo_monthly_price_id: str = ""
    stripe_solo_annual_price_id: str = ""
    stripe_team_monthly_price_id: str = ""
    stripe_team_annual_price_id: str = ""

    # Fonts — path relative to project root (one level up from backend/)
    fonts_dir: str = "../fonts"
    
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @model_validator(mode="after")
    def validate_required_config(self) -> "Settings":
        missing = []
        if not self.supabase_url:
            missing.append("SUPABASE_URL")
        if not self.supabase_key:
            missing.append("SUPABASE_KEY")
        if missing:
            raise ValueError(f"Missing required config: {', '.join(missing)}")
        return self


@lru_cache()
def get_settings() -> Settings:
    return Settings()
