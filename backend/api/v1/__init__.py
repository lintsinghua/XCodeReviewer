"""API v1 package"""

from fastapi import APIRouter

# Create main v1 router
api_router = APIRouter()

# Import and include routers from different modules
from api.v1 import auth, agents, migration, monitoring, projects, tasks, issues, statistics, websocket, reports, instant_analysis, system_settings, prompts

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["authentication"]
)

api_router.include_router(
    agents.router,
    prefix="/agents",
    tags=["agents"]
)

api_router.include_router(
    projects.router,
    prefix="/projects",
    tags=["projects"]
)

api_router.include_router(
    tasks.router,
    prefix="/tasks",
    tags=["tasks"]
)

api_router.include_router(
    issues.router,
    prefix="/issues",
    tags=["issues"]
)

api_router.include_router(
    statistics.router,
    prefix="/statistics",
    tags=["statistics"]
)

api_router.include_router(
    migration.router,
    prefix="/migration",
    tags=["migration"]
)

api_router.include_router(
    monitoring.router,
    prefix="/monitoring",
    tags=["monitoring"]
)

api_router.include_router(
    websocket.router,
    tags=["websocket"]
)

api_router.include_router(
    reports.router,
    prefix="/reports",
    tags=["reports"]
)

api_router.include_router(
    instant_analysis.router,
    prefix="/instant-analysis",
    tags=["instant-analysis"]
)

api_router.include_router(
    system_settings.router,
    prefix="/system",
    tags=["system-settings"]
)

api_router.include_router(
    prompts.router,
    prefix="/prompts",
    tags=["prompts"]
)

# Note: Uncomment other routers as modules are implemented
# from api.v1 import auth, users, projects, tasks

# api_router.include_router(
#     auth.router,
#     prefix="/auth",
#     tags=["authentication"]
# )

# api_router.include_router(
#     users.router,
#     prefix="/users",
#     tags=["users"]
# )

# api_router.include_router(
#     projects.router,
#     prefix="/projects",
#     tags=["projects"]
# )

# api_router.include_router(
#     tasks.router,
#     prefix="/tasks",
#     tags=["tasks"]
# )

__all__ = ["api_router"]
