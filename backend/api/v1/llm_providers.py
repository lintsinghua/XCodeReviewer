"""LLM Provider Management API
Endpoints for managing LLM providers.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from loguru import logger

from db.session import get_db
from models.user import User
from models.llm_provider import LLMProvider
from schemas.llm_provider import (
    LLMProviderCreate,
    LLMProviderUpdate,
    LLMProviderResponse,
    LLMProviderListResponse,
    LLMProviderApiKeyUpdate,
    LLMProviderApiKeyStatus
)
from api.dependencies import get_current_user, require_admin


router = APIRouter()


@router.post(
    "",
    response_model=LLMProviderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create LLM provider",
    description="Create a new LLM provider configuration"
)
async def create_provider(
    provider_data: LLMProviderCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> LLMProviderResponse:
    """Create a new LLM provider."""
    try:
        # Check if provider with same name already exists
        result = await db.execute(
            select(LLMProvider).where(LLMProvider.name == provider_data.name)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Provider with name '{provider_data.name}' already exists"
            )
        
        # Create provider
        provider = LLMProvider(
            name=provider_data.name,
            display_name=provider_data.display_name,
            description=provider_data.description,
            icon=provider_data.icon,
            provider_type=provider_data.provider_type,
            api_endpoint=provider_data.api_endpoint,
            default_model=provider_data.default_model,
            supported_models=provider_data.supported_models,
            requires_api_key=provider_data.requires_api_key,
            supports_streaming=provider_data.supports_streaming,
            max_tokens_limit=provider_data.max_tokens_limit,
            category=provider_data.category,
            is_active=provider_data.is_active,
            is_builtin=False,
            config=provider_data.config
        )
        
        db.add(provider)
        await db.commit()
        await db.refresh(provider)
        
        logger.info(f"Created LLM provider {provider.id} by user {current_user.id}")
        
        return LLMProviderResponse.model_validate(provider)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating LLM provider: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create LLM provider"
        )


@router.get(
    "",
    response_model=LLMProviderListResponse,
    summary="List LLM providers",
    description="Get a paginated list of LLM providers"
)
async def list_providers(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    category: str = Query(None, description="Filter by category"),
    is_active: bool = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db)
) -> LLMProviderListResponse:
    """List LLM providers."""
    try:
        # Build query
        query = select(LLMProvider)
        
        # Apply filters
        if category:
            query = query.where(LLMProvider.category == category)
        if is_active is not None:
            query = query.where(LLMProvider.is_active == is_active)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()
        
        # Apply pagination
        query = query.offset((page - 1) * page_size).limit(page_size)
        query = query.order_by(LLMProvider.category, LLMProvider.name)
        
        # Execute query
        result = await db.execute(query)
        providers = result.scalars().all()
        
        return LLMProviderListResponse(
            items=[LLMProviderResponse.model_validate(p) for p in providers],
            total=total,
            page=page,
            page_size=page_size
        )
        
    except Exception as e:
        logger.error(f"Error listing LLM providers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list LLM providers"
        )


@router.get(
    "/{provider_id}",
    response_model=LLMProviderResponse,
    summary="Get LLM provider",
    description="Get detailed information about a specific LLM provider"
)
async def get_provider(
    provider_id: int,
    db: AsyncSession = Depends(get_db)
) -> LLMProviderResponse:
    """Get LLM provider details."""
    try:
        result = await db.execute(
            select(LLMProvider).where(LLMProvider.id == provider_id)
        )
        provider = result.scalar_one_or_none()
        
        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Provider {provider_id} not found"
            )
        
        return LLMProviderResponse.model_validate(provider)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting provider {provider_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get provider"
        )


@router.put(
    "/{provider_id}",
    response_model=LLMProviderResponse,
    summary="Update LLM provider",
    description="Update LLM provider configuration"
)
async def update_provider(
    provider_id: int,
    provider_data: LLMProviderUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> LLMProviderResponse:
    """Update LLM provider."""
    try:
        result = await db.execute(
            select(LLMProvider).where(LLMProvider.id == provider_id)
        )
        provider = result.scalar_one_or_none()
        
        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Provider {provider_id} not found"
            )
        
        # Update fields
        update_data = provider_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(provider, field, value)
        
        await db.commit()
        await db.refresh(provider)
        
        logger.info(f"Updated LLM provider {provider_id}")
        
        return LLMProviderResponse.model_validate(provider)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating provider {provider_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update provider"
        )


@router.delete(
    "/{provider_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete LLM provider",
    description="Delete an LLM provider (built-in providers cannot be deleted)"
)
async def delete_provider(
    provider_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete LLM provider."""
    try:
        result = await db.execute(
            select(LLMProvider).where(LLMProvider.id == provider_id)
        )
        provider = result.scalar_one_or_none()
        
        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Provider {provider_id} not found"
            )
        
        if provider.is_builtin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Built-in providers cannot be deleted"
            )
        
        await db.delete(provider)
        await db.commit()
        
        logger.info(f"Deleted LLM provider {provider_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting provider {provider_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete provider"
        )


