"""Project Schemas
Pydantic schemas for project endpoints.
"""
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List
from datetime import datetime
from models.project import ProjectSource, ProjectStatus


class ProjectCreate(BaseModel):
    """Project creation schema"""
    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    source_type: ProjectSource = Field(..., description="Source type (github, gitlab, zip, local)")
    source_url: Optional[str] = Field(None, max_length=500, description="Repository URL")
    repository_name: Optional[str] = Field(None, max_length=255, description="Repository name")
    branch: str = Field(default="main", max_length=100, description="Branch name")
    programming_languages: Optional[List[str]] = Field(None, description="List of programming languages used")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "My Awesome Project",
                "description": "A code review project",
                "source_type": "github",
                "source_url": "https://github.com/user/repo",
                "repository_name": "user/repo",
                "branch": "main",
                "programming_languages": ["python", "javascript", "typescript"]
            }
        }


class ProjectUpdate(BaseModel):
    """Project update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    branch: Optional[str] = Field(None, max_length=100, description="Branch name")
    status: Optional[ProjectStatus] = Field(None, description="Project status")
    source_url: Optional[str] = Field(None, max_length=500, description="Repository URL")
    source_type: Optional[ProjectSource] = Field(None, description="Source type")
    programming_languages: Optional[List[str]] = Field(None, description="List of programming languages used")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Updated Project Name",
                "description": "Updated description",
                "branch": "develop",
                "status": "active",
                "programming_languages": ["python", "javascript"]
            }
        }


class ProjectResponse(BaseModel):
    """Project response schema"""
    id: int
    name: str
    description: Optional[str]
    source_type: ProjectSource
    source_url: Optional[str]
    repository_name: Optional[str]
    branch: str
    total_files: int
    total_lines: int
    primary_language: Optional[str]
    programming_languages: Optional[str]  # JSON string of language list
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime
    last_scanned_at: Optional[datetime]
    owner_id: int
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "My Awesome Project",
                "description": "A code review project",
                "source_type": "github",
                "source_url": "https://github.com/user/repo",
                "repository_name": "user/repo",
                "branch": "main",
                "total_files": 150,
                "total_lines": 5000,
                "primary_language": "Python",
                "programming_languages": "[\"python\", \"javascript\", \"typescript\"]",
                "status": "active",
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00",
                "last_scanned_at": "2024-01-01T00:00:00",
                "owner_id": 1
            }
        }


class ProjectListResponse(BaseModel):
    """Project list response schema"""
    items: list[ProjectResponse]
    total: int
    page: int
    page_size: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "items": [
                    {
                        "id": 1,
                        "name": "Project 1",
                        "description": "Description 1",
                        "source_type": "github",
                        "source_url": "https://github.com/user/repo1",
                        "repository_name": "user/repo1",
                        "branch": "main",
                        "total_files": 150,
                        "total_lines": 5000,
                        "primary_language": "Python",
                        "status": "active",
                        "created_at": "2024-01-01T00:00:00",
                        "updated_at": "2024-01-01T00:00:00",
                        "last_scanned_at": "2024-01-01T00:00:00",
                        "owner_id": 1
                    }
                ],
                "total": 1,
                "page": 1,
                "page_size": 10
            }
        }
