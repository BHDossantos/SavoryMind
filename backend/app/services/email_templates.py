"""Localized transactional message templates.

Restaurant operators in the Italian pilot would otherwise receive English
booking alerts ("New booking: …", "SavoryMind: new booking — …") while
the rest of the product runs in their language. Same for the day-before
reminders to diners. This module holds the templates and a tiny lookup
helper that falls back to English when a translation isn't available.

The templates use Python `.format()` (not i18next) since the backend
already imports nothing from the JS i18n stack. HTML escaping is the
caller's responsibility — the fields a template receives are already
escaped.
"""
from __future__ import annotations


_SUPPORTED = ("en", "it", "es", "pt", "fr")
_DEFAULT = "en"


def _pick(lang: str | None, table: dict) -> str:
    code = (lang or "").lower().split("-")[0]
    if code in table:
        return table[code]
    return table[_DEFAULT]


# ── Restaurant alert: new booking ────────────────────────────────────────────

def new_booking_subject(lang: str, *, diner_name: str, party_size: int, confirmed: bool) -> str:
    return _pick(lang, {
        "en": (f"New booking: {diner_name}, party of {party_size}" if confirmed
               else f"Booking request — {diner_name}, party of {party_size} (action needed)"),
        "it": (f"Nuova prenotazione: {diner_name}, tavolo da {party_size}" if confirmed
               else f"Richiesta di prenotazione — {diner_name}, tavolo da {party_size} (azione richiesta)"),
        "es": (f"Nueva reserva: {diner_name}, mesa de {party_size}" if confirmed
               else f"Solicitud de reserva — {diner_name}, mesa de {party_size} (acción necesaria)"),
        "pt": (f"Nova reserva: {diner_name}, mesa para {party_size}" if confirmed
               else f"Pedido de reserva — {diner_name}, mesa para {party_size} (ação necessária)"),
        "fr": (f"Nouvelle réservation : {diner_name}, table de {party_size}" if confirmed
               else f"Demande de réservation — {diner_name}, table de {party_size} (action requise)"),
    })


def new_booking_intro(lang: str, *, confirmed: bool) -> str:
    return _pick(lang, {
        "en": "You have a new confirmed booking on SavoryMind:" if confirmed else "A new booking request needs your confirmation:",
        "it": "Hai una nuova prenotazione confermata su SavoryMind:"   if confirmed else "Una nuova richiesta di prenotazione attende la tua conferma:",
        "es": "Tienes una nueva reserva confirmada en SavoryMind:"     if confirmed else "Una nueva solicitud de reserva espera tu confirmación:",
        "pt": "Você tem uma nova reserva confirmada no SavoryMind:"    if confirmed else "Um novo pedido de reserva aguarda sua confirmação:",
        "fr": "Vous avez une nouvelle réservation confirmée sur SavoryMind :" if confirmed else "Une nouvelle demande de réservation attend votre confirmation :",
    })


def booking_table_labels(lang: str) -> dict:
    """Field labels used in the email's data table."""
    return _pick(lang, {
        "en": {"guest": "Guest", "party": "Party",    "date": "Date",     "time": "Time",  "special": "Special requests"},
        "it": {"guest": "Cliente","party": "Tavolo",   "date": "Data",    "time": "Ora",   "special": "Richieste speciali"},
        "es": {"guest": "Cliente","party": "Comensales","date": "Fecha",  "time": "Hora",  "special": "Peticiones especiales"},
        "pt": {"guest": "Cliente","party": "Mesa",     "date": "Data",    "time": "Hora",  "special": "Pedidos especiais"},
        "fr": {"guest": "Client", "party": "Couverts", "date": "Date",    "time": "Heure", "special": "Demandes spéciales"},
    })


def open_dashboard_cta(lang: str) -> str:
    return _pick(lang, {
        "en": "Open dashboard",
        "it": "Apri la dashboard",
        "es": "Abrir consola",
        "pt": "Abrir dashboard",
        "fr": "Ouvrir le tableau de bord",
    })


def email_footer(lang: str, *, dashboard_url: str) -> str:
    return _pick(lang, {
        "en": f"Sent by SavoryMind. Manage your restaurant's bookings at <a href=\"{dashboard_url}\" style=\"color:#9ca3af;\">{dashboard_url}</a>.",
        "it": f"Inviato da SavoryMind. Gestisci le prenotazioni del tuo ristorante su <a href=\"{dashboard_url}\" style=\"color:#9ca3af;\">{dashboard_url}</a>.",
        "es": f"Enviado por SavoryMind. Gestiona las reservas de tu restaurante en <a href=\"{dashboard_url}\" style=\"color:#9ca3af;\">{dashboard_url}</a>.",
        "pt": f"Enviado pelo SavoryMind. Gerencie as reservas do seu restaurante em <a href=\"{dashboard_url}\" style=\"color:#9ca3af;\">{dashboard_url}</a>.",
        "fr": f"Envoyé par SavoryMind. Gérez les réservations de votre restaurant sur <a href=\"{dashboard_url}\" style=\"color:#9ca3af;\">{dashboard_url}</a>.",
    })


