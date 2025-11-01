"""
Unit tests for security utilities
"""

import pytest
import re
from core.security import (
    PasswordPolicy,
    get_password_hash,
    verify_password,
)


class TestPasswordPolicy:
    """Tests for PasswordPolicy"""

    def test_generate_secure_password_default_length(self):
        """Test generating password with default length"""
        password = PasswordPolicy.generate_secure_password()
        
        assert len(password) == 16
        is_valid, errors = PasswordPolicy.validate_password(password)
        assert is_valid
        assert len(errors) == 0

    def test_generate_secure_password_custom_length(self):
        """Test generating password with custom length"""
        password = PasswordPolicy.generate_secure_password(length=20)
        
        assert len(password) == 20

    def test_generate_secure_password_minimum_length(self):
        """Test generating password with minimum length"""
        password = PasswordPolicy.generate_secure_password(length=12)
        
        assert len(password) == 12

    def test_generate_secure_password_too_short(self):
        """Test that generating too short password raises error"""
        with pytest.raises(ValueError, match="at least 12"):
            PasswordPolicy.generate_secure_password(length=8)

    def test_generate_secure_password_meets_requirements(self):
        """Test that generated password meets all requirements"""
        for _ in range(10):  # Test multiple times for randomness
            password = PasswordPolicy.generate_secure_password()
            
            assert any(c.isupper() for c in password)
            assert any(c.islower() for c in password)
            assert any(c.isdigit() for c in password)
            assert any(c in PasswordPolicy.SPECIAL_CHARACTERS for c in password)

    def test_generate_secure_password_uniqueness(self):
        """Test that generated passwords are unique"""
        passwords = [PasswordPolicy.generate_secure_password() for _ in range(100)]
        
        # All passwords should be unique
        assert len(set(passwords)) == 100

    def test_validate_password_valid(self):
        """Test validating a valid password"""
        password = "SecurePass123!@#"
        is_valid, errors = PasswordPolicy.validate_password(password)
        
        assert is_valid
        assert len(errors) == 0

    def test_validate_password_too_short(self):
        """Test validating too short password"""
        password = "Short1!"
        is_valid, errors = PasswordPolicy.validate_password(password)
        
        assert not is_valid
        assert any("at least 12 characters" in err for err in errors)

    def test_validate_password_no_uppercase(self):
        """Test validating password without uppercase"""
        password = "lowercase123!"
        is_valid, errors = PasswordPolicy.validate_password(password)
        
        assert not is_valid
        assert any("uppercase" in err for err in errors)

    def test_validate_password_no_lowercase(self):
        """Test validating password without lowercase"""
        password = "UPPERCASE123!"
        is_valid, errors = PasswordPolicy.validate_password(password)
        
        assert not is_valid
        assert any("lowercase" in err for err in errors)

    def test_validate_password_no_digits(self):
        """Test validating password without digits"""
        password = "NoDigitsHere!"
        is_valid, errors = PasswordPolicy.validate_password(password)
        
        assert not is_valid
        assert any("digit" in err for err in errors)

    def test_validate_password_no_special(self):
        """Test validating password without special characters"""
        password = "NoSpecial123"
        is_valid, errors = PasswordPolicy.validate_password(password)
        
        assert not is_valid
        assert any("special character" in err for err in errors)

    def test_validate_password_multiple_errors(self):
        """Test validating password with multiple errors"""
        password = "weak"
        is_valid, errors = PasswordPolicy.validate_password(password)
        
        assert not is_valid
        assert len(errors) > 1

    def test_calculate_strength_very_strong(self):
        """Test strength calculation for very strong password"""
        password = "VeryStr0ng!Pass@2024#Secure"
        strength = PasswordPolicy.calculate_strength(password)
        
        assert strength >= 80

    def test_calculate_strength_strong(self):
        """Test strength calculation for strong password"""
        password = "Strong!Pass123"
        strength = PasswordPolicy.calculate_strength(password)
        
        # 14 chars (20) + 4 types (40) + uniqueness (~26) = ~86
        assert 80 <= strength <= 90

    def test_calculate_strength_medium(self):
        """Test strength calculation for medium password"""
        password = "Medium123!"
        strength = PasswordPolicy.calculate_strength(password)
        
        # 10 chars (10) + 4 types (40) + uniqueness (30) = 80
        assert 75 <= strength <= 85

    def test_calculate_strength_weak(self):
        """Test strength calculation for weak password"""
        password = "weak123"
        strength = PasswordPolicy.calculate_strength(password)
        
        # 7 chars (0) + 2 types (20) + uniqueness (30) = 50
        assert 45 <= strength <= 55

    def test_calculate_strength_empty(self):
        """Test strength calculation for empty password"""
        password = ""
        strength = PasswordPolicy.calculate_strength(password)
        
        assert strength == 0

    def test_calculate_strength_max_100(self):
        """Test that strength never exceeds 100"""
        password = "ExtremelyLongAndComplexPassword!@#123ABC$%^456DEF&*()"
        strength = PasswordPolicy.calculate_strength(password)
        
        assert strength <= 100


class TestPasswordHashing:
    """Tests for password hashing functions"""

    def test_get_password_hash(self):
        """Test password hashing"""
        password = "TestPassword123!"
        hashed = get_password_hash(password)
        
        assert hashed != password
        assert len(hashed) > 0
        assert hashed.startswith("$2b$")  # bcrypt prefix

    def test_get_password_hash_different_for_same_password(self):
        """Test that same password produces different hashes (salt)"""
        password = "SamePassword123!"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        
        assert hash1 != hash2  # Different due to salt

    def test_verify_password_correct(self):
        """Test verifying correct password"""
        password = "CorrectPassword123!"
        hashed = get_password_hash(password)
        
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Test verifying incorrect password"""
        password = "CorrectPassword123!"
        wrong_password = "WrongPassword123!"
        hashed = get_password_hash(password)
        
        assert verify_password(wrong_password, hashed) is False

    def test_verify_password_case_sensitive(self):
        """Test that password verification is case sensitive"""
        password = "CaseSensitive123!"
        hashed = get_password_hash(password)
        
        assert verify_password("casesensitive123!", hashed) is False

    def test_hash_and_verify_workflow(self):
        """Test complete hash and verify workflow"""
        original_password = "UserPassword123!@#"
        
        # Hash the password
        hashed = get_password_hash(original_password)
        
        # Verify correct password
        assert verify_password(original_password, hashed) is True
        
        # Verify incorrect password
        assert verify_password("WrongPassword123!", hashed) is False
