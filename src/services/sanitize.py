from typing import Any

_DANGEROUS_CELL_PREFIXES = ("=", "+", "-", "@", "|", "%")


def safe_cell_value(value: Any) -> Any:
    """Return a spreadsheet-safe value without changing non-text values."""
    if not isinstance(value, str):
        return value
    if value.startswith(_DANGEROUS_CELL_PREFIXES):
        return f"'{value}"
    return value