def new_booking_sms(lang: str, *, diner_name: str, party_size: int, booking_date: str, booking_time: str, confirmed: bool) -> str:
    if confirmed:
        return _pick(lang, {
            "en": f"SavoryMind: new booking — {diner_name}, party of {party_size}, {booking_date} at {booking_time}.",
            "it": f"SavoryMind: nuova prenotazione — {diner_name}, tavolo da {party_size}, {booking_date} alle {booking_time}.",
            "es": f"SavoryMind: nueva reserva — {diner_name}, mesa de {party_size}, {booking_date} a las {booking_time}.",
            "pt": f"SavoryMind: nova reserva — {diner_name}, mesa para {party_size}, {booking_date} às {booking_time}.",
            "fr": f"SavoryMind : nouvelle réservation — {diner_name}, table de {party_size}, {booking_date} à {booking_time}.",
        })
    return _pick(lang, {
        "en": f"SavoryMind: booking request — {diner_name}, party of {party_size}, {booking_date} at {booking_time}. Needs your confirmation.",
        "it": f"SavoryMind: richiesta — {diner_name}, tavolo da {party_size}, {booking_date} alle {booking_time}. Attende la tua conferma.",
        "es": f"SavoryMind: solicitud — {diner_name}, mesa de {party_size}, {booking_date} a las {booking_time}. Espera tu confirmación.",
        "pt": f"SavoryMind: pedido — {diner_name}, mesa para {party_size}, {booking_date} às {booking_time}. Aguarda sua confirmação.",
        "fr": f"SavoryMind : demande — {diner_name}, table de {party_size}, {booking_date} à {booking_time}. Attend votre confirmation.",
    })


# ── Diner reminder (day-before) ──────────────────────────────────────────────

def reminder_email_subject(lang: str, *, rest_label: str, booking_time: str) -> str:
    return _pick(lang, {
        "en": f"Reminder: your booking at {rest_label} tomorrow at {booking_time}",
        "it": f"Promemoria: la tua prenotazione da {rest_label} domani alle {booking_time}",
        "es": f"Recordatorio: tu reserva en {rest_label} mañana a las {booking_time}",
        "pt": f"Lembrete: sua reserva em {rest_label} amanhã às {booking_time}",
        "fr": f"Rappel : votre réservation chez {rest_label} demain à {booking_time}",
    })


def reminder_email_greeting(lang: str, *, customer_name: str) -> str:
    return _pick(lang, {
        "en": f"Hi {customer_name}, just a reminder of your booking tomorrow:",
        "it": f"Ciao {customer_name}, un promemoria della tua prenotazione di domani:",
        "es": f"Hola {customer_name}, un recordatorio de tu reserva de mañana:",
        "pt": f"Olá {customer_name}, um lembrete da sua reserva de amanhã:",
        "fr": f"Bonjour {customer_name}, un rappel de votre réservation de demain :",
    })


def reminder_email_labels(lang: str) -> dict:
    return _pick(lang, {
        "en": {"restaurant": "Restaurant",  "date": "Date",  "time": "Time",  "party": "Party"},
        "it": {"restaurant": "Ristorante",  "date": "Data",  "time": "Ora",   "party": "Tavolo"},
        "es": {"restaurant": "Restaurante", "date": "Fecha", "time": "Hora",  "party": "Comensales"},
        "pt": {"restaurant": "Restaurante", "date": "Data",  "time": "Hora",  "party": "Mesa"},
        "fr": {"restaurant": "Restaurant",  "date": "Date",  "time": "Heure", "party": "Couverts"},
    })


def reminder_email_close(lang: str) -> str:
    return _pick(lang, {
        "en": "If something changed, please let the restaurant know — they're counting on your table.",
        "it": "Se qualcosa è cambiato, avvisa il ristorante — stanno contando sul tuo tavolo.",
        "es": "Si algo cambió, avisa al restaurante — están contando con tu mesa.",
        "pt": "Se algo mudou, avise o restaurante — eles estão contando com a sua mesa.",
        "fr": "Si quelque chose a changé, prévenez le restaurant — ils comptent sur votre table.",
    })


def reminder_sms(lang: str, *, rest_label: str, party_size: int, booking_date: str, booking_time: str) -> str:
    return _pick(lang, {
        "en": (f"Reminder from SavoryMind: you have a booking at {rest_label} on {booking_date} at {booking_time}, "
               f"party of {party_size}. If something changed, please let the restaurant know."),
        "it": (f"Promemoria SavoryMind: hai una prenotazione da {rest_label} il {booking_date} alle {booking_time}, "
               f"tavolo da {party_size}. Se qualcosa è cambiato, avvisa il ristorante."),
        "es": (f"Recordatorio SavoryMind: tienes una reserva en {rest_label} el {booking_date} a las {booking_time}, "
               f"mesa de {party_size}. Si algo cambió, avisa al restaurante."),
        "pt": (f"Lembrete SavoryMind: você tem uma reserva em {rest_label} no dia {booking_date} às {booking_time}, "
               f"mesa para {party_size}. Se algo mudou, avise o restaurante."),
        "fr": (f"Rappel SavoryMind : vous avez une réservation chez {rest_label} le {booking_date} à {booking_time}, "
               f"table de {party_size}. Si quelque chose a changé, prévenez le restaurant."),
    })
