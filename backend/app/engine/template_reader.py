"""Read Word template files and extract available styles."""
from __future__ import annotations

import io

from docx import Document


def extract_styles(file_bytes: bytes) -> list[str]:
    """Extract all paragraph and character style names from a .docx template."""
    doc = Document(io.BytesIO(file_bytes))
    styles = []
    for style in doc.styles:
        if style.type in (1, 2):  # 1=paragraph, 2=character
            if style.name and not style.name.startswith("_"):
                styles.append(style.name)
    return sorted(set(styles))


def validate_styles(file_bytes: bytes, required_styles: list[str]) -> dict:
    """Check which required styles exist in the template."""
    available = set(extract_styles(file_bytes))
    found = []
    missing = []
    for style in required_styles:
        if style in available:
            found.append(style)
        else:
            missing.append(style)
    return {"found": found, "missing": missing}
