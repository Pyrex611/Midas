from app.agents.llm_router import LLMRouter


def test_general_pool_falls_back_to_configured_non_flash_models():
    router = LLMRouter(api_keys=["key-1"], models=["gemini-2.5-pro"])

    slot = router.next_slot(critical=False)

    assert slot.api_key == "key-1"
    assert slot.model == "gemini-2.5-pro"
