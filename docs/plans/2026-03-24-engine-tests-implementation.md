# Engine Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build comprehensive test coverage for the conversion engine (parser, converter, template reader, validator) — the highest-value, most bug-prone part of MDDoc.

**Architecture:** pytest-based unit tests with programmatic docx template fixtures plus real template fixtures. Tests are pure functions with zero external dependencies (no DB, no network). Organized by engine module with shared conftest fixtures.

**Tech Stack:** pytest, pytest-asyncio, pytest-cov, python-docx (for building test fixtures)

---

### Task 1: Set up test infrastructure

**Files:**
- Create: `backend/requirements-test.txt`
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py` (already exists, empty)
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/engine/__init__.py`
- Create: `backend/tests/engine/conftest.py`

**Step 1: Create requirements-test.txt**

```
# backend/requirements-test.txt
-r requirements.txt
pytest==8.3.4
pytest-asyncio==0.24.0
pytest-cov==6.0.0
```

**Step 2: Create pytest.ini**

```ini
# backend/pytest.ini
[pytest]
testpaths = tests
asyncio_mode = auto
```

**Step 3: Create tests/conftest.py with shared fixtures**

```python
# backend/tests/conftest.py
"""Shared test fixtures for all test modules."""
import io
import pytest
from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn


WP_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


@pytest.fixture
def simple_template_bytes():
    """Single-section template with basic styles (Normal, Heading 1-3, Code, Quote)."""
    doc = Document()

    # Ensure standard styles exist
    for i in range(1, 4):
        name = f"Heading {i}"
        if name not in [s.name for s in doc.styles]:
            doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)

    for name in ("Code", "Quote", "List Bullet", "List Number"):
        if name not in [s.name for s in doc.styles]:
            doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)

    # Add a placeholder paragraph so the template isn't empty
    doc.add_paragraph("Template placeholder", "Normal")

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


@pytest.fixture
def cover_page_template_bytes():
    """Two-section template: cover page with section break, then body."""
    doc = Document()

    # Add styles
    for name in ("Cover heading", "Cover subtitle"):
        doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
    for i in range(1, 4):
        name = f"Heading {i}"
        if name not in [s.name for s in doc.styles]:
            doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
    for name in ("Code", "Quote", "List Bullet", "List Number"):
        if name not in [s.name for s in doc.styles]:
            doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)

    # Cover page content
    doc.add_paragraph("Document Title", "Cover heading")
    doc.add_paragraph("Subtitle here", "Cover subtitle")

    # Add section break (creates a new section = cover + body)
    doc.add_section()

    # Body placeholder
    doc.add_paragraph("Body placeholder", "Normal")

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


@pytest.fixture
def three_section_template_bytes():
    """Three-section template: cover + body + final page."""
    doc = Document()

    for name in ("Cover heading", "Cover subtitle"):
        doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
    for i in range(1, 4):
        name = f"Heading {i}"
        if name not in [s.name for s in doc.styles]:
            doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
    for name in ("Code", "Quote", "List Bullet", "List Number"):
        if name not in [s.name for s in doc.styles]:
            doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)

    # Cover
    doc.add_paragraph("Title", "Cover heading")
    doc.add_section()

    # Body
    doc.add_paragraph("Body content", "Normal")
    doc.add_section()

    # Final page
    doc.add_paragraph("Appendix", "Normal")

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


@pytest.fixture
def basic_mapping_rules():
    """Mapping rules that match the simple_template_bytes styles."""
    return {
        "heading": {"1": "Heading 1", "2": "Heading 2", "3": "Heading 3"},
        "document_title": "",
        "document_subtitle": "",
        "paragraph": "Normal",
        "list_bullet": "List Bullet",
        "list_bullet_2": "List Bullet",
        "list_bullet_3": "List Bullet",
        "list_ordered": "List Number",
        "list_ordered_2": "List Number",
        "list_ordered_3": "List Number",
        "code_block": "Code",
        "blockquote": "Quote",
        "table": {"style": "Table Grid", "header_row": True},
        "page_break_before": [],
        "metadata_mapping": {},
    }


@pytest.fixture
def cover_page_mapping_rules():
    """Mapping rules for cover page template."""
    return {
        "heading": {"1": "Heading 1", "2": "Heading 2", "3": "Heading 3"},
        "document_title": "Cover heading",
        "document_subtitle": "Cover subtitle",
        "paragraph": "Normal",
        "list_bullet": "List Bullet",
        "list_bullet_2": "List Bullet",
        "list_bullet_3": "List Bullet",
        "list_ordered": "List Number",
        "list_ordered_2": "List Number",
        "list_ordered_3": "List Number",
        "code_block": "Code",
        "blockquote": "Quote",
        "table": {"style": "Table Grid", "header_row": True},
        "page_break_before": [],
        "metadata_mapping": {},
    }


def read_docx_paragraphs(docx_bytes: bytes) -> list[dict]:
    """Helper: read a docx and return list of {text, style} dicts."""
    doc = Document(io.BytesIO(docx_bytes))
    return [
        {"text": p.text, "style": p.style.name if p.style else "Normal"}
        for p in doc.paragraphs
    ]


def read_docx_tables(docx_bytes: bytes) -> list[list[list[str]]]:
    """Helper: read tables from docx as list of rows of cells."""
    doc = Document(io.BytesIO(docx_bytes))
    tables = []
    for table in doc.tables:
        rows = []
        for row in table.rows:
            rows.append([cell.text for cell in row.cells])
        tables.append(rows)
    return tables
```

