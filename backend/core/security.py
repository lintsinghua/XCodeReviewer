"""
Security utilities

Provides password management, hashing, and validation utilities.
"""

import secrets
import string
import bcrypt
from typing import List, Tuple


class PasswordPolicy:
    """
    Password policy enforcement and generation.
    
    Enforces strong password requirements:
    - Minimum 12 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """

    MIN_LENGTH = 12
    REQUIRE_UPPERCASE = True
    REQUIRE_LOWERCASE = True
    REQUIRE_DIGITS = True
    REQUIRE_SPECIAL = True
    
    SPECIAL_CHARACTERS = "!@#$%^&*()_+-=[]{}|;:,.<>?"

    @staticmethod
    def generate_secure_password(length: int = 16) -> str:
        """
        Generate a cryptographically secure random password.
        
        Args:
            length: Password length (minimum 12)
        
        Returns:
            Secure random password meeting all requirements
        
        Raises:
            ValueError: If length is less than MIN_LENGTH
        """
        if length < PasswordPolicy.MIN_LENGTH:
            raise ValueError(f"Password length must be at least {PasswordPolicy.MIN_LENGTH}")
        
        # Ensure we have at least one of each required character type
        password_chars = []
        
        if PasswordPolicy.REQUIRE_UPPERCASE:
            password_chars.append(secrets.choice(string.ascii_uppercase))
        
        if PasswordPolicy.REQUIRE_LOWERCASE:
            password_chars.append(secrets.choice(string.ascii_lowercase))
        
        if PasswordPolicy.REQUIRE_DIGITS:
            password_chars.append(secrets.choice(string.digits))
        
        if PasswordPolicy.REQUIRE_SPECIAL:
            password_chars.append(secrets.choice(PasswordPolicy.SPECIAL_CHARACTERS))
        
        # Fill the rest with random characters from all allowed types
        all_chars = string.ascii_letters + string.digits + PasswordPolicy.SPECIAL_CHARACTERS
        remaining_length = length - len(password_chars)
        
        for _ in range(remaining_length):
            password_chars.append(secrets.choice(all_chars))
        
        # Shuffle to avoid predictable patterns
        secrets.SystemRandom().shuffle(password_chars)
        
        return ''.join(password_chars)

    @staticmethod
    def validate_password(password: str) -> Tuple[bool, List[str]]:
        """
        Validate password against policy requirements.
        
        Args:
            password: Password to validate
        
        Returns:
            Tuple of (is_valid, list_of_errors)
            - is_valid: True if password meets all requirements
            - list_of_errors: List of error messages (empty if valid)
        
        Example:
            >>> is_valid, errors = PasswordPolicy.validate_password("weak")
            >>> print(is_valid)
            False
            >>> print(errors)
            ['Password must be at least 12 characters', ...]
        """
        errors = []
        
        # Check length
        if len(password) < PasswordPolicy.MIN_LENGTH:
            errors.append(f"Password must be at least {PasswordPolicy.MIN_LENGTH} characters")
        
        # Check uppercase
        if PasswordPolicy.REQUIRE_UPPERCASE and not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")
        
        # Check lowercase
        if PasswordPolicy.REQUIRE_LOWERCASE and not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")
        
        # Check digits
        if PasswordPolicy.REQUIRE_DIGITS and not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one digit")
        
        # Check special characters
        if PasswordPolicy.REQUIRE_SPECIAL and not any(c in PasswordPolicy.SPECIAL_CHARACTERS for c in password):
            errors.append(f"Password must contain at least one special character ({PasswordPolicy.SPECIAL_CHARACTERS})")
        
        is_valid = len(errors) == 0
        return is_valid, errors

    @staticmethod
    def calculate_strength(password: str) -> int:
        """
        Calculate password strength score (0-100).
        
        Args:
            password: Password to evaluate
        
        Returns:
            Strength score from 0 (very weak) to 100 (very strong)
        """
        score = 0
        
        # Length score (up to 30 points)
        length = len(password)
        if length >= 16:
            score += 30
        elif length >= 12:
            score += 20
        elif length >= 8:
            score += 10
        
        # Character variety (up to 40 points)
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in PasswordPolicy.SPECIAL_CHARACTERS for c in password)
        
        variety_count = sum([has_upper, has_lower, has_digit, has_special])
        score += variety_count * 10
        
        # Uniqueness (up to 30 points)
        unique_chars = len(set(password))
        uniqueness_ratio = unique_chars / length if length > 0 else 0
        score += int(uniqueness_ratio * 30)
        
        return min(score, 100)


def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Note: bcrypt has a 72-byte limit. Passwords longer than 72 bytes
    will be truncated before hashing.
    
    Args:
        password: Plain text password
    
    Returns:
        Hashed password
    """
    # Convert password to bytes
    password_bytes = password.encode('utf-8')
    
    # bcrypt has a 72-byte limit, truncate if necessary
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    # Generate salt and hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    
    # Return as string
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        plain_password: Plain text password
        hashed_password: Hashed password to verify against
    
    Returns:
        True if password matches, False otherwise
    """
    # Convert to bytes
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    
    # bcrypt has a 72-byte limit, truncate if necessary
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    # Verify password
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# Alias for backward compatibility
hash_password = get_password_hash


# JWT Token Management
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from app.config import settings


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Data to encode in the token
        expires_delta: Token expiration time (default: from settings)
    
    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    return encoded_jwt


def create_refresh_token(data: Dict[str, Any]) -> str:
    """
    Create a JWT refresh token.
    
    Args:
        data: Data to encode in the token
    
    Returns:
        Encoded JWT refresh token
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decode and verify a JWT token.
    
    Args:
        token: JWT token to decode
    
    Returns:
        Decoded token payload
    
    Raises:
        JWTError: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as e:
        raise JWTError(f"Could not validate credentials: {str(e)}")


def verify_token(token: str) -> Optional[str]:
    """
    Verify a JWT token and extract the subject (username).
    
    Args:
        token: JWT token to verify
    
    Returns:
        Username from token, or None if invalid
    """
    try:
        payload = decode_token(token)
        username: str = payload.get("sub")
        return username
    except JWTError:
        return None
