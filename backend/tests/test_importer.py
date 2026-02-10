from app.services.importer import parse_leads, dedupe_by_email


def test_parse_csv_and_dedupe():
    payload = b"name,email,company\nAlice,alice@x.com,ACME\nAlice,alice@x.com,ACME\nBob,bob@x.com,BCorp\n"
    leads = parse_leads(payload, "leads.csv")
    unique = dedupe_by_email(leads)
    assert len(leads) == 3
    assert len(unique) == 2
