import pytest


@pytest.mark.e2e
def test_e2e_scaffold_is_collectable(base_url_for_e2e):
    assert base_url_for_e2e

