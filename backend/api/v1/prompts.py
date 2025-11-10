"""
API endpoints for prompt management
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from db.session import get_db
from api.dependencies import get_current_user, get_optional_current_user
from models.user import User
from models.prompt import Prompt
from schemas.prompt import (
    PromptCreate,
    PromptUpdate,
    PromptResponse,
    PromptListResponse,
    PromptBulkImport
)

router = APIRouter()


@router.get(
    "",
    response_model=PromptListResponse,
    summary="Get all prompts",
    description="Get a paginated list of prompts with optional filtering"
)
async def list_prompts(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=10000, description="Page size"),
    category: Optional[str] = Query(None, description="Filter by category"),
    subcategory: Optional[str] = Query(None, description="Filter by subcategory"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search in name and description"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Get all prompts with pagination and filtering"""
    
    # Build query
    query = select(Prompt)
    
    # Apply filters
    if category:
        query = query.filter(Prompt.category == category)
    if subcategory:
        query = query.filter(Prompt.subcategory == subcategory)
    if is_active is not None:
        query = query.filter(Prompt.is_active == is_active)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Prompt.name.ilike(search_pattern),
                Prompt.description.ilike(search_pattern),
                Prompt.content.ilike(search_pattern)
            )
        )
    
    # Order by category, order_index, and id
    query = query.order_by(Prompt.category, Prompt.order_index, Prompt.id)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()
    
    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    # Execute query
    result = await db.execute(query)
    prompts = result.scalars().all()
    
    return PromptListResponse(
        items=[PromptResponse.model_validate(prompt) for prompt in prompts],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get(
    "/categories",
    summary="Get all categories",
    description="Get a list of all unique categories"
)
async def get_categories(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Get all unique categories"""
    query = select(Prompt.category).distinct().order_by(Prompt.category)
    result = await db.execute(query)
    categories = result.scalars().all()
    return {"categories": categories}


@router.get(
    "/{prompt_id}",
    response_model=PromptResponse,
    summary="Get a prompt by ID",
    description="Get detailed information about a specific prompt"
)
async def get_prompt(
    prompt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Get a specific prompt by ID"""
    query = select(Prompt).filter(Prompt.id == prompt_id)
    result = await db.execute(query)
    prompt = result.scalar_one_or_none()
    
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    return PromptResponse.model_validate(prompt)


@router.post(
    "",
    response_model=PromptResponse,
    summary="Create a new prompt",
    description="Create a new prompt"
)
async def create_prompt(
    prompt_data: PromptCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new prompt"""
    
    # Create new prompt
    prompt = Prompt(
        category=prompt_data.category,
        subcategory=prompt_data.subcategory,
        name=prompt_data.name,
        description=prompt_data.description,
        content=prompt_data.content,
        is_active=prompt_data.is_active,
        order_index=prompt_data.order_index,
        subcategory_mapping=prompt_data.subcategory_mapping,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    
    db.add(prompt)
    await db.commit()
    await db.refresh(prompt)
    
    return PromptResponse.model_validate(prompt)


@router.put(
    "/{prompt_id}",
    response_model=PromptResponse,
    summary="Update a prompt",
    description="Update an existing prompt"
)
async def update_prompt(
    prompt_id: int,
    prompt_data: PromptUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing prompt"""
    
    # Get existing prompt
    query = select(Prompt).filter(Prompt.id == prompt_id)
    result = await db.execute(query)
    prompt = result.scalar_one_or_none()
    
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    # Update fields
    update_data = prompt_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prompt, field, value)
    
    prompt.updated_by = current_user.id
    
    await db.commit()
    await db.refresh(prompt)
    
    return PromptResponse.model_validate(prompt)


@router.delete(
    "/{prompt_id}",
    summary="Delete a prompt",
    description="Delete a prompt (system prompts cannot be deleted)"
)
async def delete_prompt(
    prompt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a prompt"""
    
    # Get existing prompt
    query = select(Prompt).filter(Prompt.id == prompt_id)
    result = await db.execute(query)
    prompt = result.scalar_one_or_none()
    
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    if prompt.is_system:
        raise HTTPException(status_code=403, detail="Cannot delete system prompts")
    
    await db.delete(prompt)
    await db.commit()
    
    return {"message": "Prompt deleted successfully"}


@router.post(
    "/bulk-import",
    summary="Bulk import prompts",
    description="Import multiple prompts at once"
)
async def bulk_import_prompts(
    import_data: PromptBulkImport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk import prompts"""
    
    created_count = 0
    updated_count = 0
    
    for prompt_data in import_data.prompts:
        # Check if prompt already exists
        query = select(Prompt).filter(
            Prompt.category == prompt_data.category,
            Prompt.subcategory == prompt_data.subcategory
        )
        result = await db.execute(query)
        existing_prompt = result.scalar_one_or_none()
        
        if existing_prompt:
            if import_data.overwrite:
                # Update existing prompt
                existing_prompt.name = prompt_data.name
                existing_prompt.description = prompt_data.description
                existing_prompt.content = prompt_data.content
                existing_prompt.is_active = prompt_data.is_active
                existing_prompt.order_index = prompt_data.order_index
                existing_prompt.subcategory_mapping = prompt_data.subcategory_mapping
                existing_prompt.updated_by = current_user.id
                updated_count += 1
        else:
            # Create new prompt
            prompt = Prompt(
                category=prompt_data.category,
                subcategory=prompt_data.subcategory,
                name=prompt_data.name,
                description=prompt_data.description,
                content=prompt_data.content,
                is_active=prompt_data.is_active,
                order_index=prompt_data.order_index,
                subcategory_mapping=prompt_data.subcategory_mapping,
                is_system=True,  # Bulk imported prompts are marked as system prompts
                created_by=current_user.id,
                updated_by=current_user.id
            )
            db.add(prompt)
            created_count += 1
    
    await db.commit()
    
    return {
        "message": "Bulk import completed",
        "created": created_count,
        "updated": updated_count
    }


@router.post(
    "/export",
    summary="Export prompts",
    description="Export all prompts in JSON format"
)
async def export_prompts(
    category: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Export prompts"""
    
    # Build query
    query = select(Prompt)
    
    if category:
        query = query.filter(Prompt.category == category)
    
    query = query.order_by(Prompt.category, Prompt.order_index, Prompt.id)
    
    # Execute query
    result = await db.execute(query)
    prompts = result.scalars().all()
    
    return {
        "prompts": [PromptResponse.model_validate(prompt) for prompt in prompts]
    }