@router.put(
    "/{provider_id}/api-key",
    response_model=LLMProviderApiKeyStatus,
    summary="Set provider API key",
    description="Set or update the API key for an LLM provider (encrypted storage)"
)
async def set_provider_api_key(
    provider_id: int,
    api_key_data: LLMProviderApiKeyUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> LLMProviderApiKeyStatus:
    """Set or update API key for a provider."""
    try:
        from utils.encryption import encrypt_api_key
        
        # Get provider
        result = await db.execute(
            select(LLMProvider).where(LLMProvider.id == provider_id)
        )
        provider = result.scalar_one_or_none()
        
        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Provider with ID {provider_id} not found"
            )
        
        # Encrypt and store API key
        encrypted_key = encrypt_api_key(api_key_data.api_key)
        provider.encrypted_api_key = encrypted_key
        
        await db.commit()
        
        logger.info(f"Updated API key for provider {provider_id} by user {current_user.id}")
        
        # Return status with preview
        preview = None
        if len(api_key_data.api_key) > 8:
            preview = f"{api_key_data.api_key[:4]}...{api_key_data.api_key[-4:]}"
        elif len(api_key_data.api_key) > 4:
            preview = f"{api_key_data.api_key[:2]}...{api_key_data.api_key[-2:]}"
        
        return LLMProviderApiKeyStatus(
            has_api_key=True,
            api_key_preview=preview
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error setting API key for provider {provider_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set API key"
        )


@router.get(
    "/{provider_id}/api-key",
    response_model=LLMProviderApiKeyStatus,
    summary="Get provider API key status",
    description="Check if an API key is configured for a provider"
)
async def get_provider_api_key_status(
    provider_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> LLMProviderApiKeyStatus:
    """Get API key status for a provider."""
    try:
        from utils.encryption import decrypt_api_key
        
        # Get provider
        result = await db.execute(
            select(LLMProvider).where(LLMProvider.id == provider_id)
        )
        provider = result.scalar_one_or_none()
        
        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Provider with ID {provider_id} not found"
            )
        
        # Check if API key exists
        has_key = bool(provider.encrypted_api_key)
        preview = None
        
        if has_key:
            try:
                # Decrypt to get preview
                decrypted_key = decrypt_api_key(provider.encrypted_api_key)
                if len(decrypted_key) > 8:
                    preview = f"{decrypted_key[:4]}...{decrypted_key[-4:]}"
                elif len(decrypted_key) > 4:
                    preview = f"{decrypted_key[:2]}...{decrypted_key[-2:]}"
            except Exception as e:
                logger.warning(f"Failed to decrypt API key for preview: {e}")
                preview = "****...****"
        
        return LLMProviderApiKeyStatus(
            has_api_key=has_key,
            api_key_preview=preview
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting API key status for provider {provider_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get API key status"
        )


@router.delete(
    "/{provider_id}/api-key",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete provider API key",
    description="Remove the API key for an LLM provider"
)
async def delete_provider_api_key(
    provider_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete API key for a provider."""
    try:
        # Get provider
        result = await db.execute(
            select(LLMProvider).where(LLMProvider.id == provider_id)
        )
        provider = result.scalar_one_or_none()
        
        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Provider with ID {provider_id} not found"
            )
        
        # Remove API key
        provider.encrypted_api_key = None
        
        await db.commit()
        
        logger.info(f"Deleted API key for provider {provider_id} by user {current_user.id}")
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting API key for provider {provider_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete API key"
        )

