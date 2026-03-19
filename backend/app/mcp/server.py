"""MDDoc MCP Server — exposes document conversion tools via MCP protocol."""
from __future__ import annotations

import json
import os

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
from supabase import create_client

from app.services.document_service import DocumentService
from app.services.conversion_service import ConversionService
from app.services.export_service import ExportService
from app.services.agent_service import AgentService


def get_supabase():
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    return create_client(url, key)


# Resolve user_id from API key
def resolve_user(api_key: str, supabase) -> str:
    import hashlib
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    result = supabase.table("api_keys").select("user_id").eq("key_hash", key_hash).single().execute()
    if not result.data:
        raise ValueError("Invalid API key")
    return result.data["user_id"]


app = Server("mddoc")


@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="mddoc_submit_document",
            description="Submit a Markdown document to MDDoc. Returns the document record with classification suggestions.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Document title"},
                    "markdown": {"type": "string", "description": "Markdown content"},
                    "project_id": {"type": "string", "description": "Optional project ID"},
                    "api_key": {"type": "string", "description": "MDDoc API key"},
                },
                "required": ["title", "markdown", "api_key"],
            },
        ),
        Tool(
            name="mddoc_convert",
            description="Convert a document to Word format using a template and mapping.",
            inputSchema={
                "type": "object",
                "properties": {
                    "document_id": {"type": "string", "description": "Document ID to convert"},
                    "template_id": {"type": "string", "description": "Template ID to use"},
                    "mapping_id": {"type": "string", "description": "Mapping ID to use"},
                    "api_key": {"type": "string", "description": "MDDoc API key"},
                },
                "required": ["document_id", "template_id", "mapping_id", "api_key"],
            },
        ),
        Tool(
            name="mddoc_export",
            description="Export a converted document to a destination (e.g., SharePoint).",
            inputSchema={
                "type": "object",
                "properties": {
                    "conversion_id": {"type": "string", "description": "Conversion ID to export"},
                    "destination_id": {"type": "string", "description": "Destination ID"},
                    "api_key": {"type": "string", "description": "MDDoc API key"},
                },
                "required": ["conversion_id", "destination_id", "api_key"],
            },
        ),
        Tool(
            name="mddoc_get_status",
            description="Get the status and details of a document.",
            inputSchema={
                "type": "object",
                "properties": {
                    "document_id": {"type": "string", "description": "Document ID"},
                    "api_key": {"type": "string", "description": "MDDoc API key"},
                },
                "required": ["document_id", "api_key"],
            },
        ),
        Tool(
            name="mddoc_list_templates",
            description="List all available Word templates.",
            inputSchema={
                "type": "object",
                "properties": {
                    "api_key": {"type": "string", "description": "MDDoc API key"},
                },
                "required": ["api_key"],
            },
        ),
        Tool(
            name="mddoc_list_mappings",
            description="List all available mapping configurations.",
            inputSchema={
                "type": "object",
                "properties": {
                    "api_key": {"type": "string", "description": "MDDoc API key"},
                    "template_id": {"type": "string", "description": "Filter by template ID"},
                },
                "required": ["api_key"],
            },
        ),
        Tool(
            name="mddoc_full_pipeline",
            description="Submit Markdown and run the full pipeline: classify, convert, and optionally export. Returns the conversion report and output path.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Document title"},
                    "markdown": {"type": "string", "description": "Markdown content"},
                    "project_id": {"type": "string", "description": "Project ID (required for export)"},
                    "api_key": {"type": "string", "description": "MDDoc API key"},
                    "export": {"type": "boolean", "description": "Whether to export after conversion", "default": False},
                },
                "required": ["title", "markdown", "api_key"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    supabase = get_supabase()
    api_key = arguments.pop("api_key", "")
    user_id = resolve_user(api_key, supabase)

    try:
        if name == "mddoc_submit_document":
            service = DocumentService(supabase)
            doc = await service.create_document(
                user_id=user_id,
                title=arguments["title"],
                project_id=arguments.get("project_id"),
                doc_type="",
                tags=[],
                markdown_text=arguments["markdown"],
            )
            # Also classify
            agent = AgentService(supabase)
            classification = await agent.classify(
                markdown=arguments["markdown"],
                project_id=arguments.get("project_id"),
                mode="suggest",
                user_id=user_id,
            )
            result = {**doc, "classification": classification}
            return [TextContent(type="text", text=json.dumps(result, default=str))]

        elif name == "mddoc_convert":
            service = ConversionService(supabase)
            conversion = await service.convert_document(
                document_id=arguments["document_id"],
                template_id=arguments["template_id"],
                mapping_id=arguments["mapping_id"],
                user_id=user_id,
            )
            return [TextContent(type="text", text=json.dumps(conversion, default=str))]

        elif name == "mddoc_export":
            service = ExportService(supabase)
            export = await service.export_conversion(
                conversion_id=arguments["conversion_id"],
                destination_id=arguments["destination_id"],
                user_id=user_id,
            )
            return [TextContent(type="text", text=json.dumps(export, default=str))]

        elif name == "mddoc_get_status":
            service = DocumentService(supabase)
            doc = await service.get_document(arguments["document_id"], user_id)
            return [TextContent(type="text", text=json.dumps(doc, default=str))]

        elif name == "mddoc_list_templates":
            from app.services.template_service import TemplateService
            service = TemplateService(supabase)
            templates = await service.list_templates()
            return [TextContent(type="text", text=json.dumps(templates, default=str))]

        elif name == "mddoc_list_mappings":
            from app.services.mapping_service import MappingService
            service = MappingService(supabase)
            mappings = await service.list_mappings(template_id=arguments.get("template_id"))
            return [TextContent(type="text", text=json.dumps(mappings, default=str))]

        elif name == "mddoc_full_pipeline":
            # Full pipeline: submit -> classify (auto mode) -> convert -> optionally export
            agent = AgentService(supabase)
            result = await agent.classify(
                markdown=arguments["markdown"],
                project_id=arguments.get("project_id"),
                mode="auto",
                user_id=user_id,
            )
            return [TextContent(type="text", text=json.dumps(result, default=str))]

        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except Exception as e:
        return [TextContent(type="text", text=json.dumps({"error": str(e)}))]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