**Step 4: Create engine test package init files**

```python
# backend/tests/engine/__init__.py
```

```python
# backend/tests/engine/conftest.py
"""Engine-specific test fixtures."""
```

**Step 5: Install test dependencies and verify pytest runs**

Run: `cd backend && pip install -r requirements-test.txt`
Run: `cd backend && pytest --co -q`
Expected: `no tests ran` (collected 0 items — no test files yet)

**Step 6: Commit**

```bash
git add backend/requirements-test.txt backend/pytest.ini backend/tests/
git commit -m "test: add pytest infrastructure and shared template fixtures"
```

---

### Task 2: Parser tests

**Files:**
- Create: `backend/tests/engine/test_parser.py`

**Step 1: Write parser tests**

```python
# backend/tests/engine/test_parser.py
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
        assert len(rows) == 2  # header + 1 data row
        assert rows[0]["is_header"] is True
        assert rows[0]["cells"] == ["A", "B"]
        assert rows[1]["cells"] == ["1", "2"]


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
```

**Step 2: Run tests**

Run: `cd backend && pytest tests/engine/test_parser.py -v`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/tests/engine/test_parser.py
git commit -m "test: add comprehensive parser tests (headings, lists, tables, edge cases)"
```

---

### Task 3: Template reader tests

**Files:**
- Create: `backend/tests/engine/test_template_reader.py`

**Step 1: Write template reader tests**

```python
# backend/tests/engine/test_template_reader.py
"""Tests for Word template style extraction."""
import io
import pytest
from docx import Document
from docx.enum.style import WD_STYLE_TYPE

from app.engine.template_reader import extract_styles, validate_styles, extract_used_styles


class TestExtractStyles:
    def test_extracts_paragraph_styles(self, simple_template_bytes):
        styles = extract_styles(simple_template_bytes)
        assert "Normal" in styles
        assert "Heading 1" in styles

    def test_extracts_custom_styles(self):
        doc = Document()
        doc.styles.add_style("My Custom Style", WD_STYLE_TYPE.PARAGRAPH)
        buf = io.BytesIO()
        doc.save(buf)
        styles = extract_styles(buf.getvalue())
        assert "My Custom Style" in styles

    def test_excludes_internal_styles(self):
        """Styles starting with _ should be excluded."""
        styles = extract_styles(_make_template_with_internal_style())
        assert not any(s.startswith("_") for s in styles)

    def test_returns_sorted_unique(self):
        doc = Document()
        doc.styles.add_style("Zebra", WD_STYLE_TYPE.PARAGRAPH)
        doc.styles.add_style("Alpha", WD_STYLE_TYPE.PARAGRAPH)
        buf = io.BytesIO()
        doc.save(buf)
        styles = extract_styles(buf.getvalue())
        assert styles == sorted(set(styles))

    def test_empty_template(self):
        """A minimal template still has built-in styles."""
        doc = Document()
        buf = io.BytesIO()
        doc.save(buf)
        styles = extract_styles(buf.getvalue())
        assert len(styles) > 0  # Built-in styles like Normal, Heading 1, etc.
        assert "Normal" in styles


