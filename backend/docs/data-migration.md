# Data Migration Guide

This guide explains how to migrate data between different XCodeReviewer instances or from IndexedDB to the backend database.

## Overview

The data migration system provides:
- **Export**: Export user data to JSON format
- **Import**: Import user data from JSON format
- **Validation**: Validate data before importing
- **Comparison**: Compare exported data with database
- **Backup/Restore**: Create backups and restore data
- **Rollback**: Rollback to previous state if migration fails

## Migration Workflow

```
1. Create Backup
   ↓
2. Export Data
   ↓
3. Validate Export
   ↓
4. Import Data
   ↓
5. Verify Import
   ↓
6. (Optional) Rollback if issues
```

## Using the API

### 1. Export User Data

**Endpoint**: `POST /api/v1/migration/export`

```bash
curl -X POST "http://localhost:8000/api/v1/migration/export" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "include_projects": true,
    "include_tasks": true,
    "include_issues": true,
    "include_settings": true
  }'
```

**Download as File**: `GET /api/v1/migration/export/download`

```bash
curl -X GET "http://localhost:8000/api/v1/migration/export/download" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o export.json
```

### 2. Validate Data

**Endpoint**: `POST /api/v1/migration/validate`

```bash
curl -X POST "http://localhost:8000/api/v1/migration/validate" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @export.json
```

### 3. Import Data

**Endpoint**: `POST /api/v1/migration/import`

```bash
curl -X POST "http://localhost:8000/api/v1/migration/import" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {...},
    "skip_existing": true
  }'
```

**Upload File**: `POST /api/v1/migration/import/upload`

```bash
curl -X POST "http://localhost:8000/api/v1/migration/import/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@export.json" \
  -F "skip_existing=true"
```

## Using the CLI Tool

### Installation

```bash
cd backend
pip install -r requirements.txt
chmod +x scripts/migrate_data.py
```

### Export Data

```bash
# Export all data for a user
python scripts/migrate_data.py export USER_ID -o export.json

# Export without specific data types
python scripts/migrate_data.py export USER_ID --no-tasks --no-issues
```

### Import Data

```bash
# Import data
python scripts/migrate_data.py import export.json

# Import to specific user
python scripts/migrate_data.py import export.json -u TARGET_USER_ID

# Overwrite existing data
python scripts/migrate_data.py import export.json --overwrite

# Validate only (dry run)
python scripts/migrate_data.py import export.json --validate-only
```

### Validate Data

```bash
# Validate export file
python scripts/migrate_data.py validate export.json

# Save validation report
python scripts/migrate_data.py validate export.json -o validation_report.json
```

### Compare Data

```bash
# Compare export with database
python scripts/migrate_data.py compare export.json USER_ID

# Save comparison report
python scripts/migrate_data.py compare export.json USER_ID -o comparison_report.json
```

### Backup and Restore

```bash
# Create backup
python scripts/migrate_data.py backup USER_ID

# Create named backup
python scripts/migrate_data.py backup USER_ID -n "pre_migration_backup"

# List backups
python scripts/migrate_data.py list

# List backups for specific user
python scripts/migrate_data.py list -u USER_ID

# Restore backup
python scripts/migrate_data.py restore backups/backup_USER_ID_20240115_103000.json

# Restore to different user
python scripts/migrate_data.py restore backups/backup.json -u TARGET_USER_ID
```

## Export Data Format

```json
{
  "schema_version": "2.0.0",
  "export_timestamp": "2024-01-15T10:30:00Z",
  "user_id": "user123",
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "username": "user123",
      "full_name": "John Doe",
      "role": "user",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    },
    "projects": [
      {
        "id": "proj123",
        "name": "My Project",
        "description": "Project description",
        "repository_url": "https://github.com/user/repo",
        "repository_type": "github",
        "default_branch": "main",
        "language": "python",
        "status": "active",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-15T10:00:00Z"
      }
    ],
    "audit_tasks": [
      {
        "id": "task123",
        "project_id": "proj123",
        "task_type": "full_audit",
        "status": "completed",
        "progress": 100,
        "total_files": 50,
        "analyzed_files": 50,
        "issues_found": 10,
        "started_at": "2024-01-10T10:00:00Z",
        "completed_at": "2024-01-10T10:30:00Z",
        "error_message": null,
        "result_summary": {...},
        "created_at": "2024-01-10T10:00:00Z",
        "updated_at": "2024-01-10T10:30:00Z"
      }
    ],
    "audit_issues": [
      {
        "id": "issue123",
        "task_id": "task123",
        "severity": "high",
        "category": "security",
        "title": "SQL Injection Vulnerability",
        "description": "Potential SQL injection...",
        "file_path": "src/database.py",
        "line_number": 42,
        "code_snippet": "query = f\"SELECT * FROM users WHERE id = {user_id}\"",
        "suggestion": "Use parameterized queries",
        "status": "open",
        "created_at": "2024-01-10T10:15:00Z",
        "updated_at": "2024-01-10T10:15:00Z"
      }
    ],
    "settings": {
      "theme": "light",
      "language": "en",
      "notifications_enabled": true
    }
  },
  "statistics": {
    "total_projects": 1,
    "total_tasks": 1,
    "total_issues": 1
  }
}
```

