"""Canonical performance level values (Excel / ABET scale)."""

ALLOWED_LEVELS: frozenset[int] = frozenset({1, 2, 4, 5})

LEVEL_LABELS_ES: dict[int, str] = {
    1: "Deficiente",
    2: "Insuficiente",
    4: "Bueno",
    5: "Sobresaliente",
}

LEVEL_SHORT_ABET: dict[int, str] = {
    1: "No",
    2: "Sí, pero",
    4: "Sí",
    5: "Sí, aún más",
}

LEVEL_LABELS_EN: dict[int, str] = {
    1: "Poor",
    2: "Inadequate",
    4: "Adequate",
    5: "Exemplary",
}

MAX_LEVEL_SCORE = 5


def validate_level(value: int) -> int:
    if value not in ALLOWED_LEVELS:
        raise ValueError("level must be 1, 2, 4, or 5")
    return value


def selector_label_es(level: int) -> str:
    return f"{LEVEL_LABELS_ES[level]} — {LEVEL_SHORT_ABET[level]} ({level})"