class TestValidateStyles:
    def test_all_found(self, simple_template_bytes):
        result = validate_styles(simple_template_bytes, ["Normal", "Heading 1"])
        assert result["found"] == ["Normal", "Heading 1"]
        assert result["missing"] == []

    def test_some_missing(self, simple_template_bytes):
        result = validate_styles(simple_template_bytes, ["Normal", "NonExistent"])
        assert "Normal" in result["found"]
        assert "NonExistent" in result["missing"]

    def test_empty_required(self, simple_template_bytes):
        result = validate_styles(simple_template_bytes, [])
        assert result["found"] == []
        assert result["missing"] == []


class TestExtractUsedStyles:
    def test_returns_styles_applied_to_content(self, simple_template_bytes):
        used = extract_used_styles(simple_template_bytes)
        assert "Normal" in used  # The placeholder paragraph uses Normal

    def test_empty_doc_returns_default(self):
        doc = Document()
        doc.add_paragraph("text")
        buf = io.BytesIO()
        doc.save(buf)
        used = extract_used_styles(buf.getvalue())
        assert "Normal" in used


def _make_template_with_internal_style():
    doc = Document()
    # python-docx won't let us name a style starting with _ easily,
    # but built-in styles like _Normal already exist and should be filtered
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
```

**Step 2: Run tests**

Run: `cd backend && pytest tests/engine/test_template_reader.py -v`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/tests/engine/test_template_reader.py
git commit -m "test: add template reader tests (style extraction, validation)"
```

---

### Task 4: Validator tests

**Files:**
- Create: `backend/tests/engine/test_validator.py`

**Step 1: Write validator tests**

```python
# backend/tests/engine/test_validator.py
"""Tests for mapping rule validation."""
from app.engine.validator import validate_mapping, check_unmapped_elements


class TestValidateMapping:
    def test_no_warnings_when_all_styles_exist(self):
        rules = {
            "heading": {"1": "Heading 1", "2": "Heading 2"},
            "paragraph": "Normal",
            "list_bullet": "List Bullet",
            "code_block": "Code",
            "blockquote": "Quote",
            "table": {"style": "Table Grid"},
        }
        styles = ["Heading 1", "Heading 2", "Normal", "List Bullet", "Code", "Quote", "Table Grid"]
        warnings = validate_mapping(rules, styles)
        assert warnings == []

    def test_warns_on_missing_heading_style(self):
        rules = {"heading": {"1": "NonExistent"}}
        warnings = validate_mapping(rules, ["Normal"])
        assert len(warnings) == 1
        assert warnings[0]["type"] == "missing_style"
        assert warnings[0]["style"] == "NonExistent"
        assert warnings[0]["mapped_from"] == "heading.1"

    def test_warns_on_missing_paragraph_style(self):
        rules = {"paragraph": "Fancy Paragraph"}
        warnings = validate_mapping(rules, ["Normal"])
        assert len(warnings) == 1
        assert warnings[0]["mapped_from"] == "paragraph"

    def test_warns_on_missing_table_style(self):
        rules = {"table": {"style": "Missing Table"}}
        warnings = validate_mapping(rules, ["Normal"])
        assert len(warnings) == 1
        assert warnings[0]["mapped_from"] == "table.style"

    def test_skips_empty_style_names(self):
        rules = {"paragraph": "", "code_block": ""}
        warnings = validate_mapping(rules, ["Normal"])
        assert warnings == []

    def test_multiple_missing_styles(self):
        rules = {
            "heading": {"1": "Missing H1"},
            "paragraph": "Missing P",
            "code_block": "Missing Code",
        }
        warnings = validate_mapping(rules, ["Normal"])
        assert len(warnings) == 3

    def test_empty_rules(self):
        warnings = validate_mapping({}, ["Normal", "Heading 1"])
        assert warnings == []


class TestCheckUnmappedElements:
    def test_no_warnings_when_fully_mapped(self):
        ast = [
            {"type": "heading"},
            {"type": "paragraph"},
            {"type": "list"},
        ]
        rules = {
            "heading": {"1": "H1"},
            "paragraph": "Normal",
            "list_bullet": "LB",
        }
        warnings = check_unmapped_elements(ast, rules)
        assert warnings == []

    def test_warns_on_unmapped_type(self):
        ast = [{"type": "code_block"}]
        rules = {"paragraph": "Normal"}
        warnings = check_unmapped_elements(ast, rules)
        assert len(warnings) == 1
        assert warnings[0]["type"] == "unmapped_element"
        assert warnings[0]["element"] == "code_block"

    def test_thematic_break_never_warned(self):
        ast = [{"type": "thematic_break"}]
        warnings = check_unmapped_elements(ast, {})
        assert warnings == []

    def test_html_block_never_warned(self):
        ast = [{"type": "html_block"}]
        warnings = check_unmapped_elements(ast, {})
        assert warnings == []

    def test_empty_ast(self):
        warnings = check_unmapped_elements([], {"paragraph": "Normal"})
        assert warnings == []

    def test_list_mapped_via_bullet_or_ordered(self):
        ast = [{"type": "list"}]
        rules_bullet = {"list_bullet": "LB"}
        rules_ordered = {"list_ordered": "LO"}
        assert check_unmapped_elements(ast, rules_bullet) == []
        assert check_unmapped_elements(ast, rules_ordered) == []
```

