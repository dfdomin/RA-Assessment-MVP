"""
Unit tests S1-19 — src/core/security.py
Covers: U-S1-01, U-S1-02, U-S1-03
"""
import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")

from datetime import datetime, timedelta, timezone

import pytest
from jose import ExpiredSignatureError, jwt

from src.core.config import settings
from src.core.security import decode_jwt, encode_jwt, hash_password, verify_password


class TestEncodeJwt:
    """U-S1-01: encode_jwt() produces a token with correct sub, jti, exp fields."""

    def test_token_contains_sub_jti_exp(self):
        token, jti = encode_jwt(user_id=42, role="leader")

        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        assert payload["sub"] == "42"
        assert payload["role"] == "leader"
        assert payload["jti"] == jti
        assert "exp" in payload

    def test_jti_is_unique_across_calls(self):
        _, jti1 = encode_jwt(user_id=1, role="admin")
        _, jti2 = encode_jwt(user_id=1, role="admin")

        assert jti1 != jti2

    def test_exp_is_in_the_future(self):
        token, _ = encode_jwt(user_id=1, role="teacher")
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        exp_dt = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        assert exp_dt > datetime.now(timezone.utc)


class TestDecodeJwt:
    """U-S1-02: decode_jwt() rejects expired tokens with ExpiredSignatureError."""

    def test_valid_token_decodes_correctly(self):
        token, jti = encode_jwt(user_id=7, role="admin")
        payload = decode_jwt(token)

        assert payload["sub"] == "7"
        assert payload["jti"] == jti

    def test_expired_token_raises_expired_signature_error(self):
        expired_payload = {
            "sub": "99",
            "role": "teacher",
            "jti": "test-jti-expired",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        }
        expired_token = jwt.encode(
            expired_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM
        )

        with pytest.raises(ExpiredSignatureError):
            decode_jwt(expired_token)

    def test_tampered_token_raises_jwt_error(self):
        from jose import JWTError

        token, _ = encode_jwt(user_id=1, role="admin")
        tampered = token[:-5] + "XXXXX"

        with pytest.raises(JWTError):
            decode_jwt(tampered)


class TestPasswordHashing:
    """U-S1-03: hash_password() produces a verifiable bcrypt hash."""

    def test_hashed_password_verifies_with_correct_plain(self):
        plain = "S3cur3P@ss!"
        hashed = hash_password(plain)

        assert verify_password(plain, hashed) is True

    def test_wrong_password_does_not_verify(self):
        hashed = hash_password("correct-horse-battery-staple")

        assert verify_password("wrong-password", hashed) is False

    def test_hash_is_not_plain_text(self):
        plain = "MyPassword123"
        hashed = hash_password(plain)

        assert hashed != plain
        assert hashed.startswith("$2b$")  # bcrypt identifier

    def test_same_plain_produces_different_hashes(self):
        plain = "SamePassword"
        hash1 = hash_password(plain)
        hash2 = hash_password(plain)

        assert hash1 != hash2  # bcrypt uses random salt per call
        assert verify_password(plain, hash1) is True
        assert verify_password(plain, hash2) is True
