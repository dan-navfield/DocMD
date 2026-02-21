from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

from app.models.agent import AgentMode
from app.services.audit_service import AuditService


class AgentService:
    def __init__(self, supabase):
        self.supabase = supabase
        self.audit = AuditService(supabase)

    async def _get_llm_provider(self, user_id: str):
        settings = (
            self.supabase.table("user_settings")
            .select("llm_provider, llm_api_key_encrypted")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if not settings.data or not settings.data.get("llm_api_key_encrypted"):
            raise HTTPException(status_code=400, detail="LLM API key not configured. Go to Settings to add one.")

        provider_name = settings.data.get("llm_provider", "anthropic")
        api_key = settings.data["llm_api_key_encrypted"]  # TODO: decrypt

        if provider_name == "anthropic":
            from app.agent.providers.anthropic import AnthropicProvider
            return AnthropicProvider(api_key)
        elif provider_name == "openai":
            from app.agent.providers.openai import OpenAIProvider
            return OpenAIProvider(api_key)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown LLM provider: {provider_name}")

    async def _get_project_context(self, project_id: Optional[str]) -> dict:
        context = {"templates": [], "mappings": [], "folder_structure": []}

        # Get available templates
        templates = self.supabase.table("templates").select("id, name, description").execute()
        context["templates"] = templates.data

        # Get available mappings
        mappings = self.supabase.table("mappings").select("id, name, template_id").execute()
        context["mappings"] = mappings.data

        if project_id:
            project = self.supabase.table("projects").select("*").eq("id", project_id).maybe_single().execute()
            if project.data:
                context["project"] = project.data
                context["naming_rules"] = project.data.get("naming_rules", {})

        return context

    async def classify(
        self,
        markdown: str,
        project_id: Optional[str],
        mode: AgentMode,
        user_id: str,
    ) -> dict:
        provider = await self._get_llm_provider(user_id)
        context = await self._get_project_context(project_id)

        result = await provider.classify(markdown, context)

        await self.audit.log(
            user_id, "agent.classified", "document", None,
            {"doc_type": result.get("doc_type"), "mode": mode.value},
        )

        if mode == AgentMode.auto:
            # Execute the full pipeline
            actions = await self._execute_pipeline(result, markdown, project_id, user_id)
            result["actions_taken"] = actions

        return result

    async def organize(
        self,
        project_id: str,
        document_types: list[str],
        user_id: str,
    ) -> dict:
        provider = await self._get_llm_provider(user_id)
        context = await self._get_project_context(project_id)

        result = await provider.organize(document_types, context)

        await self.audit.log(user_id, "agent.organized", "project", project_id)
        return result

    async def _execute_pipeline(
        self,
        classification: dict,
        markdown: str,
        project_id: Optional[str],
        user_id: str,
    ) -> list[dict]:
        actions = []

        # Create document
        from app.services.document_service import DocumentService
        doc_service = DocumentService(self.supabase)
        doc = await doc_service.create_document(
            user_id=user_id,
            title=classification.get("recommended_filename", "Untitled"),
            project_id=project_id,
            doc_type=classification.get("doc_type", ""),
            tags=[],
            markdown_text=markdown,
        )
        actions.append({"action": "document.created", "id": doc["id"]})

        # Convert if we have template and mapping recommendations
        if classification.get("recommended_template_id") and classification.get("recommended_mapping_id"):
            from app.services.conversion_service import ConversionService
            conv_service = ConversionService(self.supabase)
            conversion = await conv_service.convert_document(
                document_id=doc["id"],
                template_id=classification["recommended_template_id"],
                mapping_id=classification["recommended_mapping_id"],
                user_id=user_id,
            )
            actions.append({"action": "conversion.completed", "id": conversion["id"]})

        return actions
