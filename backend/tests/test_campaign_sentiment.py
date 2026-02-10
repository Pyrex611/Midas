from app.services.campaign import CampaignService


class Dummy:
    def query(self, *args, **kwargs):
        raise NotImplementedError


def test_sentiment_classifier():
    svc = CampaignService.__new__(CampaignService)
    assert svc.classify_sentiment("Yes, let's talk tomorrow") == "positive"
    assert svc.classify_sentiment("Please unsubscribe me") == "negative"
    assert svc.classify_sentiment("Thanks for sharing") == "neutral"
