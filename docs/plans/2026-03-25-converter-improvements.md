# Converter Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the 4 highest-impact conversion issues: clickable hyperlinks, TOC generation, table cell formatting, and image insertion.

**Architecture:** All changes are in `backend/app/engine/converter.py` — adding/replacing methods in the existing `MarkdownToWordConverter` class. Each feature adds a helper method and updates `_add_inline_content` or `_add_table`. Tests use the existing programmatic template fixtures.

**Tech Stack:** python-docx, OxmlElement XML manipulation for hyperlinks/TOC, httpx for image downloads

---

### Task 1: Clickable hyperlinks

Links currently render as underlined text with no actual URL. Fix by using Word's `w:hyperlink` XML element with an OPC relationship.

**Files:**
- Modify: `backend/app/engine/converter.py`
- Test: `backend/tests/engine/test_converter.py`

**Step 1: Write the failing test**

Add to `test_converter.py`:

```python
class TestHyperlinks:
    def test_link_is_clickable(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "Visit [Example](https://example.com) for info"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        doc = Document(io.BytesIO(docx_bytes))
        # Find hyperlink elements in the XML
        from docx.oxml.ns import qn
        hyperlinks = []
        for para in doc.paragraphs:
            for elem in para._p:
                if elem.tag == qn("w:hyperlink"):
                    hyperlinks.append(elem)
        assert len(hyperlinks) >= 1, "No w:hyperlink element found in document"
        # Verify the hyperlink has a relationship ID
        r_id = hyperlinks[0].get(qn("r:id"))
        assert r_id is not None, "Hyperlink missing r:id relationship"

    def test_link_text_preserved(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "Click [here](https://example.com)"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        paras = read_docx_paragraphs(docx_bytes)
        texts = [p["text"] for p in paras]
        assert any("here" in t for t in texts)

    def test_multiple_links_in_paragraph(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "See [A](https://a.com) and [B](https://b.com)"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        doc = Document(io.BytesIO(docx_bytes))
        from docx.oxml.ns import qn
        hyperlinks = []
        for para in doc.paragraphs:
            for elem in para._p:
                if elem.tag == qn("w:hyperlink"):
                    hyperlinks.append(elem)
        assert len(hyperlinks) >= 2
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/engine/test_converter.py::TestHyperlinks -v`
Expected: FAIL (no w:hyperlink elements found)

**Step 3: Implement hyperlinks in converter.py**

Add this helper method to `MarkdownToWordConverter`:

```python
def _add_hyperlink(self, para, url: str, text: str):
    """Add a clickable hyperlink to a paragraph using XML manipulation."""
    from docx.opc.constants import RELATIONSHIP_TYPE as RT

    part = para.part
    r_id = part.relate_to(url, RT.HYPERLINK, is_external=True)

    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), r_id)
    hyperlink.set(qn("w:history"), "1")

    new_run = OxmlElement("w:r")
    rPr = OxmlElement("w:rPr")

    # Apply Hyperlink character style if available
    rStyle = OxmlElement("w:rStyle")
    rStyle.set(qn("w:val"), "Hyperlink")
    rPr.append(rStyle)

    # Blue color + underline
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "0563C1")
    color.set(qn("w:themeColor"), "hyperlink")
    rPr.append(color)

    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    rPr.append(underline)

    new_run.append(rPr)

    run_text = OxmlElement("w:t")
    run_text.set(qn("xml:space"), "preserve")
    run_text.text = text
    new_run.append(run_text)

    hyperlink.append(new_run)
    para._p.append(hyperlink)
```

Then update the `link` case in `_add_inline_content` (replace lines 513-521):

```python
elif child_type == "link":
    url = child.get("url", "")
    link_text = self._extract_plain_text(child.get("children", []))
    self._add_hyperlink(para, url, link_text)
```

**Step 4: Run tests**

Run: `cd backend && pytest tests/engine/test_converter.py::TestHyperlinks -v`
Expected: ALL PASS

**Step 5: Run full suite to check for regressions**

Run: `cd backend && pytest tests/engine/ -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add backend/app/engine/converter.py backend/tests/engine/test_converter.py
git commit -m "feat: add clickable hyperlinks to Word output (XML workaround)"
```

---

### Task 2: Table of Contents generation

Insert a TOC field code that Word populates on open. Add `updateFields` to document settings so Word prompts to update on open.

