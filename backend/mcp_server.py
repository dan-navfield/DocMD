"""DocMD MCP Server — standalone entry point for Claude Desktop / Claude Code.

Exposes DocMD tools via MCP protocol, calling the REST API endpoints.
This avoids importing the full backend; it just needs httpx.
"""
from __future__ import annotations

import asyncio
import json
import os

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

API_URL = os.environ.get("DOCMD_API_URL", "http://localhost:8000")
API_KEY = os.environ.get("DOCMD_API_KEY", "")

app = Server("docmd")


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }


@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="docmd_list_templates",
            description="List all available Word templates in DocMD.",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="docmd_list_mappings",
            description="List all available style mapping configurations. Optionally filter by template.",
            inputSchema={
                "type": "object",
                "properties": {
                    "template_id": {
                        "type": "string",
                        "description": "Optional template ID to filter by",
                    },
                },
            },
        ),
        Tool(
            name="docmd_list_documents",
            description="List all documents in DocMD.",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="docmd_submit_document",
            description="Submit a Markdown document to DocMD. Provide a title and markdown content.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Document title",
                    },
                    "markdown": {
                        "type": "string",
                        "description": "Markdown content of the document",
                    },
                    "project_id": {
                        "type": "string",
                        "description": "Optional project ID to associate with",
                    },
                },
                "required": ["title", "markdown"],
            },
        ),
        Tool(
            name="docmd_get_document",
            description="Get details of a specific document by ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "document_id": {
                        "type": "string",
                        "description": "The document ID",
                    },
                },
                "required": ["document_id"],
            },
        ),
        Tool(
            name="docmd_convert",
            description="Convert a document to a styled Word file using a template and mapping.",
            inputSchema={
                "type": "object",
                "properties": {
                    "document_id": {
                        "type": "string",
                        "description": "Document ID to convert",
                    },
                    "template_id": {
                        "type": "string",
                        "description": "Template ID to use for styling",
                    },
                    "mapping_id": {
                        "type": "string",
                        "description": "Mapping ID for style rules",
                    },
                },
                "required": ["document_id", "template_id", "mapping_id"],
            },
        ),
        Tool(
            name="docmd_classify",
            description="Use AI to classify a markdown document (detect doc type, suggest template/mapping).",
            inputSchema={
                "type": "object",
                "properties": {
                    "markdown": {
                        "type": "string",
                        "description": "Markdown content to classify",
                    },
                    "project_id": {
                        "type": "string",
                        "description": "Optional project ID for context",
                    },
                },
                "required": ["markdown"],
            },
        ),
    ]


async def _validate_billing(client: httpx.AsyncClient) -> str | None:
    """Call the backend to validate API key + billing.

    Returns ``None`` on success, or an error message string on failure.
    """
    try:
        r = await client.get(f"{API_URL}/api/mcp/validate", headers=_headers())
        if r.status_code == 200:
            return None
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        detail = body.get("detail", r.text)
        return f"Billing check failed ({r.status_code}): {detail}"
    except Exception as e:
        return f"Billing validation error: {e}"


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            # Validate API key + subscription before every tool call
            billing_error = await _validate_billing(client)
            if billing_error:
                return [TextContent(type="text", text=billing_error)]

            if name == "docmd_list_templates":
                r = await client.get(f"{API_URL}/api/templates", headers=_headers())
                r.raise_for_status()
                return [TextContent(type="text", text=json.dumps(r.json(), indent=2))]

            elif name == "docmd_list_mappings":
                params = {}
                if arguments.get("template_id"):
                    params["template_id"] = arguments["template_id"]
                r = await client.get(
                    f"{API_URL}/api/mappings",
                    headers=_headers(),
                    params=params,
                )
                r.raise_for_status()
                return [TextContent(type="text", text=json.dumps(r.json(), indent=2))]

            elif name == "docmd_list_documents":
                r = await client.get(f"{API_URL}/api/documents", headers=_headers())
                r.raise_for_status()
                return [TextContent(type="text", text=json.dumps(r.json(), indent=2))]

            elif name == "docmd_submit_document":
                # Use multipart form upload
                data = {
                    "title": arguments["title"],
                }
                if arguments.get("project_id"):
                    data["project_id"] = arguments["project_id"]
                files = {
                    "file": (
                        f"{arguments['title']}.md",
                        arguments["markdown"].encode(),
                        "text/markdown",
                    ),
                }
                headers = {"Authorization": f"Bearer {API_KEY}"}
                r = await client.post(
                    f"{API_URL}/api/documents",
                    headers=headers,
                    data=data,
                    files=files,
                )
                r.raise_for_status()
                return [TextContent(type="text", text=json.dumps(r.json(), indent=2))]

            elif name == "docmd_get_document":
                r = await client.get(
                    f"{API_URL}/api/documents/{arguments['document_id']}",
                    headers=_headers(),
                )
                r.raise_for_status()
                return [TextContent(type="text", text=json.dumps(r.json(), indent=2))]

            elif name == "docmd_convert":
                r = await client.post(
                    f"{API_URL}/api/documents/{arguments['document_id']}/convert",
                    headers=_headers(),
                    json={
                        "template_id": arguments["template_id"],
                        "mapping_id": arguments["mapping_id"],
                    },
                )
                r.raise_for_status()
                return [TextContent(type="text", text=json.dumps(r.json(), indent=2))]

            elif name == "docmd_classify":
                body: dict = {
                    "markdown": arguments["markdown"],
                    "mode": "suggest",
                }
                if arguments.get("project_id"):
                    body["project_id"] = arguments["project_id"]
                r = await client.post(
                    f"{API_URL}/api/agent/classify",
                    headers=_headers(),
                    json=body,
                )
                r.raise_for_status()
                return [TextContent(type="text", text=json.dumps(r.json(), indent=2))]

            else:
                return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except httpx.HTTPStatusError as e:
        body = e.response.text
        return [TextContent(type="text", text=f"API error {e.response.status_code}: {body}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
