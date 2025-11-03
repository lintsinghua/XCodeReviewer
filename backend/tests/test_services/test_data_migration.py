"""Tests for Data Migration Services"""
import pytest
from datetime import datetime
from services.migration.data_exporter import DataExporter
from services.migration.data_importer import DataImporter, SchemaVersionMismatch
from services.migration.data_validator import DataValidator
from models.user import User
from models.project import Project


@pytest.mark.asyncio
class TestDataExporter:
    """Test data exporter"""
    
    async def test_export_user_profile(self, test_db, test_user):
        """Test exporting user profile"""
        exporter = DataExporter(test_db)
        
        profile = await exporter._export_user_profile(str(test_user.id))
        
        assert profile is not None
        assert profile["email"] == test_user.email
        assert profile["username"] == test_user.username
    
    async def test_export_user_data(self, test_db, test_user):
        """Test exporting complete user data"""
        exporter = DataExporter(test_db)
        
        data = await exporter.export_user_data(str(test_user.id))
        
        assert data["schema_version"] == DataExporter.SCHEMA_VERSION
        assert data["user_id"] == str(test_user.id)
        assert "data" in data
        assert "user" in data["data"]
        assert "statistics" in data
    
    async def test_export_to_json_string(self, test_db, test_user):
        """Test exporting to JSON string"""
        exporter = DataExporter(test_db)
        
        data = await exporter.export_user_data(str(test_user.id))
        json_str = exporter.export_to_json_string(data)
        
        assert isinstance(json_str, str)
        assert test_user.email in json_str


@pytest.mark.asyncio
class TestDataImporter:
    """Test data importer"""
    
    async def test_validate_schema_version(self, test_db):
        """Test schema version validation"""
        importer = DataImporter(test_db)
        
        # Valid version
        data = {"schema_version": "2.0.0"}
        importer._validate_schema_version(data)  # Should not raise
        
        # Invalid version
        data = {"schema_version": "1.0.0"}
        with pytest.raises(SchemaVersionMismatch):
            importer._validate_schema_version(data)
        
        # Missing version
        data = {}
        with pytest.raises(SchemaVersionMismatch):
            importer._validate_schema_version(data)
    
    async def test_validate_data_structure(self, test_db):
        """Test data structure validation"""
        importer = DataImporter(test_db)
        
        # Valid structure
        data = {
            "schema_version": "2.0.0",
            "export_timestamp": datetime.utcnow().isoformat(),
            "user_id": "user123",
            "data": {"user": {}}
        }
        importer._validate_data_structure(data)  # Should not raise
        
        # Missing required field
        data = {"schema_version": "2.0.0"}
        with pytest.raises(Exception):
            importer._validate_data_structure(data)
    
    async def test_import_export_roundtrip(self, test_db, test_user):
        """Test export and import roundtrip"""
        # Export data
        exporter = DataExporter(test_db)
        export_data = await exporter.export_user_data(str(test_user.id))
        
        # Modify user_id for import
        export_data["user_id"] = "new_user_id"
        export_data["data"]["user"]["id"] = "new_user_id"
        export_data["data"]["user"]["email"] = "new@example.com"
        
        # Import data
        importer = DataImporter(test_db)
        result = await importer.import_user_data(
            data=export_data,
            user_id="new_user_id",
            skip_existing=True
        )
        
        assert result["status"] == "success"
        assert result["stats"]["users"] == 1


@pytest.mark.asyncio
class TestDataValidator:
    """Test data validator"""
    
    async def test_validate_export_data(self, test_db, test_user):
        """Test validating export data"""
        exporter = DataExporter(test_db)
        export_data = await exporter.export_user_data(str(test_user.id))
        
        validator = DataValidator(test_db)
        report = await validator.validate_export_data(export_data)
        
        assert report["summary"]["valid"] is True
        assert report["summary"]["total_errors"] == 0
    
    async def test_validate_invalid_data(self, test_db):
        """Test validating invalid data"""
        validator = DataValidator(test_db)
        
        # Missing required fields
        invalid_data = {"schema_version": "2.0.0"}
        report = await validator.validate_export_data(invalid_data)
        
        assert report["summary"]["valid"] is False
        assert report["summary"]["total_errors"] > 0
