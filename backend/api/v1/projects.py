"""Project Management API
Endpoints for managing projects.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import joinedload
from typing import List
from loguru import logger

from db.session import get_db
from models.user import User
from models.project import Project, ProjectStatus
from schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse
)
from api.dependencies import get_current_user
from core.exceptions import NotFoundError, ValidationError


router = APIRouter()


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project",
    description="Create a new project for code review"
)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ProjectResponse:
    """
    Create a new project.
    
    Args:
        project_data: Project creation data
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Created project
    """
    try:
        import json
        
        # Create project
        project = Project(
            name=project_data.name,
            description=project_data.description,
            source_type=project_data.source_type,
            source_url=project_data.source_url,
            repository_name=project_data.repository_name,
            branch=project_data.branch,
            programming_languages=json.dumps(project_data.programming_languages) if project_data.programming_languages else None,
            owner_id=current_user.id
        )
        
        db.add(project)
        await db.commit()
        await db.refresh(project, ['owner'])
        
        logger.info(f"Created project {project.id} for user {current_user.id}")
        
        return ProjectResponse.model_validate(project)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating project: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project"
        )


@router.get(
    "",
    response_model=ProjectListResponse,
    summary="List projects",
    description="Get a paginated list of projects for the current user"
)
async def list_projects(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    status_filter: ProjectStatus = Query(None, description="Filter by status"),
    search: str = Query(None, description="Search by name"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ProjectListResponse:
    """
    List projects for the current user.
    
    Args:
        page: Page number
        page_size: Items per page
        status_filter: Optional status filter
        search: Optional search term
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Paginated list of projects
    """
    try:
        # Build query with joinedload for owner
        query = select(Project).options(joinedload(Project.owner)).where(Project.owner_id == current_user.id)
        
        # Apply filters
        if status_filter:
            query = query.where(Project.status == status_filter)
        else:
            # 默认只显示活跃和归档的项目，不显示已删除的
            query = query.where(Project.status.in_([ProjectStatus.ACTIVE, ProjectStatus.ARCHIVED]))
        
        if search:
            query = query.where(Project.name.ilike(f"%{search}%"))
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()
        
        # Apply pagination
        query = query.offset((page - 1) * page_size).limit(page_size)
        query = query.order_by(Project.updated_at.desc())
        
        # Execute query
        result = await db.execute(query)
        projects = result.scalars().unique().all()
        
        return ProjectListResponse(
            items=[ProjectResponse.model_validate(p) for p in projects],
            total=total,
            page=page,
            page_size=page_size
        )
        
    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list projects"
        )


@router.get(
    "/deleted/list",
    response_model=ProjectListResponse,
    summary="List deleted projects",
    description="Get a list of deleted projects (for recycle bin)"
)
async def list_deleted_projects(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ProjectListResponse:
    """
    List deleted projects for the current user.
    
    Args:
        page: Page number
        page_size: Items per page
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Paginated list of deleted projects
    """
    try:
        # Build query for deleted projects only with joinedload for owner
        query = select(Project).options(joinedload(Project.owner)).where(
            and_(
                Project.owner_id == current_user.id,
                Project.status == ProjectStatus.DELETED
            )
        )
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()
        
        # Apply pagination
        query = query.offset((page - 1) * page_size).limit(page_size)
        query = query.order_by(Project.updated_at.desc())
        
        # Execute query
        result = await db.execute(query)
        projects = result.scalars().unique().all()
        
        return ProjectListResponse(
            items=[ProjectResponse.model_validate(p) for p in projects],
            total=total,
            page=page,
            page_size=page_size
        )
        
    except Exception as e:
        logger.error(f"Error listing deleted projects: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list deleted projects"
        )


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Get project details",
    description="Get detailed information about a specific project"
)
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ProjectResponse:
    """
    Get project details.
    
    Args:
        project_id: Project ID
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Project details
    """
    try:
        # Get project with owner information
        query = select(Project).options(joinedload(Project.owner)).where(
            and_(
                Project.id == project_id,
                Project.owner_id == current_user.id
            )
        )
        result = await db.execute(query)
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )
        
        return ProjectResponse.model_validate(project)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get project"
        )


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Update project",
    description="Update project information"
)
async def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ProjectResponse:
    """
    Update project.
    
    Args:
        project_id: Project ID
        project_data: Project update data
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Updated project
    """
    try:
        # Get project with owner information
        query = select(Project).options(joinedload(Project.owner)).where(
            and_(
                Project.id == project_id,
                Project.owner_id == current_user.id
            )
        )
        result = await db.execute(query)
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )
        
        # Update fields
        import json
        update_data = project_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            # Convert programming_languages list to JSON string
            if field == 'programming_languages' and value is not None:
                value = json.dumps(value)
            setattr(project, field, value)
        
        await db.commit()
        await db.refresh(project, ['owner'])
        
        logger.info(f"Updated project {project_id}")
        
        return ProjectResponse.model_validate(project)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update project"
        )


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete project",
    description="Delete a project (soft delete by setting status to deleted)"
)
async def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete project (soft delete).
    
    Args:
        project_id: Project ID
        current_user: Authenticated user
        db: Database session
    """
    try:
        # Get project
        query = select(Project).where(
            and_(
                Project.id == project_id,
                Project.owner_id == current_user.id
            )
        )
        result = await db.execute(query)
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )
        
        # Soft delete
        project.status = ProjectStatus.DELETED
        await db.commit()
        
        logger.info(f"Deleted project {project_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete project"
        )


@router.post(
    "/{project_id}/restore",
    response_model=ProjectResponse,
    summary="Restore project",
    description="Restore a deleted project"
)
async def restore_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ProjectResponse:
    """
    Restore a deleted project.
    
    Args:
        project_id: Project ID
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Restored project
    """
    try:
        # Get project with owner information
        query = select(Project).options(joinedload(Project.owner)).where(
            and_(
                Project.id == project_id,
                Project.owner_id == current_user.id,
                Project.status == ProjectStatus.DELETED
            )
        )
        result = await db.execute(query)
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Deleted project {project_id} not found"
            )
        
        # Restore project
        project.status = ProjectStatus.ACTIVE
        await db.commit()
        await db.refresh(project, ['owner'])
        
        logger.info(f"Restored project {project_id}")
        
        return ProjectResponse.model_validate(project)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error restoring project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restore project"
        )
