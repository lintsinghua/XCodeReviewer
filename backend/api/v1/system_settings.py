"""System Settings API Endpoints

Provides endpoints for managing system-wide configuration settings.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from loguru import logger

from db.session import get_db
from models.system_settings import SystemSettings
from schemas.system_settings import (
    SystemSettingCreate,
    SystemSettingUpdate,
    SystemSettingBatchUpdate,
    SystemSettingResponse,
    LLMSettingsResponse,
    LLMSettingsUpdate
)
from api.dependencies import get_current_user, get_current_admin_user
from models.user import User


router = APIRouter()


@router.get(
    "/settings",
    response_model=List[SystemSettingResponse],
    summary="Get all system settings",
    description="Retrieve all system settings. Sensitive values are masked for non-admin users."
)
async def get_all_settings(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all system settings"""
    try:
        # Build query
        query = select(SystemSettings)
        if category:
            query = query.where(SystemSettings.category == category)
        
        result = await db.execute(query)
        settings = result.scalars().all()
        
        # Check if user is admin
        is_admin = current_user.role == "admin"
        
        # Convert to dict (mask sensitive values for non-admin)
        return [setting.to_dict(include_sensitive=is_admin) for setting in settings]
    
    except Exception as e:
        logger.error(f"Error fetching settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch settings"
        )


@router.get(
    "/settings/{key}",
    response_model=SystemSettingResponse,
    summary="Get a specific setting",
    description="Retrieve a system setting by key"
)
async def get_setting(
    key: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific setting by key"""
    try:
        result = await db.execute(
            select(SystemSettings).where(SystemSettings.key == key)
        )
        setting = result.scalar_one_or_none()
        
        if not setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Setting '{key}' not found"
            )
        
        is_admin = current_user.role == "admin"
        return setting.to_dict(include_sensitive=is_admin)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching setting {key}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch setting"
        )


@router.post(
    "/settings",
    response_model=SystemSettingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new setting",
    description="Create a new system setting (admin only)"
)
async def create_setting(
    setting_data: SystemSettingCreate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new system setting"""
    try:
        # Check if key already exists
        result = await db.execute(
            select(SystemSettings).where(SystemSettings.key == setting_data.key)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Setting '{setting_data.key}' already exists"
            )
        
        # Create new setting
        setting = SystemSettings(
            key=setting_data.key,
            value=setting_data.value,
            category=setting_data.category,
            description=setting_data.description,
            is_sensitive=setting_data.is_sensitive,
            updated_by=current_user.id
        )
        
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
        
        logger.info(f"Created setting: {setting.key} by user {current_user.id}")
        return setting.to_dict(include_sensitive=True)
    
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating setting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create setting"
        )


