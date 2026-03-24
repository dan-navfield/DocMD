"""Tests for ConversionService business logic."""
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException

from app.services.conversion_service import ConversionService


def make_chain(data=None):
    """Build a chainable query mock that returns data on .execute()."""
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=data if data is not None else [])
    chain.select.return_value = chain
    chain.insert.return_value = chain
    chain.update.return_value = chain
    chain.delete.return_value = chain
    chain.eq.return_value = chain
    chain.single.return_value = chain
    chain.order.return_value = chain
    return chain


def make_mock_supabase(table_chains=None):
    """Build a mock Supabase client.

    table_chains: dict mapping table name -> chain mock, or None for default.
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
    mock.storage.download.return_value = b""
    return mock


class TestConvertDocument:
    async def test_missing_document_raises_404(self):
        sb = make_mock_supabase(table_chains={
            "documents": make_chain(data=None),
        })
        service = ConversionService(sb)
        with pytest.raises(HTTPException) as exc_info:
            await service.convert_document("bad-id", "tmpl-1", "map-1", "user-1")
        assert exc_info.value.status_code == 404

    async def test_missing_template_raises_404(self):
        sb = make_mock_supabase(table_chains={
            "documents": make_chain(data={"id": "doc-1", "markdown_storage_path": "path.md"}),
            "templates": make_chain(data=None),
        })
        service = ConversionService(sb)
        with pytest.raises(HTTPException) as exc_info:
            await service.convert_document("doc-1", "bad-tmpl", "map-1", "user-1")
        assert exc_info.value.status_code == 404

    async def test_missing_mapping_raises_404(self):
        sb = make_mock_supabase(table_chains={
            "documents": make_chain(data={"id": "doc-1", "markdown_storage_path": "path.md"}),
            "templates": make_chain(data={"id": "tmpl-1", "file_storage_path": "tmpl.docx"}),
            "mappings": make_chain(data=None),
        })
        service = ConversionService(sb)
        with pytest.raises(HTTPException) as exc_info:
            await service.convert_document("doc-1", "tmpl-1", "bad-map", "user-1")
        assert exc_info.value.status_code == 404


class TestGetConversion:
    async def test_get_existing(self):
        sb = make_mock_supabase(table_chains={
            "conversions": make_chain(data={"id": "conv-1", "status": "completed"}),
        })
        service = ConversionService(sb)
        result = await service.get_conversion("conv-1", "user-1")
        assert result["id"] == "conv-1"

    async def test_get_nonexistent_raises_404(self):
        sb = make_mock_supabase(table_chains={
            "conversions": make_chain(data=None),
        })
        service = ConversionService(sb)
        with pytest.raises(HTTPException) as exc_info:
            await service.get_conversion("bad-id", "user-1")
        assert exc_info.value.status_code == 404


class TestDownloadConversion:
    async def test_download_no_output_raises_400(self):
        sb = make_mock_supabase(table_chains={
            "conversions": make_chain(data={
                "id": "conv-1", "status": "completed",
                "output_storage_path": None, "document_id": "doc-1",
            }),
        })
        service = ConversionService(sb)
        with pytest.raises(HTTPException) as exc_info:
            await service.download_conversion("conv-1", "user-1")
        assert exc_info.value.status_code == 400
