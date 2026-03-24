"""API test fixtures — TestClient with mocked auth and Supabase."""
import os

# Set required env vars BEFORE any app imports (get_settings is called at module level)
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.key")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.service")

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user, get_supabase_admin, get_supabase_client


MOCK_USER = {"id": "user-123", "email": "test@example.com", "auth_type": "jwt"}


def mock_supabase():
    """Create a mock Supabase client with chainable methods."""
    mock = MagicMock()
    # Make table().select().eq().single().execute() chainable
    mock.table.return_value = mock.table
    mock.table.select.return_value = mock.table
    mock.table.insert.return_value = mock.table
    mock.table.update.return_value = mock.table
    mock.table.delete.return_value = mock.table
    mock.table.eq.return_value = mock.table
    mock.table.neq.return_value = mock.table
    mock.table.ilike.return_value = mock.table
    mock.table.order.return_value = mock.table
    mock.table.range.return_value = mock.table
    mock.table.single.return_value = mock.table
    mock.table.execute.return_value = MagicMock(data=[])
    # Storage mock
    mock.storage.from_.return_value = mock.storage
    mock.storage.upload.return_value = None
    mock.storage.download.return_value = b"# Test content"
    return mock


@pytest.fixture
def mock_sb():
    return mock_supabase()


@pytest.fixture
def client(mock_sb):
    """FastAPI TestClient with mocked dependencies."""
    async def override_user():
        return MOCK_USER

    def override_admin():
        return mock_sb

    def override_client():
        return mock_sb

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_supabase_admin] = override_admin
    app.dependency_overrides[get_supabase_client] = override_client

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def unauthed_client():
    """TestClient with NO auth override — tests should get 401."""
    # Clear any existing overrides
    app.dependency_overrides.clear()
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()
