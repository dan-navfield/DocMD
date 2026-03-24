"""Tests for authentication enforcement on API endpoints."""
import pytest


class TestAuthEnforcement:
    """Verify that endpoints require authentication."""

    def test_documents_list_requires_auth(self, unauthed_client):
        res = unauthed_client.get("/api/documents")
        assert res.status_code == 401

    def test_templates_list_requires_auth(self, unauthed_client):
        res = unauthed_client.get("/api/templates")
        assert res.status_code == 401

    def test_mappings_list_requires_auth(self, unauthed_client):
        res = unauthed_client.get("/api/mappings")
        assert res.status_code == 401

    def test_projects_list_requires_auth(self, unauthed_client):
        res = unauthed_client.get("/api/projects")
        assert res.status_code == 401

    def test_settings_requires_auth(self, unauthed_client):
        res = unauthed_client.get("/api/settings/llm")
        assert res.status_code == 401

    def test_health_does_not_require_auth(self, unauthed_client):
        res = unauthed_client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"
