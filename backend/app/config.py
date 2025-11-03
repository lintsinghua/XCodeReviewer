"""
Application Configuration

Manages all application settings using Pydantic Settings.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
from functools import lru_cache
import secrets


class Settings(BaseSettings):
    """Application configuration settings"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",  # Allow extra fields in .env file
    )
    
    # Application
    APP_NAME: str = "XCodeReviewer"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    API_PREFIX: str = "/api/v1"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/xcodereviewer"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # SQLite (Local Mode)
    SQLITE_URL: str = "sqlite+aiosqlite:///./xcodereviewer.db"
    USE_LOCAL_DB: bool = False
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50
    
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    
    # MinIO/S3
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "xcodereviewer"
    MINIO_SECURE: bool = False
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Encryption
    ENCRYPTION_KEY: Optional[str] = None
    
    # LLM
    LLM_PROVIDER: str = "gemini"  # Current LLM provider
    LLM_DEFAULT_PROVIDER: str = "gemini"
    LLM_MODEL: Optional[str] = None  # LLM model name (use provider default if None)
    LLM_API_KEY: Optional[str] = None  # Primary LLM API key
    LLM_TEMPERATURE: float = 0.2  # LLM temperature for code analysis
    LLM_TIMEOUT: int = 150
    LLM_MAX_RETRIES: int = 3
    LLM_CACHE_TTL: int = 86400
    OUTPUT_LANGUAGE: str = "zh-CN"  # Output language for LLM responses
    
    # LLM API Keys
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    CLAUDE_API_KEY: Optional[str] = None
    QWEN_API_KEY: Optional[str] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    ZHIPU_API_KEY: Optional[str] = None
    MOONSHOT_API_KEY: Optional[str] = None
    BAIDU_API_KEY: Optional[str] = None
    MINIMAX_API_KEY: Optional[str] = None
    DOUBAO_API_KEY: Optional[str] = None
    
    # Ollama (local model)
    OLLAMA_BASE_URL: str = "http://localhost:11434"  # Ollama server URL
    
    # GitHub/GitLab
    GITHUB_TOKEN: Optional[str] = None
    GITLAB_TOKEN: Optional[str] = None
    
    # Tasks
    MAX_ANALYZE_FILES: int = 40
    LLM_CONCURRENCY: int = 2
    LLM_GAP_MS: int = 500
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000
    
    # Monitoring
    SENTRY_DSN: Optional[str] = None
    PROMETHEUS_PORT: int = 9090
    
    # Tracing
    TRACING_ENABLED: bool = True
    OTLP_ENDPOINT: str = "http://localhost:4317"
    JAEGER_ENDPOINT: Optional[str] = None
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"
    LOG_ROTATION: str = "500 MB"
    LOG_RETENTION: str = "30 days"
    
    # Multi-Agent
    AGENT_MAX_ITERATIONS: int = 10
    AGENT_TIMEOUT: int = 300
    AGENT_MEMORY_SIZE: int = 100
    
    # Vector Database
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None
    VECTOR_DIMENSION: int = 1536
    
    def validate_secret_key(self) -> bool:
        """Validate SECRET_KEY meets security requirements"""
        if self.SECRET_KEY == "your-secret-key-change-in-production":
            return False
        if len(self.SECRET_KEY) < 32:
            return False
        return True
    
    def generate_secret_key_if_needed(self):
        """Generate a secure SECRET_KEY if using default"""
        if not self.validate_secret_key():
            self.SECRET_KEY = secrets.token_urlsafe(32)
    
    def get_database_url(self) -> str:
        """Get appropriate database URL based on mode"""
        return self.SQLITE_URL if self.USE_LOCAL_DB else self.DATABASE_URL


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
