"""Tests for DocumentService business logic."""
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException

from app.services.document_service import DocumentService


def make_chain(data=None):
    """Build a chainable query mock that returns data on .execute()."""
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=data if data is not None else [])
    chain.select.return_value = chain
    chain.insert.return_value = chain
    chain.update.return_value = chain
    chain.delete.return_value = chain
    chain.eq.return_value = chain
    chain.ilike.return_value = chain
    chain.order.return_value = chain
    chain.range.return_value = chain
    chain.single.return_value = chain
    return chain


def make_mock_supabase(table_chains=None, storage_data=b"# content"):
    """Build a mock Supabase client.

    table_chains: dict mapping table name -> chain mock, or a single chain
                  used for all tables, or None for a default empty chain.
    """
    mock = MagicMock()

    if table_chains is None:
        default_chain = make_chain()
        mock.table.return_value = default_chain
    elif isinstance(table_chains, dict):
        mock.table.side_effect = lambda name: table_chains.get(name, make_chain())
    else:
        mock.table.return_value = table_chains

    mock.storage.from_.return_value = mock.storage
    mock.storage.upload.return_value = None
    mock.storage.download.return_value = storage_data
    return mock


class TestCreateDocument:
    async def test_create_with_text(self):
        doc_record = {
            "id": "doc-1", "title": "Test", "status": "received",
            "doc_type": "", "tags": [], "metadata": {},
            "markdown_storage_path": "u/doc-1/v1.md",
            "current_version": 1, "created_by": "user-1",
            "project_id": None,
            "created_at": "2026-01-01T00:00:00", "updated_at": "2026-01-01T00:00:00",
        }
        doc_chain = make_chain(data=[doc_record])
        version_chain = make_chain(data=[])
        audit_chain = make_chain(data=[])
        sb = make_mock_supabase(table_chains={
            "documents": doc_chain,
            "document_versions": version_chain,
            "audit_log": audit_chain,
        })
        service = DocumentService(sb)
        result = await service.create_document(
            user_id="user-1", title="Test", project_id=None,
            doc_type="", tags=[], markdown_text="# Hello"
        )
        assert result["id"] == "doc-1"
        sb.storage.from_.assert_any_call("markdown-sources")
        sb.storage.upload.assert_called_once()

    async def test_create_without_content_raises_400(self):
        sb = make_mock_supabase()
        service = DocumentService(sb)
        with pytest.raises(HTTPException) as exc_info:
            await service.create_document(
                user_id="user-1", title="Empty", project_id=None,
                doc_type="", tags=[], file=None, markdown_text=None
            )
        assert exc_info.value.status_code == 400


class TestGetDocument:
    async def test_get_existing(self):
        doc = {"id": "doc-1", "title": "Found"}
        sb = make_mock_supabase(table_chains={
            "documents": make_chain(data=doc),
        })
        service = DocumentService(sb)
        result = await service.get_document("doc-1", "user-1")
        assert result["id"] == "doc-1"

    async def test_get_nonexistent_raises_404(self):
        sb = make_mock_supabase(table_chains={
            "documents": make_chain(data=None),
        })
        service = DocumentService(sb)
        with pytest.raises(HTTPException) as exc_info:
            await service.get_document("nonexistent", "user-1")
        assert exc_info.value.status_code == 404


class TestListDocuments:
    async def test_list_returns_data(self):
        docs = [{"id": "doc-1"}, {"id": "doc-2"}]
        sb = make_mock_supabase(table_chains={
            "documents": make_chain(data=docs),
        })
        service = DocumentService(sb)
        result = await service.list_documents("user-1")
        assert len(result) == 2

    async def test_list_empty(self):
        sb = make_mock_supabase(table_chains={
            "documents": make_chain(data=[]),
        })
        service = DocumentService(sb)
        result = await service.list_documents("user-1")
        assert result == []


class TestDeleteDocument:
    async def test_delete_existing(self):
        sb = make_mock_supabase(table_chains={
            "documents": make_chain(data=[{"id": "doc-1"}]),
            "audit_log": make_chain(data=[]),
        })
        service = DocumentService(sb)
        await service.delete_document("doc-1", "user-1")
        # No exception = success

    async def test_delete_nonexistent_raises_404(self):
        sb = make_mock_supabase(table_chains={
            "documents": make_chain(data=[]),
        })
        service = DocumentService(sb)
        with pytest.raises(HTTPException) as exc_info:
            await service.delete_document("nonexistent", "user-1")
        assert exc_info.value.status_code == 404


class TestGetContent:
    async def test_get_content_returns_markdown(self):
        doc = {"id": "doc-1", "markdown_storage_path": "user/doc/v1.md"}
        sb = make_mock_supabase(
            table_chains={"documents": make_chain(data=doc)},
            storage_data=b"# Hello World",
        )
        service = DocumentService(sb)
        content = await service.get_content("doc-1", "user-1")
        assert content == "# Hello World"

    async def test_get_content_no_path_raises_404(self):
        doc = {"id": "doc-1", "markdown_storage_path": ""}
        sb = make_mock_supabase(
            table_chains={"documents": make_chain(data=doc)},
        )
        service = DocumentService(sb)
        with pytest.raises(HTTPException) as exc_info:
            await service.get_content("doc-1", "user-1")
        assert exc_info.value.status_code == 404


class TestUpdateContent:
    async def test_update_increments_version(self):
        doc = {"id": "doc-1", "current_version": 1, "markdown_storage_path": "u/d/v1.md"}
        updated_doc = {**doc, "current_version": 2, "markdown_storage_path": "user-1/doc-1/v2.md"}

        # get_document calls documents table, then version insert calls
        # document_versions table, then update calls documents table again.
        # We need separate chain behavior for the two documents calls.
        doc_chain = make_chain()
        doc_chain.execute.side_effect = [
            MagicMock(data=doc),           # get_document -> .single().execute()
            MagicMock(data=[updated_doc]),  # update -> .execute()
        ]
        version_chain = make_chain(data=[])
        audit_chain = make_chain(data=[])

        sb = make_mock_supabase(table_chains={
            "documents": doc_chain,
            "document_versions": version_chain,
            "audit_log": audit_chain,
        })
        service = DocumentService(sb)
        result = await service.update_content("doc-1", "user-1", "# Updated")
        assert result["current_version"] == 2
