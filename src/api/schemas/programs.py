from pydantic import BaseModel, Field


class PropedeuticLineCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=120)
    code: str = Field(..., min_length=2, max_length=20)


class PropedeuticLineResponse(BaseModel):
    id: int
    name: str
    code: str
    is_active: bool

    model_config = {"from_attributes": True}


class ProgramCreate(BaseModel):
    propedeutic_line_id: int
    name: str = Field(..., min_length=3, max_length=200)
    code: str = Field(..., min_length=2, max_length=20)
    cycle_level: str = Field(..., pattern="^(técnico|tecnología|profesional)$")
    faculty: str | None = Field(default=None, max_length=120)


class ProgramResponse(BaseModel):
    id: int
    propedeutic_line_id: int
    name: str
    code: str
    cycle_level: str
    faculty: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class ProgramMembershipCreate(BaseModel):
    user_id: int
    role: str = Field(..., pattern="^(leader|teacher)$")


class ProgramMembershipResponse(BaseModel):
    id: int
    user_id: int
    program_id: int
    role: str

    model_config = {"from_attributes": True}
