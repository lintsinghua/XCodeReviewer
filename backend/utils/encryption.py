"""Encryption utilities for sensitive data like API keys"""
import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from loguru import logger
from app.config import settings


class EncryptionService:
    """Service for encrypting and decrypting sensitive data"""
    
    _instance = None
    _fernet = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._fernet is None:
            self._initialize_encryption()
    
    def _initialize_encryption(self):
        """Initialize Fernet encryption with a key derived from settings"""
        # Get encryption key from environment or generate one
        encryption_key = getattr(settings, 'ENCRYPTION_KEY', None)
        
        if not encryption_key:
            # Use SECRET_KEY as fallback
            secret_key = settings.SECRET_KEY
            
            # Derive a 32-byte key using PBKDF2HMAC
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b'xcodereview_salt_v1',  # Static salt for key derivation
                iterations=100000,
                backend=default_backend()
            )
            key = base64.urlsafe_b64encode(kdf.derive(secret_key.encode()))
            self._fernet = Fernet(key)
            logger.info("🔐 Initialized encryption service using derived key")
        else:
            self._fernet = Fernet(encryption_key.encode())
            logger.info("🔐 Initialized encryption service using ENCRYPTION_KEY")
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext string.
        
        Args:
            plaintext: String to encrypt
            
        Returns:
            Encrypted string (base64 encoded)
        """
        if not plaintext:
            return ""
        
        try:
            encrypted_bytes = self._fernet.encrypt(plaintext.encode())
            return encrypted_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Encryption error: {e}")
            raise
    
    def decrypt(self, encrypted_text: str) -> str:
        """
        Decrypt encrypted string.
        
        Args:
            encrypted_text: Encrypted string (base64 encoded)
            
        Returns:
            Decrypted plaintext string
        """
        if not encrypted_text:
            return ""
        
        try:
            decrypted_bytes = self._fernet.decrypt(encrypted_text.encode())
            return decrypted_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Decryption error: {e}")
            raise
    
    def encrypt_api_key(self, api_key: str) -> str:
        """
        Encrypt API key for storage.
        
        Args:
            api_key: API key to encrypt
            
        Returns:
            Encrypted API key
        """
        return self.encrypt(api_key)
    
    def decrypt_api_key(self, encrypted_api_key: str) -> str:
        """
        Decrypt API key from storage.
        
        Args:
            encrypted_api_key: Encrypted API key
            
        Returns:
            Decrypted API key
        """
        return self.decrypt(encrypted_api_key)


# Singleton instance
encryption_service = EncryptionService()


def encrypt_api_key(api_key: str) -> str:
    """
    Encrypt API key for storage.
    
    Args:
        api_key: Plain API key
        
    Returns:
        Encrypted API key
    """
    return encryption_service.encrypt_api_key(api_key)


def decrypt_api_key(encrypted_api_key: str) -> str:
    """
    Decrypt API key from storage.
    
    Args:
        encrypted_api_key: Encrypted API key
        
    Returns:
        Plain API key
    """
    return encryption_service.decrypt_api_key(encrypted_api_key)

