#!/usr/bin/env python3
"""Data Migration Script
Command-line tool for data migration operations.
"""
import asyncio
import argparse
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from loguru import logger

from app.config import settings
from services.migration.data_exporter import DataExporter
from services.migration.data_importer import DataImporter
from services.migration.data_validator import DataValidator
from services.migration.rollback_manager import RollbackManager


async def export_data(args):
    """Export user data"""
    engine = create_async_engine(settings.get_database_url())
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        exporter = DataExporter(session)
        
        logger.info(f"Exporting data for user {args.user_id}")
        
        data = await exporter.export_user_data(
            user_id=args.user_id,
            include_projects=not args.no_projects,
            include_tasks=not args.no_tasks,
            include_issues=not args.no_issues,
            include_settings=not args.no_settings
        )
        
        # Save to file
        output_file = args.output or f"export_{args.user_id}.json"
        exporter.export_to_json(data, output_file)
        
        logger.info(f"Data exported to {output_file}")
        logger.info(f"Statistics: {data.get('statistics', {})}")


async def import_data(args):
    """Import user data"""
    engine = create_async_engine(settings.get_database_url())
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        importer = DataImporter(session)
        
        logger.info(f"Importing data from {args.input}")
        
        # Load data
        data = importer.load_from_json(args.input)
        
        # Import data
        result = await importer.import_user_data(
            data=data,
            user_id=args.user_id,
            skip_existing=not args.overwrite,
            validate_only=args.validate_only
        )
        
        logger.info(f"Import completed: {result['status']}")
        logger.info(f"Statistics: {result['stats']}")


async def validate_data(args):
    """Validate export data"""
    engine = create_async_engine(settings.get_database_url())
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        validator = DataValidator(session)
        importer = DataImporter(session)
        
        logger.info(f"Validating data from {args.input}")
        
        # Load data
        data = importer.load_from_json(args.input)
        
        # Validate
        report = await validator.validate_export_data(data)
        
        logger.info(f"Validation completed")
        logger.info(f"Summary: {report['summary']}")
        
        if report['errors']:
            logger.error(f"Errors found: {len(report['errors'])}")
            for error in report['errors']:
                logger.error(f"  - {error}")
        
        if report['warnings']:
            logger.warning(f"Warnings found: {len(report['warnings'])}")
            for warning in report['warnings']:
                logger.warning(f"  - {warning}")
        
        # Save report if requested
        if args.output:
            import json
            with open(args.output, 'w') as f:
                json.dump(report, f, indent=2)
            logger.info(f"Validation report saved to {args.output}")


async def compare_data(args):
    """Compare export data with database"""
    engine = create_async_engine(settings.get_database_url())
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        validator = DataValidator(session)
        importer = DataImporter(session)
        
        logger.info(f"Comparing data from {args.input} with database")
        
        # Load data
        data = importer.load_from_json(args.input)
        
        # Compare
        report = await validator.compare_data(args.user_id, data)
        
        logger.info(f"Comparison completed")
        logger.info(f"Statistics: {report['statistics']}")
        
        if report['differences']:
            logger.warning(f"Differences found: {len(report['differences'])}")
            for diff in report['differences'][:10]:  # Show first 10
                logger.warning(f"  - {diff}")
        else:
            logger.info("No differences found - data matches!")
        
        # Save report if requested
        if args.output:
            import json
            with open(args.output, 'w') as f:
                json.dump(report, f, indent=2)
            logger.info(f"Comparison report saved to {args.output}")


async def create_backup(args):
    """Create backup"""
    engine = create_async_engine(settings.get_database_url())
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        rollback_mgr = RollbackManager(session, args.backup_dir)
        
        logger.info(f"Creating backup for user {args.user_id}")
        
        backup_path = await rollback_mgr.create_backup(
            user_id=args.user_id,
            backup_name=args.name
        )
        
        logger.info(f"Backup created: {backup_path}")


