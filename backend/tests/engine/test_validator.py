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
