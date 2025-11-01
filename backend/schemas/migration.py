"""Migration Schemas
Pydantic schemas for data migration endpoints.
"""
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional


class ExportRequest(BaseModel):
    """Request schema for data export"""
    include_projects: bool = Field(
        default=True,
        description="Include project data in export"
    )
    include_tasks: bool = Field(
        default=True,
        description="Include audit task data in export"
    )
    include_issues: bool = Field(
        default=True,
        description="Include audit issue data in export"
    )
    include_settings: bool = Field(
        default=True,
        description="Include user settings in export"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "include_projects": True,
                "include_tasks": True,
                "include_issues": True,
                "include_settings": True
            }
        }


class ExportResponse(BaseModel):
    """Response schema for data export"""
    status: str = Field(
        description="Export status (success/error)"
    )
    message: str = Field(
        description="Status message"
    )
    data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Exported data"
    )
    statistics: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Export statistics"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "success",
                "message": "Data exported successfully",
                "data": {
                    "schema_version": "2.0.0",
                    "export_timestamp": "2024-01-15T10:30:00Z",
                    "user_id": "user123",
                    "data": {}
                },
                "statistics": {
                    "total_projects": 5,
                    "total_tasks": 10,
                    "total_issues": 25
                }
            }
        }


class ImportRequest(BaseModel):
    """Request schema for data import"""
    data: Dict[str, Any] = Field(
        description="Data to import (exported format)"
    )
    skip_existing: bool = Field(
        default=True,
        description="Skip existing records instead of updating"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "data": {
                    "schema_version": "2.0.0",
                    "export_timestamp": "2024-01-15T10:30:00Z",
                    "user_id": "user123",
                    "data": {
                        "user": {},
                        "projects": [],
                        "audit_tasks": [],
                        "audit_issues": []
                    }
                },
                "skip_existing": True
            }
        }


class ImportResponse(BaseModel):
    """Response schema for data import"""
    status: str = Field(
        description="Import status (success/error)"
    )
    message: str = Field(
        description="Status message"
    )
    statistics: Dict[str, Any] = Field(
        description="Import statistics"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "success",
                "message": "Data imported successfully",
                "statistics": {
                    "users": 1,
                    "projects": 5,
                    "tasks": 10,
                    "issues": 25,
                    "errors": []
                }
            }
        }


class ValidationResponse(BaseModel):
    """Response schema for data validation"""
    valid: bool = Field(
        description="Whether the data is valid"
    )
    message: str = Field(
        description="Validation message"
    )
    errors: List[str] = Field(
        default_factory=list,
        description="List of validation errors"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "valid": True,
                "message": "Data is valid and can be imported",
                "errors": []
            }
        }
