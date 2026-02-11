from __future__ import annotations

import uuid


class EmailGateway:
    def send(self, to_email: str, subject: str, body: str, sender: str) -> str:
        message_id = str(uuid.uuid4())
        print(
            f"[EMAIL-SEND] sender={sender} to={to_email} subject={subject} message_id={message_id}\n{body}\n"
        )
        return message_id
