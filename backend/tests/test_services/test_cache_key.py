"""
Unit tests for CacheKeyGenerator
"""

import pytest
from services.cache.cache_key import CacheKeyGenerator


class TestCacheKeyGenerator:
    """Tests for CacheKeyGenerator"""

    def test_generate_basic(self):
        """Test basic key generation"""
        key = CacheKeyGenerator.generate("test", param1="value1", param2="value2")
        
        assert key.startswith("test:")
        assert len(key.split(":")) == 2
        assert len(key) <= CacheKeyGenerator.MAX_KEY_LENGTH

    def test_generate_empty_prefix(self):
        """Test generation with empty prefix"""
        with pytest.raises(ValueError, match="Prefix cannot be empty"):
            CacheKeyGenerator.generate("", param="value")

    def test_generate_consistency(self):
        """Test that same inputs produce same keys"""
        key1 = CacheKeyGenerator.generate("test", a=1, b=2, c=3)
        key2 = CacheKeyGenerator.generate("test", a=1, b=2, c=3)
        
        assert key1 == key2

    def test_generate_parameter_order_independence(self):
        """Test that parameter order doesn't affect key"""
        key1 = CacheKeyGenerator.generate("test", a=1, b=2, c=3)
        key2 = CacheKeyGenerator.generate("test", c=3, a=1, b=2)
        
        assert key1 == key2

    def test_generate_different_values(self):
        """Test that different values produce different keys"""
        key1 = CacheKeyGenerator.generate("test", param="value1")
        key2 = CacheKeyGenerator.generate("test", param="value2")
        
        assert key1 != key2

    def test_generate_different_prefixes(self):
        """Test that different prefixes produce different keys"""
        key1 = CacheKeyGenerator.generate("prefix1", param="value")
        key2 = CacheKeyGenerator.generate("prefix2", param="value")
        
        assert key1 != key2

    def test_generate_complex_data(self):
        """Test generation with complex data structures"""
        key = CacheKeyGenerator.generate(
            "test",
            list_param=[1, 2, 3],
            dict_param={"nested": "value"},
            bool_param=True
        )
        
        assert key.startswith("test:")
        assert len(key) > 0

    def test_generate_long_prefix(self):
        """Test generation with very long prefix"""
        long_prefix = "a" * 300
        key = CacheKeyGenerator.generate(long_prefix, param="value")
        
        assert len(key) <= CacheKeyGenerator.MAX_KEY_LENGTH

    def test_generate_code_key(self):
        """Test code analysis key generation"""
        code = "def hello():\n    print('world')"
        key = CacheKeyGenerator.generate_code_key(code, "python")
        
        assert key.startswith("agent_analysis:")

    def test_generate_code_key_whitespace_normalization(self):
        """Test that code whitespace is normalized"""
        code1 = "def hello():\n    pass"
        code2 = "def   hello():\n\n    pass"
        
        key1 = CacheKeyGenerator.generate_code_key(code1, "python")
        key2 = CacheKeyGenerator.generate_code_key(code2, "python")
        
        assert key1 == key2

    def test_generate_code_key_with_agents(self):
        """Test code key with agent list"""
        code = "function test() {}"
        key = CacheKeyGenerator.generate_code_key(
            code,
            "javascript",
            agents=["security", "quality"]
        )
        
        assert key.startswith("agent_analysis:")

    def test_generate_code_key_agent_order_independence(self):
        """Test that agent order doesn't affect key"""
        code = "test code"
        key1 = CacheKeyGenerator.generate_code_key(
            code, "python", agents=["security", "quality", "performance"]
        )
        key2 = CacheKeyGenerator.generate_code_key(
            code, "python", agents=["quality", "performance", "security"]
        )
        
        assert key1 == key2

    def test_generate_llm_key(self):
        """Test LLM response key generation"""
        messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi"}
        ]
        
        key = CacheKeyGenerator.generate_llm_key(
            "openai",
            "gpt-4",
            messages,
            temperature=0.7
        )
        
        assert key.startswith("llm_response:")

    def test_generate_llm_key_consistency(self):
        """Test LLM key consistency"""
        messages = [{"role": "user", "content": "Test"}]
        
        key1 = CacheKeyGenerator.generate_llm_key("openai", "gpt-4", messages)
        key2 = CacheKeyGenerator.generate_llm_key("openai", "gpt-4", messages)
        
        assert key1 == key2

    def test_generate_llm_key_different_messages(self):
        """Test LLM key with different messages"""
        messages1 = [{"role": "user", "content": "Hello"}]
        messages2 = [{"role": "user", "content": "Hi"}]
        
        key1 = CacheKeyGenerator.generate_llm_key("openai", "gpt-4", messages1)
        key2 = CacheKeyGenerator.generate_llm_key("openai", "gpt-4", messages2)
        
        assert key1 != key2

    def test_generate_user_key(self):
        """Test user-specific key generation"""
        key = CacheKeyGenerator.generate_user_key(
            "user123",
            "projects",
            filter="active"
        )
        
        assert key.startswith("user:user123:projects:")

    def test_generate_task_key(self):
        """Test task key generation"""
        key = CacheKeyGenerator.generate_task_key("task-456", "result")
        
        assert key == "task:task-456:result"

    def test_generate_task_key_default_type(self):
        """Test task key with default data type"""
        key = CacheKeyGenerator.generate_task_key("task-789")
        
        assert key == "task:task-789:result"

    def test_generate_session_key(self):
        """Test session key generation"""
        key = CacheKeyGenerator.generate_session_key("sess-abc", "cart")
        
        assert key == "session:sess-abc:cart"

    def test_hash_content(self):
        """Test content hashing"""
        content = "test content"
        hash_val = CacheKeyGenerator.hash_content(content)
        
        assert len(hash_val) == CacheKeyGenerator.DEFAULT_HASH_LENGTH
        assert isinstance(hash_val, str)

    def test_hash_content_custom_length(self):
        """Test content hashing with custom length"""
        content = "test content"
        hash_val = CacheKeyGenerator.hash_content(content, length=32)
        
        assert len(hash_val) == 32

    def test_hash_content_consistency(self):
        """Test that hashing is consistent"""
        content = "consistent content"
        hash1 = CacheKeyGenerator.hash_content(content)
        hash2 = CacheKeyGenerator.hash_content(content)
        
        assert hash1 == hash2

    def test_validate_key_valid(self):
        """Test validation of valid keys"""
        key = "prefix:abc123def456"
        
        assert CacheKeyGenerator.validate_key(key) is True

    def test_validate_key_empty(self):
        """Test validation of empty key"""
        assert CacheKeyGenerator.validate_key("") is False
        assert CacheKeyGenerator.validate_key(None) is False

    def test_validate_key_too_long(self):
        """Test validation of too long key"""
        long_key = "a" * (CacheKeyGenerator.MAX_KEY_LENGTH + 1)
        
        assert CacheKeyGenerator.validate_key(long_key) is False

    def test_validate_key_with_spaces(self):
        """Test validation of key with spaces"""
        key_with_space = "prefix: value"
        
        assert CacheKeyGenerator.validate_key(key_with_space) is False

    def test_validate_key_with_newlines(self):
        """Test validation of key with newlines"""
        key_with_newline = "prefix:\nvalue"
        
        assert CacheKeyGenerator.validate_key(key_with_newline) is False

    def test_validate_key_not_string(self):
        """Test validation of non-string key"""
        assert CacheKeyGenerator.validate_key(123) is False
        assert CacheKeyGenerator.validate_key(['key']) is False