## Migration Scenarios

### Scenario 1: Migrate from IndexedDB to Backend

1. **Export from IndexedDB** (frontend):
   ```javascript
   // Use frontend export function
   const data = await exportIndexedDBData();
   downloadJSON(data, 'indexeddb_export.json');
   ```

2. **Validate export**:
   ```bash
   python scripts/migrate_data.py validate indexeddb_export.json
   ```

3. **Create backup** (optional):
   ```bash
   python scripts/migrate_data.py backup USER_ID
   ```

4. **Import to backend**:
   ```bash
   python scripts/migrate_data.py import indexeddb_export.json -u USER_ID
   ```

5. **Verify import**:
   ```bash
   python scripts/migrate_data.py compare indexeddb_export.json USER_ID
   ```

### Scenario 2: Migrate Between Environments

1. **Export from source**:
   ```bash
   # On source environment
   python scripts/migrate_data.py export USER_ID -o user_data.json
   ```

2. **Transfer file** to target environment

3. **Import to target**:
   ```bash
   # On target environment
   python scripts/migrate_data.py import user_data.json -u USER_ID
   ```

### Scenario 3: Backup Before Major Changes

1. **Create backup**:
   ```bash
   python scripts/migrate_data.py backup USER_ID -n "before_upgrade"
   ```

2. **Perform changes** (upgrade, migration, etc.)

3. **If issues occur, restore**:
   ```bash
   python scripts/migrate_data.py restore backups/backup_before_upgrade_*.json
   ```

## Troubleshooting

### Schema Version Mismatch

**Error**: `Unsupported schema version: 1.0.0`

**Solution**: Update the export data or use a compatible version of the migration tool.

### Missing Required Fields

**Error**: `Missing required field: user_id`

**Solution**: Ensure the export data includes all required fields. Re-export from source.

### Relationship Errors

**Warning**: `Task task123 references non-existent project proj456`

**Solution**: Ensure all related data is included in the export. Check data integrity.

### Import Failures

**Error**: `Import failed: Duplicate key value violates unique constraint`

**Solution**: Use `--overwrite` flag or `skip_existing=false` to update existing records.

### Validation Errors

**Error**: `Data validation failed`

**Solution**: Run validation with output report to see specific errors:
```bash
python scripts/migrate_data.py validate export.json -o report.json
cat report.json
```

## Best Practices

1. **Always create backups** before migration
2. **Validate data** before importing
3. **Test in staging** environment first
4. **Compare data** after import to verify
5. **Keep backups** for at least 30 days
6. **Document migrations** with dates and reasons
7. **Use named backups** for important checkpoints
8. **Monitor logs** during migration
9. **Have rollback plan** ready
10. **Clean up old backups** regularly

## Security Considerations

1. **Encrypt export files** when transferring between environments
2. **Secure backup storage** - don't commit to git
3. **Limit access** to migration tools and backups
4. **Audit migrations** - log who performed migrations
5. **Sanitize sensitive data** in exports if needed

## Performance Tips

1. **Batch imports** for large datasets
2. **Use skip_existing** for faster imports
3. **Disable triggers** temporarily for bulk imports
4. **Increase connection pool** for large migrations
5. **Monitor database** during migration

## Automation

### Scheduled Backups

```bash
# Add to crontab
0 2 * * * /path/to/scripts/migrate_data.py backup USER_ID -n "daily_backup"
```

### Backup Cleanup

```python
# In your application
from services.migration.rollback_manager import RollbackManager

rollback_mgr = RollbackManager(db)
rollback_mgr.cleanup_old_backups(days=30, keep_minimum=5)
```

## References

- [Data Models](../models/)
- [API Documentation](http://localhost:8000/api/v1/docs)
- [Schema Definitions](../schemas/migration.py)
