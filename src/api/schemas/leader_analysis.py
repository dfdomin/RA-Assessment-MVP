from pydantic import BaseModel, field_validator


class LeaderAnalysisInput(BaseModel):
    perf_indicator_id: int
    analysis_text: str

    @field_validator("analysis_text")
    @classmethod
    def text_max_2000(cls, v: str) -> str:
        if len(v) > 2000:
            raise ValueError("analysis_text must not exceed 2000 characters")
        return v


class LeaderAnalysisUpdate(BaseModel):
    analyses: list[LeaderAnalysisInput]


class LeaderAnalysisItem(BaseModel):
    perf_indicator_id: int
    pi_code: str
    analysis_text: str


class LeaderAnalysisResponse(BaseModel):
    period_id: int
    analyses: list[LeaderAnalysisItem]
