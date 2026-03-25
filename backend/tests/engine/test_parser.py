"""Tests for the Markdown → AST parser."""
from app.engine.parser import parse_markdown


class TestHeadings:
    def test_h1(self):
        ast = parse_markdown("# Hello")
        assert len(ast) == 1
        assert ast[0]["type"] == "heading"
        assert ast[0]["level"] == 1
        assert ast[0]["children"][0]["text"] == "Hello"

    def test_h2_through_h6(self):
        for level in range(2, 7):
            md = "#" * level + " Title"
            ast = parse_markdown(md)
            assert ast[0]["level"] == level

    def test_heading_with_inline_formatting(self):
        ast = parse_markdown("# Hello **world**")
        children = ast[0]["children"]
        assert children[0]["type"] == "text"
        assert children[0]["text"] == "Hello "
        assert children[1]["type"] == "strong"


class TestParagraphs:
    def test_simple_paragraph(self):
        ast = parse_markdown("Hello world")
        assert len(ast) == 1
        assert ast[0]["type"] == "paragraph"
        assert ast[0]["children"][0]["text"] == "Hello world"

    def test_multiple_paragraphs(self):
        ast = parse_markdown("First\n\nSecond")
        assert len(ast) == 2
        assert ast[0]["type"] == "paragraph"
        assert ast[1]["type"] == "paragraph"


class TestInlineFormatting:
    def test_bold(self):
        ast = parse_markdown("**bold text**")
        inline = ast[0]["children"]
        assert inline[0]["type"] == "strong"
        assert inline[0]["children"][0]["text"] == "bold text"

    def test_italic(self):
        ast = parse_markdown("*italic text*")
        inline = ast[0]["children"]
        assert inline[0]["type"] == "emphasis"
        assert inline[0]["children"][0]["text"] == "italic text"

    def test_inline_code(self):
        ast = parse_markdown("`code`")
        inline = ast[0]["children"]
        assert inline[0]["type"] == "code_span"
        assert inline[0]["text"] == "code"

    def test_link(self):
        ast = parse_markdown("[click](https://example.com)")
        inline = ast[0]["children"]
        assert inline[0]["type"] == "link"
        assert inline[0]["url"] == "https://example.com"
        assert inline[0]["children"][0]["text"] == "click"

    def test_image(self):
        ast = parse_markdown("![alt](https://example.com/img.png)")
        inline = ast[0]["children"]
        assert inline[0]["type"] == "image"
        assert inline[0]["alt"] == "alt"


class TestLists:
    def test_unordered_list(self):
        ast = parse_markdown("- item 1\n- item 2")
        assert ast[0]["type"] == "list"
        assert ast[0]["ordered"] is False
        assert len(ast[0]["items"]) == 2

    def test_ordered_list(self):
        ast = parse_markdown("1. first\n2. second")
        assert ast[0]["type"] == "list"
        assert ast[0]["ordered"] is True
        assert len(ast[0]["items"]) == 2

    def test_nested_list(self):
        md = "- parent\n  - child\n    - grandchild"
        ast = parse_markdown(md)
        items = ast[0]["items"]
        assert len(items[0]["nested_lists"]) >= 1

    def test_list_item_has_paragraph_children(self):
        ast = parse_markdown("- item text")
        item = ast[0]["items"][0]
        assert item["children"][0]["type"] == "paragraph"


class TestCodeBlocks:
    def test_code_block(self):
        md = "```python\nprint('hello')\n```"
        ast = parse_markdown(md)
        assert ast[0]["type"] == "code_block"
        assert ast[0]["language"] == "python"
        assert "print('hello')" in ast[0]["text"]

    def test_code_block_no_language(self):
        md = "```\nsome code\n```"
        ast = parse_markdown(md)
        assert ast[0]["type"] == "code_block"
        assert ast[0]["language"] == ""


class TestTables:
    def test_simple_table(self):
        md = "| A | B |\n|---|---|\n| 1 | 2 |"
        ast = parse_markdown(md)
        assert ast[0]["type"] == "table"
        rows = ast[0]["rows"]
        assert len(rows) == 2
        assert rows[0]["is_header"] is True
        # Cells are now lists of inline nodes
        cell_a = rows[0]["cells"][0]
        assert isinstance(cell_a, list)
        assert cell_a[0]["type"] == "text"
        assert cell_a[0]["text"] == "A"


class TestTableCellFormatting:
    def test_bold_in_cell(self):
        md = "| **bold** | normal |\n|---|---|\n| a | b |"
        ast = parse_markdown(md)
        header_cells = ast[0]["rows"][0]["cells"]
        first_cell = header_cells[0]
        assert isinstance(first_cell, list)
        assert any(n.get("type") == "strong" for n in first_cell)


class TestBlockquotes:
    def test_blockquote(self):
        ast = parse_markdown("> quoted text")
        assert ast[0]["type"] == "blockquote"
        assert ast[0]["children"][0]["type"] == "paragraph"

    def test_nested_blockquote(self):
        ast = parse_markdown("> outer\n>> inner")
        assert ast[0]["type"] == "blockquote"


class TestThematicBreak:
    def test_horizontal_rule(self):
        ast = parse_markdown("---")
        assert ast[0]["type"] == "thematic_break"


class TestEdgeCases:
    def test_empty_string(self):
        ast = parse_markdown("")
        assert ast == []

    def test_whitespace_only(self):
        ast = parse_markdown("   \n\n   ")
        assert ast == []

    def test_mixed_content(self):
        md = "# Title\n\nParagraph\n\n- list\n\n```\ncode\n```"
        ast = parse_markdown(md)
        types = [n["type"] for n in ast]
        assert types == ["heading", "paragraph", "list", "code_block"]
