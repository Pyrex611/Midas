from app import main


def test_template_directory_points_to_backend_templates():
    expected = str(main.BACKEND_ROOT / "templates")
    assert main.templates.env.loader.searchpath[0] == expected
