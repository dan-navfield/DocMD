"""Document classifier using configured LLM provider."""
from __future__ import annotations


# The classification logic lives in the provider implementations.
# This module is reserved for any shared classification utilities
# like doc type normalization or confidence thresholds.

DOC_TYPES = [
    "Architecture Decision Record",
    "Architecture Document",
    "Requirements Document",
    "Test Plan",
    "API Specification",
    "Runbook",
    "Design Document",
    "User Guide",
    "Release Notes",
    "Meeting Notes",
    "Technical Specification",
    "Deployment Guide",
    "Security Review",
    "General",
]


def normalize_doc_type(doc_type: str) -> str:
    """Normalize a doc type string to a known type."""
    doc_type_lower = doc_type.lower().strip()
    for known_type in DOC_TYPES:
        if known_type.lower() in doc_type_lower or doc_type_lower in known_type.lower():
            return known_type
    return doc_type
