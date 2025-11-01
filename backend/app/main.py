"""
FastAPI Application Entry Point

Main application setup with middleware, exception handlers, and lifecycle management.
"""

import warnings
# Suppress pkg_resources deprecation warning from OpenTelemetry
warnings.filterwarnings("ignore", category=UserWarning, module="opentelemetry.instrumentation.dependencies")

from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession
import time
from loguru import logger

from app.config import settings
from app.middleware import RequestLoggingMiddleware, RateLimitMiddleware
from core.exceptions import XCodeReviewerException
from core.tracing import init_tracing
from core.metrics_middleware import MetricsMiddleware
from db.session import get_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    # Startup
    logger.info("Starting XCodeReviewer Backend...")
    
    # Validate configuration
    if not settings.validate_secret_key():
        logger.warning("SECRET_KEY is using default or too short. Generating secure key...")
        settings.generate_secret_key_if_needed()
    
    # Initialize distributed tracing
    # Note: Tracing instrumentation is done before app startup
    # init_tracing is called after app creation but before lifespan
    logger.info("Tracing initialized")
    
    # Initialize default admin user on first run
    # Note: Uncomment when User model is implemented
    # try:
    #     from scripts.init_admin import create_default_admin
    #     await create_default_admin()
    # except Exception as e:
    #     logger.warning(f"Admin user initialization skipped: {e}")
    
    logger.info(f"Application started successfully (version {settings.APP_VERSION})")
    
    yield
    
    # Shutdown
    logger.info("Shutting down XCodeReviewer Backend...")
    logger.info("Application shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="XCodeReviewer API",
    description="Intelligent Code Review Platform Backend Service",
    version=settings.APP_VERSION,
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    lifespan=lifespan,
)

# Initialize distributed tracing (must be done before adding other middleware)
init_tracing(
    app,
    service_name=settings.APP_NAME,
    service_version=settings.APP_VERSION,
    enabled=settings.TRACING_ENABLED
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gzip Compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Metrics Middleware
app.add_middleware(MetricsMiddleware)

# Rate Limiting Middleware
app.add_middleware(RateLimitMiddleware)

# Request Logging Middleware
app.add_middleware(RequestLoggingMiddleware)


# Include API Routers
from api.v1 import api_router

app.include_router(api_router, prefix=settings.API_PREFIX)


# Global Exception Handlers
@app.exception_handler(XCodeReviewerException)
async def app_exception_handler(request: Request, exc: XCodeReviewerException):
    """Handle application custom exceptions"""
    return JSONResponse(
        status_code=400,  # Default to 400, specific handlers can override
        content=exc.to_dict(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions"""
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    logger.error(
        "unhandled_exception",
        correlation_id=correlation_id,
        error=str(exc),
        exc_info=True
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An internal server error occurred",
                "timestamp": time.time(),
            }
        },
    )


# Health Check Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "timestamp": time.time(),
    }


@app.get("/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness check endpoint with database connectivity check"""
    from sqlalchemy import text
    
    try:
        # Check database connectivity
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    # TODO: Add Redis connectivity check
    
    return {
        "status": "ready" if db_status == "connected" else "degraded",
        "version": settings.APP_VERSION,
        "timestamp": time.time(),
        "checks": {
            "database": db_status,
        }
    }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": f"{settings.API_PREFIX}/docs",
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
