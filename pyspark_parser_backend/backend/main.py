from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .parser import parse_pyspark
from .parser.ai_parser import ai_regenerate

app = FastAPI(title="PySpark Graph Parser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ParseRequest(BaseModel):
    code: str

class RegenerateRequest(BaseModel):
    node: dict
    base_df: str

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/parse")
def parse(body: ParseRequest) -> dict:
    if not body.code.strip():
        raise HTTPException(status_code=422, detail="code must not be empty")
    return parse_pyspark(body.code)


@app.post("/regenerate")
def regenerate(body: RegenerateRequest) -> dict:
    try:
        updated_node = ai_regenerate(body.node, body.base_df)
    except EnvironmentError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return updated_node
