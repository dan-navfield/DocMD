"""Validate mapping rules against Word template styles."""
from __future__ import annotations


def validate_mapping(mapping_rules: dict, available_styles: list[str]) -> list[dict]:
    """
    Check that all styles referenced in mapping rules exist in the template.
    Returns a list of warning dicts.
    """
    warnings = []
    style_set = set(available_styles)

    # Check heading styles
    headings = mapping_rules.get("heading", {})
    if isinstance(headings, dict):
        for level, style_name in headings.items():
            if style_name not in style_set:
                warnings.append({
                    "type": "missing_style",
                    "style": style_name,
                    "mapped_from": f"heading.{level}",
                })

    # Check simple style mappings
    simple_keys = [
        "paragraph", "list_bullet", "list_bullet_2", "list_bullet_3",
        "list_ordered", "list_ordered_2", "list_ordered_3",
        "code_block", "blockquote",
    ]
    for key in simple_keys:
        style_name = mapping_rules.get(key)
        if style_name and style_name not in style_set:
            warnings.append({
                "type": "missing_style",
                "style": style_name,
                "mapped_from": key,
            })

    # Check table style
    table = mapping_rules.get("table", {})
    if isinstance(table, dict):
        table_style = table.get("style")
        if table_style and table_style not in style_set:
            warnings.append({
                "type": "missing_style",
                "style": table_style,
                "mapped_from": "table.style",
            })

    return warnings


def check_unmapped_elements(ast_nodes: list[dict], mapping_rules: dict) -> list[dict]:
    """Check for AST elements that have no mapping rule."""
    warnings = []
    mapped_types = set()

    if mapping_rules.get("heading"):
        mapped_types.add("heading")
    if mapping_rules.get("paragraph"):
        mapped_types.add("paragraph")
    if mapping_rules.get("list_bullet") or mapping_rules.get("list_ordered"):
        mapped_types.add("list")
    if mapping_rules.get("code_block"):
        mapped_types.add("code_block")
    if mapping_rules.get("blockquote"):
        mapped_types.add("blockquote")
    if mapping_rules.get("table"):
        mapped_types.add("table")

    for node in ast_nodes:
        node_type = node.get("type", "")
        if node_type and node_type not in mapped_types and node_type not in ("thematic_break", "html_block"):
            warnings.append({
                "type": "unmapped_element",
                "element": node_type,
            })

    return warnings
