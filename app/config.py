from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    admin_username: str = "admin"
    admin_password: str = "admin"
    admin_session_secret: str = "change-me-admin-session-secret"
    admin_session_minutes: int = 60
    internal_service_token: str = "change-me-in-production"

    auth_service_url: str = "http://auth-service:8000"
    order_service_url: str = "http://order-service:8002"
    wallet_service_url: str = "http://wallet-service:8003"
    portfolio_service_url: str = "http://portfolio-service:8004"
    market_notifications_url: str = "http://market-notifications:8005"
    bot_service_url: str = "http://bot-service:8000"

    # Kafka — bot.activity.* relay
    kafka_bootstrap_servers: str = "redpanda:9092"
    kafka_enabled: bool = True


settings = Settings()
