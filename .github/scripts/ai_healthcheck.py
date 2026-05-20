"""One-shot Anthropic API healthcheck.

Verifies the ANTHROPIC_API_KEY secret can actually reach Claude — used to
diagnose Flavor / AI features failing in production with a vague
"something glitched" message that hides the real error.

Run via the "AI healthcheck" GitHub Actions workflow. The final line is
either:
  AI HEALTHCHECK: OK ...
  AI HEALTHCHECK: FAILED — <ExceptionType>: <message>
The FAILED message names the exact cause (bad key, no credits, bad
model, etc.) and contains no secret value.
"""
import os
import sys

# Same model the backend uses — see claude_client.DEFAULT_MODEL.
MODEL = "claude-opus-4-7"


def main() -> int:
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("AI HEALTHCHECK: FAILED — the ANTHROPIC_API_KEY secret is not set.")
        return 1

    try:
        from anthropic import Anthropic
    except Exception as exc:
        print(f"AI HEALTHCHECK: FAILED — could not import the anthropic SDK: {exc}")
        return 1

    client = Anthropic()
    print(f"Model under test: {MODEL}\n")

    # 1. Basic message call — verifies the key, the account, and the model.
    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=50,
            messages=[{"role": "user", "content": "Reply with exactly: OK"}],
        )
        reply = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        print(f"[1/2] Basic call: OK — Claude replied {reply!r}")
    except Exception as exc:
        print("[1/2] Basic call: FAILED")
        print(f"AI HEALTHCHECK: FAILED — {type(exc).__name__}: {exc}")
        return 1

    # 2. Tool-use call — mirrors how Flavor works (claude_client.call_with_tools).
    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=200,
            tools=[{
                "name": "get_weather",
                "description": "Get the current weather for a city.",
                "input_schema": {
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                    "required": ["city"],
                },
            }],
            messages=[{"role": "user", "content": "Use the tool to check the weather in Paris."}],
        )
        print(f"[2/2] Tool-use call: OK — stop_reason={resp.stop_reason}")
    except Exception as exc:
        print("[2/2] Tool-use call: FAILED")
        print(f"AI HEALTHCHECK: FAILED — {type(exc).__name__}: {exc}")
        return 1

    print("\nAI HEALTHCHECK: OK — the Anthropic key, account, and model all work.")
    print("If Flavor still fails, the cause is in the app code, not the key.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