**Files:**
- Modify: `backend/app/engine/converter.py`
- Test: `backend/tests/engine/test_converter.py`

**Step 1: Write the failing test**

Add to `test_converter.py`:

```python
class TestTableOfContents:
    def test_toc_inserted_when_mapping_enabled(self, converter, simple_template_bytes, basic_mapping_rules):
        rules = {**basic_mapping_rules, "toc": True}
        md = "# Chapter 1\n\nContent\n\n## Section 1.1\n\nMore"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, rules)
        doc = Document(io.BytesIO(docx_bytes))
        # Look for TOC field code in XML
        from docx.oxml.ns import qn
        body_xml = doc.element.body.xml
        assert "TOC" in body_xml, "No TOC field code found in document body"
        assert "fldChar" in body_xml, "No field character elements found"

    def test_toc_not_inserted_when_disabled(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "# Chapter 1\n\nContent"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        doc = Document(io.BytesIO(docx_bytes))
        body_xml = doc.element.body.xml
        assert "TOC" not in body_xml

    def test_toc_update_fields_set(self, converter, simple_template_bytes, basic_mapping_rules):
        rules = {**basic_mapping_rules, "toc": True}
        md = "# Title\n\n## Section"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, rules)
        doc = Document(io.BytesIO(docx_bytes))
        settings_xml = doc.settings.element.xml
        assert "updateFields" in settings_xml
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/engine/test_converter.py::TestTableOfContents -v`
Expected: FAIL

**Step 3: Implement TOC in converter.py**

Add this method to `MarkdownToWordConverter`:

```python
def _insert_toc(self, doc: Document, levels: str = "1-3"):
    """Insert a Table of Contents field code and set updateFields."""
    para = doc.add_paragraph()
    self._try_set_style(doc, para, "TOC Heading")

    # Add "Contents" title run
    title_run = para.add_run("Contents")
    title_run.bold = True

    # TOC field paragraph
    toc_para = doc.add_paragraph()
    run = toc_para.add_run()
    r_elem = run._r

    # Begin field
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    r_elem.append(fld_begin)

    # Field instruction
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = f' TOC \\o "{levels}" \\h \\z \\u '
    r_elem.append(instr)

    # Separate
    fld_sep = OxmlElement("w:fldChar")
    fld_sep.set(qn("w:fldCharType"), "separate")
    r_elem.append(fld_sep)

    # Placeholder text
    placeholder = OxmlElement("w:t")
    placeholder.text = "Update this table of contents (right-click > Update Field)"
    r_elem.append(placeholder)

    # End field
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    r_elem.append(fld_end)

    # Add page break after TOC
    toc_break = doc.add_paragraph()
    toc_break.add_run().add_break(WD_BREAK.PAGE)

    # Set updateFields in document settings so Word updates TOC on open
    settings_elm = doc.settings.element
    update_fields = OxmlElement("w:updateFields")
    update_fields.set(qn("w:val"), "true")
    settings_elm.append(update_fields)
```

Then add the TOC call in the `convert` method, after `_update_cover_metadata` and before the AST walk loop. Insert around line 69 (before stats tracking):

```python
# Insert TOC if enabled in mapping rules
if mapping_rules.get("toc"):
    self._insert_toc(doc)
```

**Step 4: Run tests**

Run: `cd backend && pytest tests/engine/test_converter.py::TestTableOfContents -v`
Expected: ALL PASS

**Step 5: Run full suite**

Run: `cd backend && pytest tests/engine/ -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add backend/app/engine/converter.py backend/tests/engine/test_converter.py
git commit -m "feat: add Table of Contents field generation with auto-update"
```

---

### Task 3: Table cell formatting (inline markdown in cells)

Currently table cells are plain text — bold, italic, code, and links inside cells are lost. Fix by changing the parser to preserve inline AST in cells, and the converter to render it.

**Files:**
- Modify: `backend/app/engine/parser.py`
- Modify: `backend/app/engine/converter.py`
- Test: `backend/tests/engine/test_parser.py`
- Test: `backend/tests/engine/test_converter.py`

**Step 1: Write failing parser test**

Add to `test_parser.py`:

