from typing import List, Union, Optional
from pydantic import AnyHttpUrl, validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "XCodeReviewer"
    API_V1_STR: str = "/api/v1"
    
    # SECURITY
    SECRET_KEY: str = "changethis_in_production_to_a_long_random_string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # POSTGRES
    POSTGRES_SERVER: str = "db"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "xcodereviewer"
    DATABASE_URL: str | None = None

    @validator("DATABASE_URL", pre=True)
    def assemble_db_connection(cls, v: str | None, values: dict[str, any]) -> str:
        if isinstance(v, str):
            return v
        return str(f"postgresql+asyncpg://{values.get('POSTGRES_USER')}:{values.get('POSTGRES_PASSWORD')}@{values.get('POSTGRES_SERVER')}/{values.get('POSTGRES_DB')}")

    # LLM配置
    LLM_PROVIDER: str = "openai"  # gemini, openai, claude, qwen, deepseek, zhipu, moonshot, baidu, minimax, doubao, ollama
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: Optional[str] = None  # 不指定时使用provider的默认模型
    LLM_BASE_URL: Optional[str] = None  # 自定义API端点（如中转站）
    LLM_TIMEOUT: int = 150  # 超时时间（秒）
    LLM_TEMPERATURE: float = 0.1
    LLM_MAX_TOKENS: int = 4096
    
    # 各LLM提供商的API Key配置（兼容单独配置）
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    CLAUDE_API_KEY: Optional[str] = None
    QWEN_API_KEY: Optional[str] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    ZHIPU_API_KEY: Optional[str] = None
    MOONSHOT_API_KEY: Optional[str] = None
    BAIDU_API_KEY: Optional[str] = None  # 格式: api_key:secret_key
    MINIMAX_API_KEY: Optional[str] = None
    DOUBAO_API_KEY: Optional[str] = None
    OLLAMA_BASE_URL: Optional[str] = "http://localhost:11434/v1"
    
    # GitHub配置
    GITHUB_TOKEN: Optional[str] = None
    
    # GitLab配置
    GITLAB_TOKEN: Optional[str] = None
    
    # 扫描配置
    MAX_ANALYZE_FILES: int = 50  # 最大分析文件数
    MAX_FILE_SIZE_BYTES: int = 200 * 1024  # 最大文件大小 200KB
    LLM_CONCURRENCY: int = 3  # LLM并发数
    LLM_GAP_MS: int = 2000  # LLM请求间隔（毫秒）
    
    # ZIP文件存储配置
    ZIP_STORAGE_PATH: str = "./uploads/zip_files"  # ZIP文件存储目录
    
    # 输出语言配置 - 支持 zh-CN（中文）和 en-US（英文）
    OUTPUT_LANGUAGE: str = "zh-CN"

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"  # 忽略额外的环境变量（如 VITE_* 前端变量）


settings = Settings()
