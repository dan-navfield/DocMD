"""Anthropic (Claude) LLM provider."""
from __future__ import annotations

import json

import anthropic

from app.agent.providers.base import (
    CLASSIFY_SYSTEM_PROMPT,
    ORGANIZE_SYSTEM_PROMPT,
    build_classify_prompt,
    build_organize_prompt,
)


class AnthropicProvider:
    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)

    async def classify(self, content: str, context: dict) -> dict:
        prompt = build_classify_prompt(content, context)

        message = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=CLASSIFY_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text
        return self._parse_json_response(response_text)

    async def organize(self, document_types: list[str], context: dict) -> dict:
        prompt = build_organize_prompt(document_types, context)

        message = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=ORGANIZE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text
        return self._parse_json_response(response_text)

    def _parse_json_response(self, text: str) -> dict:
        # Try to extract JSON from the response
        text = text.strip()
        # Handle markdown code blocks
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1])
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON in the response
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
            return {"doc_type": "Unknown", "confidence": 0.0}