```python
class TestTableCellFormatting:
    def test_table_cells_preserve_inline(self):
        md = "| **bold** | `code` |\n|---|---|\n| [link](https://x.com) | *italic* |"
        ast = parse_markdown(md)
        rows = ast[0]["rows"]
        # Header cells should have inline children, not plain text
        assert isinstance(rows[0]["cells"][0], list), "Cell should be a list of inline nodes"

    def test_plain_text_cells_still_work(self):
        md = "| A | B |\n|---|---|\n| 1 | 2 |"
        ast = parse_markdown(md)
        rows = ast[0]["rows"]
        # Plain text cells should still be extractable
        cell = rows[0]["cells"][0]
        if isinstance(cell, list):
            # New format: list of inline nodes
            text = "".join(n.get("text", "") for n in cell if n.get("type") == "text")
            assert text == "A"
        else:
            assert cell == "A"
```

**Step 2: Update parser to preserve inline content in table cells**

In `parser.py`, modify `_normalize_table` to store inline AST instead of plain text:

Replace the current `_normalize_table` function with:

```python
def _normalize_table(node: dict) -> dict:
    """Normalize a table node, preserving inline formatting in cells."""
    rows = []
    for child in node.get("children", []):
        if child.get("type") == "table_head":
            cells = []
            for cell in child.get("children", []):
                cells.append(_extract_inline(cell.get("children", [])))
            rows.append({
                "type": "table_row",
                "cells": cells,
                "is_header": True,
            })
        elif child.get("type") == "table_body":
            for row in child.get("children", []):
                cells = []
                for cell in row.get("children", []):
                    cells.append(_extract_inline(cell.get("children", [])))
                rows.append({
                    "type": "table_row",
                    "cells": cells,
                    "is_header": False,
                })
    return {
        "type": "table",
        "rows": rows,
    }
```

**Step 3: Update existing parser table test**

The existing `TestTables::test_simple_table` asserts `rows[0]["cells"] == ["A", "B"]` (plain strings). Update it to handle the new inline format:

```python
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
```

**Step 4: Update converter `_add_table` to render inline content**

Replace the table cell rendering in `_add_table` (the inner loop at lines 472-481):

```python
for i, row in enumerate(rows):
    for j, cell_content in enumerate(row.get("cells", [])):
        if j < num_cols:
            cell = table.rows[i].cells[j]
            # Clear default paragraph
            cell.text = ""
            para = cell.paragraphs[0]
            if isinstance(cell_content, list):
                # Rich inline content
                self._add_inline_content(para, cell_content)
            else:
                # Plain text fallback
                para.add_run(str(cell_content))
            # Bold header rows
            if row.get("is_header"):
                for run in para.runs:
                    run.bold = True
```

**Step 5: Write converter test for rich table cells**

Add to `test_converter.py`:

```python
class TestTableCellFormatting:
    def test_bold_in_table_cell(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "| **bold** | normal |\n|---|---|\n| a | b |"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        doc = Document(io.BytesIO(docx_bytes))
        for table in doc.tables:
            cell = table.rows[0].cells[0]
            bold_runs = [r for r in cell.paragraphs[0].runs if r.bold]
            assert len(bold_runs) > 0, "Expected bold run in header cell"
            return
        pytest.fail("No table found")

    def test_link_in_table_cell(self, converter, simple_template_bytes, basic_mapping_rules):
        md = "| [link](https://x.com) |\n|---|\n| data |"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        doc = Document(io.BytesIO(docx_bytes))
        from docx.oxml.ns import qn
        for table in doc.tables:
            cell_xml = table.rows[0].cells[0]._tc.xml
            assert "hyperlink" in cell_xml, "Expected hyperlink in table cell"
            return
        pytest.fail("No table found")
```

**Step 6: Run all tests**

Run: `cd backend && pytest tests/engine/ -v`
Expected: ALL PASS (some existing table tests may need minor updates for the new cell format)

**Step 7: Commit**

```bash
git add backend/app/engine/parser.py backend/app/engine/converter.py backend/tests/engine/
git commit -m "feat: preserve inline formatting (bold, links, code) in table cells"
```

---

### Task 4: Image insertion

Replace the `[alt]` placeholder with actual image insertion. For markdown images with URLs, download the image; for local paths, read the file. Use `doc.add_picture()` with explicit width to avoid the 72 DPI default.

**Files:**
- Modify: `backend/app/engine/converter.py`
- Test: `backend/tests/engine/test_converter.py`

**Step 1: Write failing test**

Add to `test_converter.py`:

