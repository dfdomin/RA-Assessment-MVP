from pathlib import Path

import pytest

from src.services.academusoft_pdf import (
    AcademusoftPdfModuleMismatchError,
    parse_academusoft_pdf,
    validate_pdf_header_for_module,
)

ROOT = Path(__file__).resolve().parents[1]
PDF_17 = ROOT / "Reporte_Estudiantes-17.pdf"
PDF_18 = ROOT / "Reporte_Estudiantes-18.pdf"


@pytest.mark.parametrize(
    ("pdf_path", "expected_count", "course_code", "group_name"),
    [
        (PDF_17, 38, "ADM18", "1_CE_G2"),
        (PDF_18, 18, "INN10", "11_INE_G1"),
    ],
)
def test_parse_academusoft_pdf_extracts_rows(pdf_path, expected_count, course_code, group_name):
    content = pdf_path.read_bytes()
    result = parse_academusoft_pdf(content)

    assert result.header.course_code == course_code
    assert result.header.group_name == group_name
    assert len(result.rows) == expected_count
    assert result.rows[0].roster_position == 1
    assert result.rows[0].document_number.isdigit()
    assert result.rows[-1].roster_position == expected_count


def test_validate_pdf_header_for_module_accepts_matching_module():
    content = PDF_17.read_bytes()
    header = parse_academusoft_pdf(content).header

    validate_pdf_header_for_module(
        header,
        course_code="ADM18",
        group_name="1_CE_G2",
    )


def test_validate_pdf_header_for_module_rejects_wrong_group():
    content = PDF_17.read_bytes()
    header = parse_academusoft_pdf(content).header

    with pytest.raises(AcademusoftPdfModuleMismatchError):
        validate_pdf_header_for_module(
            header,
            course_code="ADM18",
            group_name="OTRO_GRUPO",
        )
