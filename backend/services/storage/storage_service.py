"""Storage Service
Service for storing and retrieving files from MinIO/S3.
"""
from typing import Optional, BinaryIO
from datetime import timedelta
import os
from loguru import logger

try:
    from minio import Minio
    from minio.error import S3Error
    MINIO_AVAILABLE = True
except ImportError:
    MINIO_AVAILABLE = False
    logger.warning("MinIO client not available. Install with: pip install minio")


class StorageService:
    """Service for file storage operations"""
    
    def __init__(self):
        """Initialize storage service"""
        self.enabled = MINIO_AVAILABLE and self._check_config()
        
        if self.enabled:
            self.client = Minio(
                endpoint=os.getenv('MINIO_ENDPOINT', 'localhost:9000'),
                access_key=os.getenv('MINIO_ACCESS_KEY', 'minioadmin'),
                secret_key=os.getenv('MINIO_SECRET_KEY', 'minioadmin'),
                secure=os.getenv('MINIO_SECURE', 'false').lower() == 'true'
            )
            self.bucket_name = os.getenv('MINIO_BUCKET', 'xcodereviewer')
            self._ensure_bucket_exists()
        else:
            logger.warning("Storage service disabled - using local filesystem")
            self.local_storage_path = os.getenv('LOCAL_STORAGE_PATH', './storage')
            os.makedirs(self.local_storage_path, exist_ok=True)
    
    def _check_config(self) -> bool:
        """Check if MinIO configuration is available"""
        required_vars = ['MINIO_ENDPOINT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY']
        return all(os.getenv(var) for var in required_vars)
    
    def _ensure_bucket_exists(self):
        """Ensure the bucket exists"""
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
                logger.info(f"Created bucket: {self.bucket_name}")
        except S3Error as e:
            logger.error(f"Error ensuring bucket exists: {e}")
    
    def upload_file(
        self,
        file_path: str,
        file_data: bytes,
        content_type: str = 'application/octet-stream'
    ) -> str:
        """
        Upload file to storage.
        
        Args:
            file_path: Path/key for the file in storage
            file_data: File content as bytes
            content_type: MIME type of the file
            
        Returns:
            Storage path/URL of uploaded file
        """
        if self.enabled:
            return self._upload_to_minio(file_path, file_data, content_type)
        else:
            return self._upload_to_local(file_path, file_data)
    
    def _upload_to_minio(
        self,
        file_path: str,
        file_data: bytes,
        content_type: str
    ) -> str:
        """Upload file to MinIO"""
        try:
            from io import BytesIO
            
            data_stream = BytesIO(file_data)
            
            self.client.put_object(
                bucket_name=self.bucket_name,
                object_name=file_path,
                data=data_stream,
                length=len(file_data),
                content_type=content_type
            )
            
            logger.info(f"Uploaded file to MinIO: {file_path}")
            return f"s3://{self.bucket_name}/{file_path}"
            
        except S3Error as e:
            logger.error(f"Error uploading to MinIO: {e}")
            raise
    
    def _upload_to_local(self, file_path: str, file_data: bytes) -> str:
        """Upload file to local filesystem"""
        full_path = os.path.join(self.local_storage_path, file_path)
        
        # Create directory if needed
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        with open(full_path, 'wb') as f:
            f.write(file_data)
        
        logger.info(f"Saved file locally: {full_path}")
        return full_path
    
    def download_file(self, file_path: str) -> bytes:
        """
        Download file from storage.
        
        Args:
            file_path: Path/key of the file in storage
            
        Returns:
            File content as bytes
        """
        if self.enabled:
            return self._download_from_minio(file_path)
        else:
            return self._download_from_local(file_path)
    
    def _download_from_minio(self, file_path: str) -> bytes:
        """Download file from MinIO"""
        try:
            response = self.client.get_object(
                bucket_name=self.bucket_name,
                object_name=file_path
            )
            
            data = response.read()
            response.close()
            response.release_conn()
            
            return data
            
        except S3Error as e:
            logger.error(f"Error downloading from MinIO: {e}")
            raise
    
    def _download_from_local(self, file_path: str) -> bytes:
        """Download file from local filesystem"""
        # Handle both absolute and relative paths
        if file_path.startswith(self.local_storage_path):
            full_path = file_path
        else:
            full_path = os.path.join(self.local_storage_path, file_path)
        
        with open(full_path, 'rb') as f:
            return f.read()
    
    def delete_file(self, file_path: str) -> bool:
        """
        Delete file from storage.
        
        Args:
            file_path: Path/key of the file in storage
            
        Returns:
            True if deleted successfully
        """
        if self.enabled:
            return self._delete_from_minio(file_path)
        else:
            return self._delete_from_local(file_path)
    
    def _delete_from_minio(self, file_path: str) -> bool:
        """Delete file from MinIO"""
        try:
            self.client.remove_object(
                bucket_name=self.bucket_name,
                object_name=file_path
            )
            logger.info(f"Deleted file from MinIO: {file_path}")
            return True
            
        except S3Error as e:
            logger.error(f"Error deleting from MinIO: {e}")
            return False
    
    def _delete_from_local(self, file_path: str) -> bool:
        """Delete file from local filesystem"""
        try:
            # Handle both absolute and relative paths
            if file_path.startswith(self.local_storage_path):
                full_path = file_path
            else:
                full_path = os.path.join(self.local_storage_path, file_path)
            
            if os.path.exists(full_path):
                os.remove(full_path)
                logger.info(f"Deleted local file: {full_path}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Error deleting local file: {e}")
            return False
    
    def get_presigned_url(
        self,
        file_path: str,
        expires: timedelta = timedelta(hours=1)
    ) -> Optional[str]:
        """
        Get presigned URL for file download.
        
        Args:
            file_path: Path/key of the file in storage
            expires: URL expiration time
            
        Returns:
            Presigned URL or None if not available
        """
        if not self.enabled:
            # For local storage, return the file path
            return file_path
        
        try:
            url = self.client.presigned_get_object(
                bucket_name=self.bucket_name,
                object_name=file_path,
                expires=expires
            )
            return url
            
        except S3Error as e:
            logger.error(f"Error generating presigned URL: {e}")
            return None
    
    def file_exists(self, file_path: str) -> bool:
        """
        Check if file exists in storage.
        
        Args:
            file_path: Path/key of the file in storage
            
        Returns:
            True if file exists
        """
        if self.enabled:
            return self._file_exists_in_minio(file_path)
        else:
            return self._file_exists_locally(file_path)
    
    def _file_exists_in_minio(self, file_path: str) -> bool:
        """Check if file exists in MinIO"""
        try:
            self.client.stat_object(
                bucket_name=self.bucket_name,
                object_name=file_path
            )
            return True
        except S3Error:
            return False
    
    def _file_exists_locally(self, file_path: str) -> bool:
        """Check if file exists locally"""
        if file_path.startswith(self.local_storage_path):
            full_path = file_path
        else:
            full_path = os.path.join(self.local_storage_path, file_path)
        
        return os.path.exists(full_path)
    
    def get_file_size(self, file_path: str) -> Optional[int]:
        """
        Get file size in bytes.
        
        Args:
            file_path: Path/key of the file in storage
            
        Returns:
            File size in bytes or None if not found
        """
        if self.enabled:
            return self._get_file_size_from_minio(file_path)
        else:
            return self._get_file_size_locally(file_path)
    
    def _get_file_size_from_minio(self, file_path: str) -> Optional[int]:
        """Get file size from MinIO"""
        try:
            stat = self.client.stat_object(
                bucket_name=self.bucket_name,
                object_name=file_path
            )
            return stat.size
        except S3Error:
            return None
    
    def _get_file_size_locally(self, file_path: str) -> Optional[int]:
        """Get file size locally"""
        try:
            if file_path.startswith(self.local_storage_path):
                full_path = file_path
            else:
                full_path = os.path.join(self.local_storage_path, file_path)
            
            if os.path.exists(full_path):
                return os.path.getsize(full_path)
            return None
        except Exception:
            return None


# Export singleton instance
storage_service = StorageService()