```python
class TestImageInsertion:
    def test_inline_image_from_bytes(self, converter, simple_template_bytes, basic_mapping_rules):
        """Test that an image node with base64 data creates an actual picture."""
        # Create a tiny 1x1 PNG for testing
        import base64
        tiny_png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4"
            "nGNgYPgPAAEDAQAIicLsAAAAASUVORK5CYII="
        )
        # We'll test via the converter's internal method
        doc = Document(io.BytesIO(simple_template_bytes))
        para = doc.add_paragraph()
        converter._add_image_to_paragraph(para, tiny_png, "test alt", width_inches=2.0)
        # Verify the paragraph has an inline shape
        from docx.oxml.ns import qn
        drawings = para._p.findall(f".//{qn('w:drawing')}")
        assert len(drawings) >= 1, "No drawing element found after image insertion"

    def test_image_placeholder_for_failed_download(self, converter, simple_template_bytes, basic_mapping_rules):
        """If image download fails, should fall back to [alt] text."""
        md = "![broken](https://nonexistent.invalid/img.png)"
        docx_bytes, _ = converter.convert(md, simple_template_bytes, basic_mapping_rules)
        paras = read_docx_paragraphs(docx_bytes)
        texts = [p["text"] for p in paras]
        assert any("broken" in t for t in texts)
```

**Step 2: Implement image insertion**

Add to converter.py imports (top of file):

```python
import httpx
import base64
```

Add these methods to `MarkdownToWordConverter`:

```python
def _add_image_to_paragraph(self, para, image_bytes: bytes, alt: str, width_inches: float = 5.0):
    """Insert image bytes into a paragraph as an inline picture."""
    from docx.shared import Inches
    image_stream = io.BytesIO(image_bytes)
    run = para.add_run()
    run.add_picture(image_stream, width=Inches(width_inches))

def _download_image(self, url: str) -> bytes | None:
    """Download an image from a URL. Returns bytes or None on failure."""
    try:
        with httpx.Client(timeout=10, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if not content_type.startswith("image/"):
                logger.warning("URL %s returned non-image content-type: %s", url, content_type)
                return None
            return resp.content
    except Exception as e:
        logger.warning("Failed to download image %s: %s", url, e)
        return None
```

Then update the `image` case in `_add_inline_content` (replace lines 523-526):

```python
elif child_type == "image":
    url = child.get("url", "")
    alt = child.get("alt", "Image")
    image_bytes = None
    if url.startswith("data:image/"):
        # Base64 data URI
        try:
            _, data = url.split(",", 1)
            image_bytes = base64.b64decode(data)
        except Exception:
            pass
    elif url.startswith(("http://", "https://")):
        image_bytes = self._download_image(url)
    if image_bytes:
        self._add_image_to_paragraph(para, image_bytes, alt)
        stats["images"] += 1
    else:
        para.add_run(f"[{alt}]")
```

Note: the `stats` dict needs to be accessible. Since `_add_inline_content` doesn't currently receive `stats`, we need to either pass it through or store it on `self`. The simplest fix: add `stats` as a parameter to `_add_inline_content` and pass it from all callers.

Update `_add_inline_content` signature:

```python
def _add_inline_content(self, para, children: list[dict], stats: dict | None = None):
```

And all callers already have `stats` available, so pass it:
- `_add_heading`: `self._add_inline_content(para, node.get("children", []), stats)`
- `_add_paragraph`: `self._add_inline_content(para, node.get("children", []), stats)`
- `_add_list`: `self._add_inline_content(para, child.get("children", []), stats)`
- `_add_blockquote`: `self._add_inline_content(para, child.get("children", []), stats)`
- Table cell rendering: `self._add_inline_content(para, cell_content, stats)` (pass stats through `_add_table`)

**Step 3: Run tests**

Run: `cd backend && pytest tests/engine/test_converter.py::TestImageInsertion -v`
Expected: ALL PASS

**Step 4: Run full suite**

Run: `cd backend && pytest tests/engine/ -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/app/engine/converter.py backend/tests/engine/test_converter.py
git commit -m "feat: add real image insertion (download + base64) with fallback placeholder"
```

---

### Task 5: Final full suite + coverage + push

**Step 1: Run full test suite**

Run: `cd backend && pytest tests/ -v --tb=short`
Expected: ALL PASS (111+ tests)

**Step 2: Coverage report**

Run: `cd backend && pytest tests/engine/ --cov=app.engine --cov-report=term-missing`
Expected: Coverage > 87% (should increase with new tests)

**Step 3: Push**

```bash
git push origin main
```
