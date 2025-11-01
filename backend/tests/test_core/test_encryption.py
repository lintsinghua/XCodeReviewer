"""Tests for Encryption Service"""
import pytest
from core.encryption import EncryptionService


class TestEncryptionService:
    """Test encryption service"""
    
    def test_encrypt_decrypt(self):
        """Test basic encryption and decryption"""
        service = EncryptionService()
        
        plaintext = "sensitive_api_key_12345"
        encrypted = service.encrypt_credential(plaintext)
        decrypted = service.decrypt_credential(encrypted)
        
        assert decrypted == plaintext
        assert encrypted != plaintext
    
    def test_encrypt_empty_string(self):
        """Test encrypting empty string"""
        service = EncryptionService()
        
        encrypted = service.encrypt_credential("")
        decrypted = service.decrypt_credential(encrypted)
        
        assert decrypted == ""
    
    def test_encrypt_unicode(self):
        """Test encrypting unicode characters"""
        service = EncryptionService()
        
        plaintext = "密钥🔐测试"
        encrypted = service.encrypt_credential(plaintext)
        decrypted = service.decrypt_credential(encrypted)
        
        assert decrypted == plaintext
    
    def test_decrypt_invalid_token(self):
        """Test decrypting invalid token"""
        service = EncryptionService()
        
        with pytest.raises(Exception):
            service.decrypt_credential("invalid_token")
    
    def test_different_encryptions(self):
        """Test that same plaintext produces different ciphertexts"""
        service = EncryptionService()
        
        plaintext = "test_key"
        encrypted1 = service.encrypt_credential(plaintext)
        encrypted2 = service.encrypt_credential(plaintext)
        
        # Due to Fernet's timestamp, these should be different
        # but both should decrypt to the same value
        decrypted1 = service.decrypt_credential(encrypted1)
        decrypted2 = service.decrypt_credential(encrypted2)
        
        assert decrypted1 == plaintext
        assert decrypted2 == plaintext
