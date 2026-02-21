"""Core conversion engine: Markdown + Template + Mapping → Word document."""
from __future__ import annotations

import io
from typing import Any

from docx import Document
from docx.shared import Pt, Inches
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH

from app.engine.parser import parse_markdown
from app.engine.template_reader import extract_styles
from app.engine.validator import validate_mapping, check_unmapped_elements


class MarkdownToWordConverter:
    """Converts Markdown to a styled Word document using mapping rules."""

    def convert(
        self,
        markdown_text: str,
        template_bytes: bytes,
        mapping_rules: dict,
    ) -> tuple[bytes, dict]:
        """
        Convert Markdown text to a Word document.

        Returns:
            tuple of (docx_bytes, conversion_report)
        """
        # Parse markdown to AST
        ast = parse_markdown(markdown_text)

        # Load template
        doc = Document(io.BytesIO(template_bytes))
        available_styles = extract_styles(template_bytes)

        # Validate mapping against template
        style_warnings = validate_mapping(mapping_rules, available_styles)
        unmapped_warnings = check_unmapped_elements(ast, mapping_rules)

        # Clear template body (keep styles)
        for element in doc.element.body[:]:
            doc.element.body.remove(element)

        # Stats tracking
        stats = {
            "headings": 0,
            "paragraphs": 0,
            "lists": 0,
            "tables": 0,
            "code_blocks": 0,
            "images": 0,
        }

        # Walk AST and build document
        for node in ast:
            self._process_node(doc, node, mapping_rules, stats, level=0)

        # Generate output bytes
        output = io.BytesIO()
        doc.save(output)
        docx_bytes = output.getvalue()

        # Build report
        all_warnings = style_warnings + unmapped_warnings
        report = {
            "elements_processed": sum(stats.values()),
            "warnings": all_warnings,
            "warnings_text": [
                f"{w['type']}: {w.get('style', w.get('element', ''))}"
                for w in all_warnings
            ],
            "stats": stats,
        }

        return docx_bytes, report

    def _process_node(
        self,
        doc: Document,
        node: dict,
        rules: dict,
        stats: dict,
        level: int = 0,
    ):
        """Process a single AST node and add it to the document."""
        node_type = node.get("type", "")

        if node_type == "heading":
            self._add_heading(doc, node, rules, stats)
        elif node_type == "paragraph":
            self._add_paragraph(doc, node, rules, stats)
        elif node_type == "list":
            self._add_list(doc, node, rules, stats, level)
        elif node_type == "code_block":
            self._add_code_block(doc, node, rules, stats)
        elif node_type == "blockquote":
            self._add_blockquote(doc, node, rules, stats)
        elif node_type == "table":
            self._add_table(doc, node, rules, stats)
        elif node_type == "thematic_break":
            self._add_page_break(doc)

    def _add_heading(self, doc: Document, node: dict, rules: dict, stats: dict):
        heading_level = node.get("level", 1)
        heading_rules = rules.get("heading", {})

        # Check for page break before this heading level
        page_break_before = rules.get("page_break_before", [])
        if f"heading.{heading_level}" in page_break_before:
            self._add_page_break(doc)

        # Get the style name for this heading level
        if isinstance(heading_rules, dict):
            style_name = heading_rules.get(str(heading_level), f"Heading {heading_level}")
        else:
            style_name = f"Heading {heading_level}"

        para = doc.add_paragraph()
        self._try_set_style(para, style_name)
        self._add_inline_content(para, node.get("children", []))
        stats["headings"] += 1

    def _add_paragraph(self, doc: Document, node: dict, rules: dict, stats: dict):
        style_name = rules.get("paragraph", "Normal")
        para = doc.add_paragraph()
        self._try_set_style(para, style_name)
        self._add_inline_content(para, node.get("children", []))
        stats["paragraphs"] += 1

    def _add_list(self, doc: Document, node: dict, rules: dict, stats: dict, level: int = 0):
        ordered = node.get("ordered", False)

        for item in node.get("items", []):
            # Get style based on list type and nesting level
            if ordered:
                style_keys = ["list_ordered", "list_ordered_2", "list_ordered_3"]
            else:
                style_keys = ["list_bullet", "list_bullet_2", "list_bullet_3"]

            style_key = style_keys[min(level, len(style_keys) - 1)]
            style_name = rules.get(style_key, style_key.replace("_", " ").title())

            # Add the list item text
            for child in item.get("children", []):
                if child.get("type") == "paragraph":
                    para = doc.add_paragraph()
                    self._try_set_style(para, style_name)
                    self._add_inline_content(para, child.get("children", []))

            # Handle nested lists
            for nested_list in item.get("nested_lists", []):
                if nested_list:
                    self._add_list(doc, nested_list, rules, stats, level + 1)

        stats["lists"] += 1

    def _add_code_block(self, doc: Document, node: dict, rules: dict, stats: dict):
        style_name = rules.get("code_block", "Code")
        text = node.get("text", "")

        para = doc.add_paragraph()
        self._try_set_style(para, style_name)
        run = para.add_run(text)
        run.font.name = "Courier New"
        run.font.size = Pt(9)
        stats["code_blocks"] += 1

    def _add_blockquote(self, doc: Document, node: dict, rules: dict, stats: dict):
        style_name = rules.get("blockquote", "Quote")
        for child in node.get("children", []):
            if child.get("type") == "paragraph":
                para = doc.add_paragraph()
                self._try_set_style(para, style_name)
                self._add_inline_content(para, child.get("children", []))

    def _add_table(self, doc: Document, node: dict, rules: dict, stats: dict):
        rows = node.get("rows", [])
        if not rows:
            return

        table_rules = rules.get("table", {})
        num_cols = max(len(row.get("cells", [])) for row in rows)
        num_rows = len(rows)

        table = doc.add_table(rows=num_rows, cols=num_cols)

        # Try to apply table style
        table_style = table_rules.get("style", "Table Grid") if isinstance(table_rules, dict) else "Table Grid"
        try:
            table.style = table_style
        except (KeyError, ValueError):
            pass

        for i, row in enumerate(rows):
            for j, cell_text in enumerate(row.get("cells", [])):
                if j < num_cols:
                    cell = table.rows[i].cells[j]
                    cell.text = cell_text
                    # Bold header rows
                    if row.get("is_header"):
                        for paragraph in cell.paragraphs:
                            for run in paragraph.runs:
                                run.bold = True

        stats["tables"] += 1

    def _add_page_break(self, doc: Document):
        para = doc.add_paragraph()
        run = para.add_run()
        run.add_break(docx_break_type=7)  # PAGE break

    def _add_inline_content(self, para, children: list[dict]):
        """Add inline content (text, bold, italic, code, links) to a paragraph."""
        for child in children:
            child_type = child.get("type", "")

            if child_type == "text":
                para.add_run(child.get("text", ""))

            elif child_type == "strong":
                for sub in child.get("children", []):
                    run = para.add_run(sub.get("text", ""))
                    run.bold = True

            elif child_type == "emphasis":
                for sub in child.get("children", []):
                    run = para.add_run(sub.get("text", ""))
                    run.italic = True

            elif child_type == "code_span":
                run = para.add_run(child.get("text", ""))
                run.font.name = "Courier New"
                run.font.size = Pt(9)

            elif child_type == "link":
                url = child.get("url", "")
                link_text = "".join(
                    sub.get("text", "") for sub in child.get("children", [])
                )
                run = para.add_run(link_text)
                run.underline = True
                # Add hyperlink (simplified - full hyperlink requires XML manipulation)
                run.font.color.rgb = None  # Will use theme color

            elif child_type == "image":
                # Images would need to be downloaded and inserted
                alt = child.get("alt", "Image")
                para.add_run(f"[{alt}]")

            elif child_type == "linebreak":
                para.add_run().add_break()

    def _try_set_style(self, para, style_name: str):
        """Try to set a paragraph style, falling back to Normal if not found."""
        try:
            para.style = style_name
        except (KeyError, ValueError):
            try:
                para.style = "Normal"
            except (KeyError, ValueError):
                pass
