import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.api import api_router
from app.db.session import AsyncSessionLocal
from app.db.init_db import init_db

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    启动时初始化数据库（创建默认账户等）
    """
    logger.info("DeepAudit 后端服务启动中...")
    
    # 初始化数据库（创建默认账户）
    # 注意：需要先运行 alembic upgrade head 创建表结构
    try:
        async with AsyncSessionLocal() as db:
            await init_db(db)
        logger.info("✓ 数据库初始化完成")
    except Exception as e:
        # 表不存在时静默跳过，等待用户运行数据库迁移
        error_msg = str(e)
        if "does not exist" in error_msg or "UndefinedTableError" in error_msg:
            logger.info("数据库表未创建，请先运行: alembic upgrade head")
        else:
            logger.warning(f"数据库初始化跳过: {e}")
    
    logger.info("=" * 50)
    logger.info("DeepAudit 后端服务已启动")
    logger.info(f"API 文档: http://localhost:8000/docs")
    logger.info("=" * 50)
    logger.info("演示账户: demo@example.com / demo123")
    logger.info("=" * 50)
    
    yield
    
    logger.info("DeepAudit 后端服务已关闭")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Configure CORS - Allow all origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {
        "message": "Welcome to DeepAudit API",
        "docs": "/docs",
        "demo_account": {
            "email": "demo@example.com",
            "password": "demo123"
        }
    }