async def restore_backup(args):
    """Restore backup"""
    engine = create_async_engine(settings.get_database_url())
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        rollback_mgr = RollbackManager(session, args.backup_dir)
        
        logger.info(f"Restoring backup from {args.backup_path}")
        
        result = await rollback_mgr.restore_backup(
            backup_path=args.backup_path,
            user_id=args.user_id
        )
        
        logger.info(f"Backup restored: {result['status']}")
        logger.info(f"Statistics: {result['stats']}")


async def list_backups(args):
    """List backups"""
    engine = create_async_engine(settings.get_database_url())
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        rollback_mgr = RollbackManager(session, args.backup_dir)
        
        backups = rollback_mgr.list_backups(user_id=args.user_id)
        
        logger.info(f"Found {len(backups)} backups")
        
        for backup in backups:
            logger.info(f"\nBackup: {backup['filename']}")
            logger.info(f"  User ID: {backup['user_id']}")
            logger.info(f"  Created: {backup['created_at']}")
            logger.info(f"  Size: {backup['file_size']} bytes")
            if 'statistics' in backup:
                logger.info(f"  Statistics: {backup['statistics']}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Data Migration Tool")
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Export command
    export_parser = subparsers.add_parser('export', help='Export user data')
    export_parser.add_argument('user_id', help='User ID to export')
    export_parser.add_argument('-o', '--output', help='Output file path')
    export_parser.add_argument('--no-projects', action='store_true', help='Exclude projects')
    export_parser.add_argument('--no-tasks', action='store_true', help='Exclude tasks')
    export_parser.add_argument('--no-issues', action='store_true', help='Exclude issues')
    export_parser.add_argument('--no-settings', action='store_true', help='Exclude settings')
    
    # Import command
    import_parser = subparsers.add_parser('import', help='Import user data')
    import_parser.add_argument('input', help='Input file path')
    import_parser.add_argument('-u', '--user-id', help='Target user ID')
    import_parser.add_argument('--overwrite', action='store_true', help='Overwrite existing data')
    import_parser.add_argument('--validate-only', action='store_true', help='Only validate without importing')
    
    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate export data')
    validate_parser.add_argument('input', help='Input file path')
    validate_parser.add_argument('-o', '--output', help='Output report file')
    
    # Compare command
    compare_parser = subparsers.add_parser('compare', help='Compare export with database')
    compare_parser.add_argument('input', help='Input file path')
    compare_parser.add_argument('user_id', help='User ID to compare')
    compare_parser.add_argument('-o', '--output', help='Output report file')
    
    # Backup command
    backup_parser = subparsers.add_parser('backup', help='Create backup')
    backup_parser.add_argument('user_id', help='User ID to backup')
    backup_parser.add_argument('-n', '--name', help='Backup name')
    backup_parser.add_argument('-d', '--backup-dir', default='backups', help='Backup directory')
    
    # Restore command
    restore_parser = subparsers.add_parser('restore', help='Restore backup')
    restore_parser.add_argument('backup_path', help='Backup file path')
    restore_parser.add_argument('-u', '--user-id', help='Target user ID')
    restore_parser.add_argument('-d', '--backup-dir', default='backups', help='Backup directory')
    
    # List backups command
    list_parser = subparsers.add_parser('list', help='List backups')
    list_parser.add_argument('-u', '--user-id', help='Filter by user ID')
    list_parser.add_argument('-d', '--backup-dir', default='backups', help='Backup directory')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Execute command
    if args.command == 'export':
        asyncio.run(export_data(args))
    elif args.command == 'import':
        asyncio.run(import_data(args))
    elif args.command == 'validate':
        asyncio.run(validate_data(args))
    elif args.command == 'compare':
        asyncio.run(compare_data(args))
    elif args.command == 'backup':
        asyncio.run(create_backup(args))
    elif args.command == 'restore':
        asyncio.run(restore_backup(args))
    elif args.command == 'list':
        asyncio.run(list_backups(args))


if __name__ == '__main__':
    main()
