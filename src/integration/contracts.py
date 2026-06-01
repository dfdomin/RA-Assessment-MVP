from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Source = Literal["academusoft", "csv", "rest", "manual"]
UserRole = Literal["admin", "leader", "teacher"]


class DocenteRecord(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    role: UserRole = "teacher"
    pege_id: str | None = Field(default=None, max_length=50)


class ModuloRecord(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    course_code: str = Field(min_length=1, max_length=30, pattern=r"^[A-Za-z0-9_.-]+$")
    course_name: str = Field(min_length=1, max_length=200)
    group_name: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9_.-]+$")
    docente_email: EmailStr


class EstudianteRecord(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    internal_id: str = Field(min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
    document_number: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
    full_name: str = Field(min_length=1, max_length=200)
    modulo_id: str = Field(min_length=1, max_length=80)


class SyncPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    periodo_codigo: str = Field(min_length=1, max_length=100)
    docentes: list[DocenteRecord] = Field(default_factory=list)
    modulos: list[ModuloRecord] = Field(default_factory=list)
    estudiantes: list[EstudianteRecord] = Field(default_factory=list)
    source: Source
    consent_acknowledged: bool = False

    @field_validator("periodo_codigo")
    @classmethod
    def validate_periodo_codigo(cls, value: str) -> str:
        if value.startswith(("=", "+", "-", "@", "|", "%")):
            raise ValueError("Formula injection detected")
        return value

