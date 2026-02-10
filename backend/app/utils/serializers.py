from app.models.entities import Lead, Conversation, Alert, Template


def lead_to_dict(x: Lead) -> dict:
    return {
        "id": x.id,
        "name": x.name,
        "email": x.email,
        "company": x.company,
        "position": x.position,
        "niche": x.niche,
        "objective": x.objective,
        "status": x.status.value if hasattr(x.status, "value") else x.status,
        "opted_out": x.opted_out,
        "created_at": x.created_at.isoformat(),
    }


def convo_to_dict(x: Conversation) -> dict:
    return {
        "id": x.id,
        "lead_id": x.lead_id,
        "direction": x.direction.value if hasattr(x.direction, "value") else x.direction,
        "subject": x.subject,
        "body": x.body,
        "sentiment": x.sentiment,
        "category": x.category,
        "created_at": x.created_at.isoformat(),
    }


def alert_to_dict(x: Alert) -> dict:
    return {
        "id": x.id,
        "lead_id": x.lead_id,
        "level": x.level,
        "message": x.message,
        "resolved": x.resolved,
        "created_at": x.created_at.isoformat(),
    }


def template_to_dict(x: Template) -> dict:
    return {
        "id": x.id,
        "name": x.name,
        "template_type": x.template_type.value if hasattr(x.template_type, "value") else x.template_type,
        "subject": x.subject,
        "body": x.body,
        "score": x.score,
        "usage_count": x.usage_count,
        "tags": x.tags,
    }
