"""Markdown parser that produces a structured AST for conversion."""
from __future__ import annotations

from typing import Any

import mistune


def parse_markdown(text: str) -> list[dict[str, Any]]:
    """
    Parse Markdown text into a list of AST nodes.
    Each node has a 'type' and type-specific fields.
    """
    md = mistune.create_markdown(renderer='ast', plugins=['table', 'strikethrough', 'task_lists'])
    ast = md(text)
    return _normalize_ast(ast)


def _normalize_ast(nodes: list) -> list[dict]:
    """Normalize mistune AST into a consistent format."""
    result = []
    for node in nodes:
        normalized = _normalize_node(node)
        if normalized:
            result.append(normalized)
    return result


def _normalize_node(node: dict) -> dict | None:
    """Normalize a single AST node."""
    node_type = node.get("type", "")

    if node_type == "heading":
        return {
            "type": "heading",
            "level": node.get("attrs", {}).get("level", 1),
            "children": _extract_inline(node.get("children", [])),
        }

    elif node_type == "paragraph":
        return {
            "type": "paragraph",
            "children": _extract_inline(node.get("children", [])),
        }

    elif node_type == "list":
        ordered = node.get("attrs", {}).get("ordered", False)
        return {
            "type": "list",
            "ordered": ordered,
            "items": [_normalize_list_item(item) for item in node.get("children", [])],
        }

    elif node_type == "block_code":
        return {
            "type": "code_block",
            "language": node.get("attrs", {}).get("info", ""),
            "text": node.get("raw", node.get("text", "")),
        }

    elif node_type == "block_quote":
        return {
            "type": "blockquote",
            "children": _normalize_ast(node.get("children", [])),
        }

    elif node_type == "table":
        return _normalize_table(node)

    elif node_type == "thematic_break":
        return {"type": "thematic_break"}

    elif node_type == "block_html":
        return {
            "type": "html_block",
            "raw": node.get("raw", ""),
        }

    return None


def _normalize_list_item(item: dict) -> dict:
    """Normalize a list item, handling nested lists."""
    children = []
    nested_lists = []

    for child in item.get("children", []):
        if child.get("type") == "list":
            nested_lists.append(_normalize_node(child))
        else:
            normalized = _normalize_node(child)
            if normalized:
                children.append(normalized)

    return {
        "type": "list_item",
        "children": children,
        "nested_lists": nested_lists,
    }


def _normalize_table(node: dict) -> dict:
    """Normalize a table node."""
    rows = []
    for child in node.get("children", []):
        if child.get("type") in ("table_head", "table_body"):
            for row in child.get("children", []):
                cells = []
                for cell in row.get("children", []):
                    cell_text = _extract_text(cell.get("children", []))
                    cells.append(cell_text)
                rows.append({
                    "type": "table_row",
                    "cells": cells,
                    "is_header": child.get("type") == "table_head",
                })
    return {
        "type": "table",
        "rows": rows,
    }


def _extract_inline(children: list) -> list[dict]:
    """Extract inline elements (text, bold, italic, code, links)."""
    result = []
    for child in children:
        child_type = child.get("type", "")

        if child_type == "text":
            result.append({"type": "text", "text": child.get("raw", child.get("text", ""))})

        elif child_type == "codespan":
            result.append({"type": "code_span", "text": child.get("raw", child.get("text", ""))})

        elif child_type == "strong":
            result.append({
                "type": "strong",
                "children": _extract_inline(child.get("children", [])),
            })

        elif child_type == "emphasis":
            result.append({
                "type": "emphasis",
                "children": _extract_inline(child.get("children", [])),
            })

        elif child_type == "link":
            result.append({
                "type": "link",
                "url": child.get("attrs", {}).get("url", child.get("link", "")),
                "children": _extract_inline(child.get("children", [])),
            })

        elif child_type == "image":
            result.append({
                "type": "image",
                "url": child.get("attrs", {}).get("url", child.get("src", "")),
                "alt": child.get("attrs", {}).get("alt", child.get("alt", "")),
            })

        elif child_type == "softbreak":
            result.append({"type": "text", "text": "\n"})

        elif child_type == "linebreak":
            result.append({"type": "linebreak"})

    return result


def _extract_text(children: list) -> str:
    """Extract plain text from inline children."""
    parts = []
    for child in children:
        if child.get("type") == "text":
            parts.append(child.get("raw", child.get("text", "")))
        elif "children" in child:
            parts.append(_extract_text(child["children"]))
        elif "raw" in child:
            parts.append(child["raw"])
    return "".join(parts)
