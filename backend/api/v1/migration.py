"""Migration API Endpoints
Provides endpoints for data export/import and migration.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import io
import json

from db.session import get_db
from api.dependencies import get_current_user, get_current_admin_user
from models.user import User
from services.migration.data_exporter import DataExporter
from services.migration.data_importer import DataImporter, DataImportError, SchemaVersionMismatch
from schemas.migration import (
    ExportRequest,
    ExportResponse,
    ImportRequest,
    ImportResponse,
    ValidationResponse
)

router = APIRouter()


@router.post(
    "/export",
    response_model=ExportResponse,
    summary="Export user data",
    description="Export all user data to JSON format for migration or backup"
)
async def export_user_data(
    request: ExportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Export user data to JSON format.
    
    This endpoint exports all user data including:
    - User profile
    - Projects
    - Audit tasks
    - Audit issues
    - User settings
    """
    try:
        exporter = DataExporter(db)
        
        # Export data
        data = await exporter.export_user_data(
            user_id=str(current_user.id),
            include_projects=request.include_projects,
            include_tasks=request.include_tasks,
            include_issues=request.include_issues,
            include_settings=request.include_settings
        )
        
        return ExportResponse(
            status="success",
            message="Data exported successfully",
            data=data,
            statistics=data.get("statistics", {})
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Export failed: {str(e)}"
        )


@router.get(
    "/export/download",
    summary="Download exported data",
    description="Download user data as JSON file"
)
async def download_export(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Download user data as JSON file.
    """
    try:
        exporter = DataExporter(db)
        
        # Export data
        data = await exporter.export_user_data(str(current_user.id))
        
        # Convert to JSON string
        json_str = exporter.export_to_json_string(data)
        
        # Create file stream
        file_stream = io.BytesIO(json_str.encode('utf-8'))
        
        # Generate filename
        from datetime import datetime
        filename = f"xcodereview_export_{current_user.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        
        return StreamingResponse(
            file_stream,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Download failed: {str(e)}"
        )


@router.post(
    "/import",
    response_model=ImportResponse,
    summary="Import user data",
    description="Import user data from JSON format"
)
async def import_user_data(
    request: ImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Import user data from JSON format.
    
    This endpoint imports user data including:
    - Projects
    - Audit tasks
    - Audit issues
    - User settings
    """
    try:
        importer = DataImporter(db)
        
        # Import data
        result = await importer.import_user_data(
            data=request.data,
            user_id=str(current_user.id),
            skip_existing=request.skip_existing,
            validate_only=False
        )
        
        return ImportResponse(
            status=result["status"],
            message="Data imported successfully",
            statistics=result["stats"]
        )
        
    except SchemaVersionMismatch as e:
        raise HTTPException(
            status_code=400,
            detail=f"Schema version mismatch: {str(e)}"
        )
    except DataImportError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Import failed: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Import failed: {str(e)}"
        )


@router.post(
    "/import/upload",
    response_model=ImportResponse,
    summary="Upload and import data file",
    description="Upload JSON file and import user data"
)
async def upload_and_import(
    file: UploadFile = File(...),
    skip_existing: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload JSON file and import user data.
    """
    try:
        # Read file content
        content = await file.read()
        
        # Parse JSON
        try:
            data = json.loads(content.decode('utf-8'))
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid JSON file: {str(e)}"
            )
        
        # Import data
        importer = DataImporter(db)
        result = await importer.import_user_data(
            data=data,
            user_id=str(current_user.id),
            skip_existing=skip_existing,
            validate_only=False
        )
        
        return ImportResponse(
            status=result["status"],
            message="Data imported successfully",
            statistics=result["stats"]
        )
        
    except SchemaVersionMismatch as e:
        raise HTTPException(
            status_code=400,
            detail=f"Schema version mismatch: {str(e)}"
        )
    except DataImportError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Import failed: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Import failed: {str(e)}"
        )


@router.post(
    "/validate",
    response_model=ValidationResponse,
    summary="Validate import data",
    description="Validate import data without actually importing"
)
async def validate_import_data(
    request: ImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Validate import data without actually importing.
    
    This endpoint checks:
    - Schema version compatibility
    - Data structure validity
    - Required fields presence
    """
    try:
        importer = DataImporter(db)
        
        # Validate only
        result = await importer.import_user_data(
            data=request.data,
            user_id=str(current_user.id),
            skip_existing=request.skip_existing,
            validate_only=True
        )
        
        return ValidationResponse(
            valid=True,
            message="Data is valid and can be imported",
            errors=result["stats"].get("errors", [])
        )
        
    except SchemaVersionMismatch as e:
        return ValidationResponse(
            valid=False,
            message="Schema version mismatch",
            errors=[str(e)]
        )
    except DataImportError as e:
        return ValidationResponse(
            valid=False,
            message="Data validation failed",
            errors=[str(e)]
        )
    except Exception as e:
        return ValidationResponse(
            valid=False,
            message="Validation error",
            errors=[str(e)]
        )


@router.post(
    "/admin/export-all",
    response_model=ExportResponse,
    summary="Export all users data (Admin only)",
    description="Export data for all users (admin function)"
)
async def export_all_users(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Export data for all users (admin only).
    """
    try:
        exporter = DataExporter(db)
        
        # Export all users
        exported_files = await exporter.export_all_users()
        
        return ExportResponse(
            status="success",
            message=f"Exported data for {len(exported_files)} users",
            data={"exported_files": exported_files},
            statistics={"total_users": len(exported_files)}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Export failed: {str(e)}"
        )
