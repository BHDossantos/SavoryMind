from unittest.mock import patch


def test_failed_delivery_does_not_claim_request_received(client):
    with patch('app.api.routes.account.resend_client.send_email', return_value=False) as send:
        response = client.post('/api/account/delete-request', json={'email': 'person@example.com'})
    assert response.status_code == 503
    assert send.call_count == 1


def test_confirmation_failure_does_not_lose_accepted_request(client):
    with patch('app.api.routes.account.resend_client.send_email', side_effect=[True, False]) as send:
        response = client.post('/api/account/delete-request', json={'email': 'person@example.com'})
    assert response.status_code == 200
    assert response.json()['ok'] is True
    assert send.call_count == 2


def test_user_text_is_escaped_in_admin_email():
    from app.api.routes.account import _admin_email_html
    html = _admin_email_html('person@example.com', '<a href="https://evil.example">click</a>', False)
    assert '<a href=' not in html
    assert '&lt;a href=' in html


def test_acknowledgment_does_not_promise_a_processing_deadline(client):
    with patch('app.api.routes.account.resend_client.send_email', return_value=True) as send:
        response = client.post('/api/account/delete-request', json={'email': 'person@example.com'})
    assert response.status_code == 200
    assert '30 days' not in response.json()['message']
    assert 'Deletion has not been confirmed' in response.json()['message']
    for call in send.call_args_list:
        assert '30 days' not in call.kwargs['html']