@router.put(
    "/settings/{key}",
    response_model=SystemSettingResponse,
    summary="Update a setting",
    description="Update an existing system setting (admin only)"
)
async def update_setting(
    key: str,
    setting_data: SystemSettingUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an existing setting"""
    try:
        result = await db.execute(
            select(SystemSettings).where(SystemSettings.key == key)
        )
        setting = result.scalar_one_or_none()
        
        if not setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Setting '{key}' not found"
            )
        
        # Update fields
        if setting_data.value is not None:
            setting.value = setting_data.value
        if setting_data.description is not None:
            setting.description = setting_data.description
        if setting_data.is_sensitive is not None:
            setting.is_sensitive = setting_data.is_sensitive
        
        setting.updated_by = current_user.id
        
        await db.commit()
        await db.refresh(setting)
        
        logger.info(f"Updated setting: {setting.key} by user {current_user.id}")
        return setting.to_dict(include_sensitive=True)
    
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating setting {key}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update setting"
        )


@router.post(
    "/settings/batch",
    response_model=Dict[str, str],
    summary="Batch update settings",
    description="Update multiple settings at once (admin only)"
)
async def batch_update_settings(
    batch_data: SystemSettingBatchUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Batch update settings"""
    try:
        updated_keys = []
        
        for key, value in batch_data.settings.items():
            # Find setting
            result = await db.execute(
                select(SystemSettings).where(SystemSettings.key == key)
            )
            setting = result.scalar_one_or_none()
            
            if setting:
                setting.value = value
                setting.updated_by = current_user.id
                updated_keys.append(key)
        
        await db.commit()
        
        logger.info(f"Batch updated {len(updated_keys)} settings by user {current_user.id}")
        return {
            "status": "success",
            "updated_count": str(len(updated_keys)),
            "updated_keys": ",".join(updated_keys)
        }
    
    except Exception as e:
        await db.rollback()
        logger.error(f"Error batch updating settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to batch update settings"
        )


@router.delete(
    "/settings/{key}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a setting",
    description="Delete a system setting (admin only)"
)
async def delete_setting(
    key: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a setting"""
    try:
        result = await db.execute(
            select(SystemSettings).where(SystemSettings.key == key)
        )
        setting = result.scalar_one_or_none()
        
        if not setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Setting '{key}' not found"
            )
        
        await db.delete(setting)
        await db.commit()
        
        logger.info(f"Deleted setting: {key} by user {current_user.id}")
        return None
    
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting setting {key}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete setting"
        )


# ============================================================================
# LLM Specific Settings Endpoints
# ============================================================================

@router.get(
    "/llm-settings",
    response_model=LLMSettingsResponse,
    summary="Get LLM settings",
    description="Get LLM configuration settings"
)
async def get_llm_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get LLM settings"""
    try:
        # Fetch all LLM-related settings
        result = await db.execute(
            select(SystemSettings).where(SystemSettings.category == "llm")
        )
        settings = result.scalars().all()
        
        # Build response
        llm_settings = {
            "provider": "gemini",
            "model": None,
            "api_key": None,
            "base_url": None,
            "temperature": 0.7,
            "max_tokens": None,
            "timeout": 30
        }
        
        is_admin = current_user.role == "admin"
        
        for setting in settings:
            key_parts = setting.key.split(".")
            if len(key_parts) == 2 and key_parts[0] == "llm":
                field_name = key_parts[1]
                value = setting.value
                
                # Mask sensitive values for non-admin
                if setting.is_sensitive and not is_admin:
                    value = "***" if value else None
                # Convert types
                elif field_name == "temperature":
                    value = float(value) if value else 0.7
                elif field_name in ["max_tokens", "timeout"]:
                    value = int(value) if value else None
                
                llm_settings[field_name] = value
        
        return llm_settings
    
    except Exception as e:
        logger.error(f"Error fetching LLM settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch LLM settings"
        )


@router.put(
    "/llm-settings",
    response_model=LLMSettingsResponse,
    summary="Update LLM settings",
    description="Update LLM configuration settings (admin only)"
)
async def update_llm_settings(
    settings_data: LLMSettingsUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Update LLM settings"""
    try:
        updates = settings_data.model_dump(exclude_unset=True)
        
        for field_name, value in updates.items():
            key = f"llm.{field_name}"
            
            # Find or create setting
            result = await db.execute(
                select(SystemSettings).where(SystemSettings.key == key)
            )
            setting = result.scalar_one_or_none()
            
            if setting:
                setting.value = str(value) if value is not None else None
                setting.updated_by = current_user.id
            else:
                # Create new setting
                is_sensitive = field_name == "api_key"
                setting = SystemSettings(
                    key=key,
                    value=str(value) if value is not None else None,
                    category="llm",
                    description=f"LLM {field_name}",
                    is_sensitive=is_sensitive,
                    updated_by=current_user.id
                )
                db.add(setting)
        
        await db.commit()
        
        logger.info(f"Updated LLM settings by user {current_user.id}")
        
        # Return updated settings
        return await get_llm_settings(current_user, db)
    
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating LLM settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update LLM settings"
        )


# ============================================================================
# System Prompt Templates Endpoints
# ============================================================================

@router.get(
    "/prompt-templates",
    response_model=List[SystemSettingResponse],
    summary="Get system prompt templates",
    description="Get all system prompt templates"
)
async def get_prompt_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all system prompt templates"""
    try:
        result = await db.execute(
            select(SystemSettings).where(SystemSettings.category == "prompt_templates")
        )
        templates = result.scalars().all()
        
        return [template.to_dict(include_sensitive=True) for template in templates]
    
    except Exception as e:
        logger.error(f"Error fetching prompt templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch prompt templates"
        )


@router.get(
    "/prompt-templates/{key}",
    response_model=SystemSettingResponse,
    summary="Get a specific prompt template",
    description="Get a system prompt template by key"
)
async def get_prompt_template(
    key: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific prompt template by key"""
    try:
        result = await db.execute(
            select(SystemSettings).where(
                and_(
                    SystemSettings.key == key,
                    SystemSettings.category == "prompt_templates"
                )
            )
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prompt template '{key}' not found"
            )
        
        return template.to_dict(include_sensitive=True)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching prompt template {key}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch prompt template"
        )


@router.put(
    "/prompt-templates/{key}",
    response_model=SystemSettingResponse,
    summary="Update a prompt template",
    description="Update a system prompt template (admin only)"
)
async def update_prompt_template(
    key: str,
    setting_data: SystemSettingUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a prompt template"""
    try:
        result = await db.execute(
            select(SystemSettings).where(
                and_(
                    SystemSettings.key == key,
                    SystemSettings.category == "prompt_templates"
                )
            )
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prompt template '{key}' not found"
            )
        
        # Update fields
        if setting_data.value is not None:
            template.value = setting_data.value
        if setting_data.description is not None:
            template.description = setting_data.description
        
        template.updated_by = current_user.id
        
        await db.commit()
        await db.refresh(template)
        
        logger.info(f"Updated prompt template: {template.key} by user {current_user.id}")
        return template.to_dict(include_sensitive=True)
    
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating prompt template {key}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update prompt template"
        )

