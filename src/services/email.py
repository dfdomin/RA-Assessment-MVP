from dataclasses import dataclass


@dataclass(frozen=True)
class ReminderEmail:
    recipient_email: str
    subject: str
    body: str


async def send_reminder_emails(messages: list[ReminderEmail]) -> tuple[int, int]:
    """Delivery seam for F13.

    The production SMTP integration is intentionally isolated here; tests and local
    development use the no-op sender so the API contract is verifiable without
    requiring Gmail credentials.
    """
    return len(messages), 0
