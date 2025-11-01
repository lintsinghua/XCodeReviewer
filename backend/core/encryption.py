"""
Credential Encryption Service

Provides encryption and decryption for sensitive credentials like API keys.
Uses Fernet (symmetric encryption) for secure storage.
"""

from cryptography.fernet import Fernet, InvalidToken
from typing import Optional
import base64
import os


class CredentialEncryptionService:
    """
    Service for encrypting and decrypting sensitive credentials.
    
    Uses Fernet symmetric encryption (AES-128 in CBC mode).
    Encryption key should be stored securely in environment variables.
    """

    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialize encryption service.
        
        Args:
            encryption_key: Base64-encoded Fernet key. If None, reads from ENCRYPTION_KEY env var.
        
        Raises:
            ValueError: If encryption key is not provided or invalid
        """
        if encryption_key is None:
            encryption_key = os.getenv("ENCRYPTION_KEY")
        
        if not encryption_key:
            raise ValueError(
                "Encryption key not provided. Set ENCRYPTION_KEY environment variable "
                "or pass encryption_key parameter."
            )
        
        try:
            # Ensure key is bytes
            if isinstance(encryption_key, str):
                encryption_key = encryption_key.encode()
            
            self.cipher = Fernet(encryption_key)
        except Exception as e:
            raise ValueError(f"Invalid encryption key: {e}")

    def encrypt(self, value: str) -> str:
        """
        Encrypt a credential value.
        
        Args:
            value: Plain text credential to encrypt
        
        Returns:
            Base64-encoded encrypted value
        
        Example:
            >>> service = CredentialEncryptionService(key)
            >>> encrypted = service.encrypt("my-api-key")
            >>> print(encrypted)
            'gAAAAABh...'
        """
        if not value:
            raise ValueError("Cannot encrypt empty value")
        
        encrypted_bytes = self.cipher.encrypt(value.encode('utf-8'))
        return encrypted_bytes.decode('utf-8')

    def decrypt(self, encrypted_value: str) -> str:
        """
        Decrypt an encrypted credential.
        
        Args:
            encrypted_value: Base64-encoded encrypted value
        
        Returns:
            Decrypted plain text value
        
        Raises:
            ValueError: If decryption fails (invalid token or corrupted data)
        
        Example:
            >>> service = CredentialEncryptionService(key)
            >>> decrypted = service.decrypt(encrypted)
            >>> print(decrypted)
            'my-api-key'
        """
        if not encrypted_value:
            raise ValueError("Cannot decrypt empty value")
        
        try:
            decrypted_bytes = self.cipher.decrypt(encrypted_value.encode('utf-8'))
            return decrypted_bytes.decode('utf-8')
        except InvalidToken:
            raise ValueError("Failed to decrypt: invalid token or corrupted data")
        except Exception as e:
            raise ValueError(f"Decryption failed: {e}")

    def rotate_key(self, old_key: str, new_key: str, encrypted_value: str) -> str:
        """
        Re-encrypt a value with a new key (for key rotation).
        
        Args:
            old_key: Old encryption key
            new_key: New encryption key
            encrypted_value: Value encrypted with old key
        
        Returns:
            Value re-encrypted with new key
        """
        # Decrypt with old key
        old_service = CredentialEncryptionService(old_key)
        plain_value = old_service.decrypt(encrypted_value)
        
        # Encrypt with new key
        new_service = CredentialEncryptionService(new_key)
        return new_service.encrypt(plain_value)

    @staticmethod
    def generate_key() -> str:
        """
        Generate a new Fernet encryption key.
        
        Returns:
            Base64-encoded encryption key
        
        Example:
            >>> key = CredentialEncryptionService.generate_key()
            >>> print(key)
            'xK8vD...'
        """
        return Fernet.generate_key().decode('utf-8')

    @staticmethod
    def is_encrypted(value: str) -> bool:
        """
        Check if a value appears to be encrypted.
        
        Args:
            value: Value to check
        
        Returns:
            True if value looks like Fernet-encrypted data
        
        Note:
            This is a heuristic check, not cryptographically guaranteed.
        """
        if not value:
            return False
        
        # Fernet tokens start with 'gAAAAA' when base64 decoded
        try:
            # Check if it's valid base64 and has Fernet signature
            decoded = base64.urlsafe_b64decode(value.encode())
            return decoded.startswith(b'\x80')  # Fernet version byte
        except Exception:
            return False


class CredentialManager:
    """
    High-level manager for storing and retrieving encrypted credentials.
    
    Provides a convenient interface for managing API keys and other secrets.
    """

    def __init__(self, encryption_service: Optional[CredentialEncryptionService] = None):
        """
        Initialize credential manager.
        
        Args:
            encryption_service: Encryption service instance. If None, creates default.
        """
        self.encryption_service = encryption_service or CredentialEncryptionService()
        self._credentials_cache = {}

    def store_credential(self, key: str, value: str, encrypt: bool = True) -> str:
        """
        Store a credential (optionally encrypted).
        
        Args:
            key: Credential identifier
            value: Credential value
            encrypt: Whether to encrypt the value
        
        Returns:
            Stored value (encrypted if encrypt=True)
        """
        if encrypt:
            encrypted_value = self.encryption_service.encrypt(value)
            self._credentials_cache[key] = encrypted_value
            return encrypted_value
        else:
            self._credentials_cache[key] = value
            return value

    def retrieve_credential(self, key: str, encrypted: bool = True) -> Optional[str]:
        """
        Retrieve a credential (optionally decrypting).
        
        Args:
            key: Credential identifier
            encrypted: Whether the stored value is encrypted
        
        Returns:
            Decrypted credential value, or None if not found
        """
        value = self._credentials_cache.get(key)
        
        if value is None:
            return None
        
        if encrypted:
            return self.encryption_service.decrypt(value)
        else:
            return value

    def delete_credential(self, key: str) -> bool:
        """
        Delete a stored credential.
        
        Args:
            key: Credential identifier
        
        Returns:
            True if credential was deleted, False if not found
        """
        if key in self._credentials_cache:
            del self._credentials_cache[key]
            return True
        return False

    def clear_all(self):
        """Clear all stored credentials from cache"""
        self._credentials_cache.clear()


# Global credential manager instance (lazy initialization)
_global_credential_manager: Optional[CredentialManager] = None


def get_credential_manager() -> CredentialManager:
    """
    Get global credential manager instance.
    
    Returns:
        Global CredentialManager instance
    """
    global _global_credential_manager
    
    if _global_credential_manager is None:
        _global_credential_manager = CredentialManager()
    
    return _global_credential_manager
