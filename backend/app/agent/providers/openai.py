"""OpenAI LLM provider."""
from __future__ import annotations

import json

import openai

from app.agent.providers.base import (
    CLASSIFY_SYSTEM_PROMPT,
    ORGANIZE_SYSTEM_PROMPT,
    build_classify_prompt,
    build_organize_prompt,
)


class OpenAIProvider:
    def __init__(self, api_key: str):
        self.client = openai.OpenAI(api_key=api_key)

    async def classify(self, content: str, context: dict) -> dict:
        prompt = build_classify_prompt(content, context)

        response = self.client.chat.completions.create(
            model="gpt-4o",
            max_tokens=1024,
            messages=[
                {"role": "system", "content": CLASSIFY_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )

        response_text = response.choices[0].message.content
        return self._parse_json_response(response_text)

    async def organize(self, document_types: list[str], context: dict) -> dict:
        prompt = build_organize_prompt(document_types, context)

        response = self.client.chat.completions.create(
            model="gpt-4o",
            max_tokens=1024,
            messages=[
                {"role": "system", "content": ORGANIZE_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )

        response_text = response.choices[0].message.content
        return self._parse_json_response(response_text)

    def _parse_json_response(self, text: str) -> dict:
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1])
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
            return {"doc_type": "Unknown", "confidence": 0.0}
