import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
from fastapi import HTTPException

from app.api.v1.ai import _generate_reply, _provider_headers


def run_immediate_coroutine(coroutine):
    try:
        coroutine.send(None)
    except StopIteration as result:
        return result.value
    raise AssertionError("The test coroutine unexpectedly performed asynchronous I/O")


class AiProviderTests(unittest.TestCase):
    def test_openai_compatible_chat_sends_history_and_document_context(self):
        response = httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "Kết quả"}}],
                "usage": {"prompt_tokens": 8, "completion_tokens": 3},
            },
            request=httpx.Request("POST", "https://api.example.test/v1/chat/completions"),
        )
        client = SimpleNamespace(post=AsyncMock(return_value=response))
        provider = SimpleNamespace(name="OpenAI", api_base_url="https://api.example.test/v1")
        connection = SimpleNamespace(
            provider_id="openai",
            provider=provider,
            api_endpoint=None,
        )

        result = run_immediate_coroutine(_generate_reply(
            client,
            connection,
            "secret",
            "gpt-test",
            [
                {"role": "user", "content": "Câu trước"},
                {"role": "assistant", "content": "Trả lời trước"},
                {"role": "user", "content": "Câu hiện tại"},
            ],
            "\nTài liệu tham khảo",
        ))

        self.assertEqual(result, ("Kết quả", 8, 3))
        payload = client.post.await_args.kwargs["json"]
        self.assertEqual(payload["messages"][1]["content"], "Câu trước")
        self.assertEqual(payload["messages"][-1]["content"], "Câu hiện tại\nTài liệu tham khảo")

    def test_provider_http_error_is_not_returned_as_chat_content(self):
        response = httpx.Response(
            401,
            json={"error": "invalid key"},
            request=httpx.Request("POST", "https://api.example.test/v1/chat/completions"),
        )
        client = SimpleNamespace(post=AsyncMock(return_value=response))
        connection = SimpleNamespace(
            provider_id="openai",
            provider=SimpleNamespace(name="OpenAI", api_base_url="https://api.example.test/v1"),
            api_endpoint=None,
        )

        with self.assertRaises(HTTPException) as raised:
            run_immediate_coroutine(_generate_reply(
                client,
                connection,
                "secret",
                "gpt-test",
                [{"role": "user", "content": "Hello"}],
                "",
            ))

        self.assertEqual(raised.exception.status_code, 502)
        self.assertNotIn("invalid key", raised.exception.detail)

    def test_api_keys_use_provider_specific_auth_headers(self):
        self.assertEqual(_provider_headers("gemini", "key"), {"x-goog-api-key": "key"})
        self.assertEqual(
            _provider_headers("claude", "key"),
            {"x-api-key": "key", "anthropic-version": "2023-06-01"},
        )
        self.assertEqual(
            _provider_headers("groq", "key"),
            {"Authorization": "Bearer key"},
        )


if __name__ == "__main__":
    unittest.main()