**Step 2: Run tests**

Run: `cd backend && pytest tests/engine/test_validator.py -v`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/tests/engine/test_validator.py
git commit -m "test: add validator tests (mapping validation, unmapped elements)"
```

---

### Task 5: Converter tests — basic conversion

**Files:**
- Create: `backend/tests/engine/test_converter.py`

**Step 1: Write basic converter tests**

```python
# backend/tests/engine/test_converter.py
"""Tests for the Markdown → Word converter."""
import io
import pytest
from docx import Document

from app.engine.converter import MarkdownToWordConverter
from tests.conftest import read_docx_paragraphs, read_docx_tables


@pytest.fixture
def converter():
    return MarkdownToWordConverter()


class TestBasicConversion:
    def test_returns_bytes_and_report(self, converter, simple_template_bytes, basic_mapping_rules):
        docx_bytes, report = converter.convert("# Hello", simple_template_bytes, basic_mapping_rules)
        assert isinstance(docx_bytes, bytes)
        assert len(docx_bytes) > 0
        assert isinstance(report, dict)
        assert "stats" in report
        assert "warnings" in report

    def test_output_is_valid_docx(self, converter, simple_template_bytes, basic_mapping_rules):
        docx_bytes, _ = converter.convert("# Hello\n\nWorld", simple_template_bytes, basic_mapping_rules)
        doc = Document(io.BytesIO(docx_bytes))
        assert len(doc.paragraphs) > 0

    def test_empty_markdown(self, converter, simple_template_bytes, basic_mapping_rules):
        docx_bytes, report = converter.convert("", simple_template_bytes, basic_mapping_rules)
        assert isinstance(docx_bytes, bytes)
        assert report["stats"]["headings"] == 0
        assert report["stats"]["paragraphs"] == 0


