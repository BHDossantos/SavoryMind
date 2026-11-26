"""Business agent wiring: admins only, off until a key and flag are set."""
import os
from types import SimpleNamespace
from unittest.mock import patch

from app.business_agent import BUSINESS_AGENTS, run_business_task
from app.business_agent.provider import agent_off_reason, anthropic_provider, provider_from_env

from .conftest import register_user, auth_headers

AGENT = BUSINESS_AGENTS[0]
OK = {
    "status": "completed",
    "summary": "s",
    "data": {"headline": "h", "skillsUsed": [], "findings": [], "proposals": [{"kind": "draft", "skillId": "copy", "title": "t", "detail": "d", "sourceId": "app:restaurants"}], "questions": [], "notesForNextShift": ""},
    "sources": [{"sourceId": "app:restaurants", "locator": "", "note": ""}],
    "assumptions": [],
    "proposed_actions": [],
    "blockers": [],
}


class FakeClient:
    def __init__(self, reply=None, error=None):
        self.sent = {}
        self.messages = self
        self._reply, self._error = reply, error

    def create(self, **kw):
        self.sent = kw
        if self._error:
            raise self._error
        return SimpleNamespace(content=[SimpleNamespace(type="tool_use", input=self._reply)])


def test_off_without_flag_or_key():
    assert "BUSINESS_AGENT_ENABLED" in agent_off_reason({})
    assert "ANTHROPIC_API_KEY" in agent_off_reason({"BUSINESS_AGENT_ENABLED": "true"})
    assert agent_off_reason({"BUSINESS_AGENT_ENABLED": "true", "ANTHROPIC_API_KEY": "k"}) is None
    assert provider_from_env({"ANTHROPIC_API_KEY": "k"}) is None


def test_forced_tool_call_becomes_the_envelope_and_proposals_need_approval():
    fake = FakeClient(reply=OK)
    model = provider_from_env({"BUSINESS_AGENT_ENABLED": "true", "ANTHROPIC_API_KEY": "k"}, client_factory=lambda key: fake)
    r = run_business_task(AGENT, AGENT["tasks"][0]["id"], [{"sourceId": "app:restaurants", "trusted": True, "text": "x"}], model=model)
    assert fake.sent["tool_choice"]["type"] == "tool"
    assert r["status"] == "completed"
    assert all(p["needsApproval"] is True for p in r["proposals"])


def test_failed_call_does_not_leak_the_key():
    fake = FakeClient(error=RuntimeError("401 for key sk-ant-abcdefghijklmnopqrstuvwxyz"))
    r = run_business_task(AGENT, AGENT["tasks"][0]["id"], [{"sourceId": "app:restaurants", "trusted": True, "text": "x"}], model=anthropic_provider(fake))
    assert r["status"] == "failed"
    assert "abcdefghijklmnop" not in str(r)


def test_route_is_admin_only(client):
    token, _ = register_user(client, email="regular@example.com", account_type="restaurant")
    with patch.dict(os.environ, {"ADMIN_EMAILS": "boss@savorymind.net"}):
        assert client.get("/api/admin/business-agent", headers=auth_headers(token)).status_code == 403
        assert client.post("/api/admin/business-agent/run", json={"taskId": "prospects"}, headers=auth_headers(token)).status_code == 403


def test_route_is_off_until_enabled(client):
    token, _ = register_user(client, email="boss@savorymind.net", account_type="restaurant")
    with patch.dict(os.environ, {"ADMIN_EMAILS": "boss@savorymind.net", "BUSINESS_AGENT_ENABLED": ""}):
        res = client.get("/api/admin/business-agent", headers=auth_headers(token))
        assert res.status_code == 200
        assert "BUSINESS_AGENT_ENABLED" in res.json()["off"]
        res = client.post("/api/admin/business-agent/run", json={"taskId": "prospects"}, headers=auth_headers(token))
        assert res.status_code == 503


def test_route_runs_on_counts_when_enabled(client):
    token, _ = register_user(client, email="boss@savorymind.net", account_type="restaurant")
    fake = FakeClient(reply=OK)
    env = {"ADMIN_EMAILS": "boss@savorymind.net", "BUSINESS_AGENT_ENABLED": "true", "ANTHROPIC_API_KEY": "k"}
    with patch.dict(os.environ, env), patch("app.api.routes.admin_business_agent.provider_from_env", lambda: anthropic_provider(fake)):
        res = client.post("/api/admin/business-agent/run", json={"taskId": AGENT["tasks"][0]["id"]}, headers=auth_headers(token))
    assert res.status_code == 200
    assert res.json()["status"] == "completed"
    assert "Restaurant accounts: 1" in fake.sent["messages"][0]["content"]
    assert "boss@savorymind.net" not in fake.sent["messages"][0]["content"]
