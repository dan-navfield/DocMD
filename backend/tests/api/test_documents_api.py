"""Tests for /api/documents endpoints."""
import pytest
from unittest.mock import MagicMock


SAMPLE_DOC = {
    "id": "doc-1",
    "project_id": None,
    "title": "Test Doc",
    "doc_type": "generic",
    "status": "received",
    "tags": ["test"],
    "metadata": {},
    "markdown_storage_path": "user-123/doc-1/v1.md",
    "current_version": 1,
    "created_by": "user-123",
    "created_at": "2026-01-01T00:00:00+00:00",
    "updated_at": "2026-01-01T00:00:00+00:00",
}


class TestListDocuments:
    def test_list_returns_200(self, client, mock_sb):
        mock_sb.table.execute.return_value = MagicMock(data=[SAMPLE_DOC])
        res = client.get("/api/documents")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_list_with_status_filter(self, client, mock_sb):
        mock_sb.table.execute.return_value = MagicMock(data=[SAMPLE_DOC])
        res = client.get("/api/documents?status=received")
        assert res.status_code == 200

    def test_list_empty(self, client, mock_sb):
        mock_sb.table.execute.return_value = MagicMock(data=[])
        res = client.get("/api/documents")
        assert res.status_code == 200
        assert res.json() == []


class TestGetDocument:
    def test_get_existing_doc(self, client, mock_sb):
        mock_sb.table.execute.return_value = MagicMock(data=SAMPLE_DOC)
        res = client.get("/api/documents/doc-1")
        assert res.status_code == 200

    def test_get_nonexistent_doc(self, client, mock_sb):
        mock_sb.table.execute.return_value = MagicMock(data=None)
        res = client.get("/api/documents/nonexistent")
        assert res.status_code == 404


class TestCreateDocument:
    def test_create_with_markdown(self, client, mock_sb):
        mock_sb.table.execute.return_value = MagicMock(data=[SAMPLE_DOC])
        res = client.post(
            "/api/documents",
            data={"title": "New Doc", "markdown": "# Hello"},
        )
        assert res.status_code == 200

    def test_create_without_content_returns_400(self, client, mock_sb):
        res = client.post(
            "/api/documents",
            data={"title": "Empty Doc"},
        )
        assert res.status_code == 400


class TestDeleteDocument:
    def test_delete_existing(self, client, mock_sb):
        mock_sb.table.execute.return_value = MagicMock(data=[SAMPLE_DOC])
        res = client.delete("/api/documents/doc-1")
        assert res.status_code == 200

    def test_delete_nonexistent(self, client, mock_sb):
        mock_sb.table.execute.return_value = MagicMock(data=[])
        res = client.delete("/api/documents/nonexistent")
        assert res.status_code == 404