class TestHeadingConversion:
    def test_heading_uses_mapped_style(self, converter, simple_template_bytes, basic_mapping_rules):
        docx_bytes, _ = converter.convert("# Title", simple_template_bytes, basic_mapping_rules)
        paras = read_docx_paragraphs(docx_bytes)
        heading_paras = [p for p in paras if "Title" in p["text"]]
        assert len(heading_paras) > 0

    def test_heading_levels_mapped_correctly(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "# H1\n\n## H2\n\n### H3"
        docx_bytes, report = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        assert report["stats"]["headings"] == 3

    def test_heading_stats_counted(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "# One\n\n## Two"
        _, report = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        assert report["stats"]["headings"] == 2


class TestParagraphConversion:
    def test_paragraph_uses_mapped_style(self, converter, simple_template_bytes, basic_mapping_rules):
        docx_bytes, _ = converter.convert("Hello world", simple_template_bytes, basic_mapping_rules)
        paras = read_docx_paragraphs(docx_bytes)
        hello_paras = [p for p in paras if "Hello world" in p["text"]]
        assert len(hello_paras) > 0
        assert hello_paras[0]["style"] == "Normal"

    def test_paragraph_stats_counted(self, converter, simple_template_bytes, basic_mapping_rules):
        _, report = converter.convert("First\n\nSecond", simple_template_bytes, basic_mapping_rules)
        assert report["stats"]["paragraphs"] == 2


class TestListConversion:
    def test_unordered_list(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "- item one\n- item two"
        docx_bytes, report = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        assert report["stats"]["lists"] >= 1
        paras = read_docx_paragraphs(docx_bytes)
        texts = [p["text"] for p in paras]
        assert "item one" in texts
        assert "item two" in texts

    def test_ordered_list(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "1. first\n2. second"
        _, report = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        assert report["stats"]["lists"] >= 1

    def test_nested_list(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "- parent\n  - child"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        paras = read_docx_paragraphs(docx_bytes)
        texts = [p["text"] for p in paras]
        assert "parent" in texts
        assert "child" in texts


class TestCodeBlockConversion:
    def test_code_block_rendered(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "```\nprint('hello')\n```"
        docx_bytes, report = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        assert report["stats"]["code_blocks"] == 1
        paras = read_docx_paragraphs(docx_bytes)
        code_texts = [p["text"] for p in paras if "print" in p["text"]]
        assert len(code_texts) > 0


class TestTableConversion:
    def test_table_rendered(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "| A | B |\n|---|---|\n| 1 | 2 |"
        docx_bytes, report = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        assert report["stats"]["tables"] == 1
        tables = read_docx_tables(docx_bytes)
        assert len(tables) >= 1
        assert tables[-1][0] == ["A", "B"]  # header row
        assert tables[-1][1] == ["1", "2"]  # data row


class TestBlockquoteConversion:
    def test_blockquote_rendered(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "> quoted text"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        paras = read_docx_paragraphs(docx_bytes)
        quoted = [p for p in paras if "quoted text" in p["text"]]
        assert len(quoted) > 0


class TestInlineFormatting:
    def test_bold_text_in_paragraph(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "Hello **bold** world"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        doc = Document(io.BytesIO(docx_bytes))
        # Find the paragraph with "bold"
        for para in doc.paragraphs:
            if "bold" in para.text:
                bold_runs = [r for r in para.runs if r.bold and "bold" in r.text]
                assert len(bold_runs) > 0
                return
        pytest.fail("No paragraph containing 'bold' found")

    def test_italic_text_in_paragraph(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "Hello *italic* world"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        doc = Document(io.BytesIO(docx_bytes))
        for para in doc.paragraphs:
            if "italic" in para.text:
                italic_runs = [r for r in para.runs if r.italic and "italic" in r.text]
                assert len(italic_runs) > 0
                return
        pytest.fail("No paragraph containing 'italic' found")


class TestPageBreaks:
    def test_page_break_before_heading(self, converter, simple_template_bytes, basic_mapping_rules):
        rules = {**basic_mapping_rules, "page_break_before": ["heading.2"]}
        md = "# Title\n\n## Chapter\n\nContent"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, rules)
        # Verify docx is valid (page breaks are hard to assert directly)
        doc = Document(io.BytesIO(docx_bytes))
        assert len(doc.paragraphs) > 0


class TestMissingStyles:
    def test_missing_style_falls_back_gracefully(self, converter, simple_template_bytes):
        rules = {
            "heading": {"1": "NonExistent Style"},
            "paragraph": "Also Missing",
        }
        # Should not raise — falls back to default
        docx_bytes, report = converter.convert("# Title\n\nText", simple_template_bytes, rules)
        assert isinstance(docx_bytes, bytes)
        assert len(report["warnings"]) > 0

    def test_empty_mapping_rules(self, converter, simple_template_bytes):
        docx_bytes, report = converter.convert("# Title\n\nText", simple_template_bytes, {})
        assert isinstance(docx_bytes, bytes)
```

**Step 2: Run tests**

Run: `cd backend && pytest tests/engine/test_converter.py -v`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/tests/engine/test_converter.py
git commit -m "test: add converter tests (elements, styles, tables, inline formatting, edge cases)"
```

---

### Task 6: Converter tests — cover page and multi-section templates

**Files:**
- Modify: `backend/tests/engine/test_converter.py`

**Step 1: Append cover page and multi-section tests**

Add these classes to the end of `test_converter.py`:

```python
class TestCoverPageTemplate:
    def test_cover_title_updated_from_h1(self, converter, cover_page_template_bytes, cover_page_mapping_rules):
        md = "# My Report\n\nContent here"
        docx_bytes, _ = converter.convert(md, cover_page_template_bytes, cover_page_mapping_rules)
        paras = read_docx_paragraphs(docx_bytes)
        cover_titles = [p for p in paras if p["style"] == "Cover heading"]
        assert any("My Report" in p["text"] for p in cover_titles)

    def test_cover_subtitle_cleared_auto_mode(self, converter, cover_page_template_bytes, cover_page_mapping_rules):
        md = "# Title\n\nBody"
        docx_bytes, _ = converter.convert(md, cover_page_template_bytes, cover_page_mapping_rules)
        paras = read_docx_paragraphs(docx_bytes)
        subtitle_paras = [p for p in paras if p["style"] == "Cover subtitle"]
        # Subtitle text should be cleared
        for p in subtitle_paras:
            assert p["text"].strip() == ""

    def test_body_content_after_cover(self, converter, cover_page_template_bytes, cover_page_mapping_rules):
        md = "# Title\n\nBody paragraph"
        docx_bytes, _ = converter.convert(md, cover_page_template_bytes, cover_page_mapping_rules)
        paras = read_docx_paragraphs(docx_bytes)
        body_texts = [p["text"] for p in paras if p["style"] == "Normal"]
        assert "Body paragraph" in body_texts

    def test_h1_not_duplicated_in_body(self, converter, cover_page_template_bytes, cover_page_mapping_rules):
        """When H1 updates cover title, it shouldn't also appear in the body."""
        md = "# Title\n\n## Section\n\nContent"
        docx_bytes, report = converter.convert(md, cover_page_template_bytes, cover_page_mapping_rules)
        paras = read_docx_paragraphs(docx_bytes)
        # Count paragraphs with "Title" text
        title_paras = [p for p in paras if p["text"] == "Title"]
        # Should appear once (cover) not twice
        assert len(title_paras) <= 1


class TestThreeSectionTemplate:
    def test_produces_valid_docx(self, converter, three_section_template_bytes, basic_mapping_rules):
        md = "# Title\n\nBody content\n\n## Section 2\n\nMore content"
        docx_bytes, _ = converter.convert(md, three_section_template_bytes, basic_mapping_rules)
        doc = Document(io.BytesIO(docx_bytes))
        assert len(doc.paragraphs) > 0

    def test_body_content_inserted(self, converter, three_section_template_bytes, basic_mapping_rules):
        md = "# Title\n\nInserted content here"
        docx_bytes, _ = converter.convert(md, three_section_template_bytes, basic_mapping_rules)
        paras = read_docx_paragraphs(docx_bytes)
        texts = [p["text"] for p in paras]
        assert "Inserted content here" in texts


class TestConversionReport:
    def test_report_has_all_stat_keys(self, converter, simple_template_bytes, basic_mapping_rules):
        _, report = converter.convert("# H\n\nP\n\n- L", simple_template_bytes, basic_mapping_rules)
        stats = report["stats"]
        for key in ("headings", "paragraphs", "lists", "tables", "code_blocks", "images"):
            assert key in stats

    def test_report_internal_keys_excluded(self, converter, simple_template_bytes, basic_mapping_rules):
        _, report = converter.convert("# H", simple_template_bytes, basic_mapping_rules)
        stats = report["stats"]
        assert "_first_h1_done" not in stats

    def test_report_warnings_text_format(self, converter, simple_template_bytes):
        rules = {"heading": {"1": "Missing Style"}}
        _, report = converter.convert("# H", simple_template_bytes, rules)
        assert isinstance(report["warnings_text"], list)
        if report["warnings_text"]:
            assert isinstance(report["warnings_text"][0], str)

    def test_elements_processed_is_sum_of_stats(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "# Title\n\nParagraph\n\n- List"
        _, report = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        assert report["elements_processed"] == sum(report["stats"].values())
```

**Step 2: Run all converter tests**

Run: `cd backend && pytest tests/engine/test_converter.py -v`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/tests/engine/test_converter.py
git commit -m "test: add cover page, multi-section, and report tests for converter"
```

---

### Task 7: Run full suite + coverage report

**Step 1: Run full engine test suite**

Run: `cd backend && pytest tests/engine/ -v --tb=short`
Expected: ALL PASS

**Step 2: Generate coverage report**

Run: `cd backend && pytest tests/engine/ --cov=app.engine --cov-report=term-missing`
Expected: Coverage report showing line-by-line coverage for parser.py, converter.py, template_reader.py, validator.py

**Step 3: Commit everything and push**

```bash
git add -A
git commit -m "test: complete engine test suite with coverage"
git push origin main
```

---
