from fastapi import APIRouter
from fastapi.responses import JSONResponse

from jyriko.db.json_adapter import safe_read_state, write_state

router = APIRouter(tags=["state"])


@router.get("/state")
async def get_state() -> JSONResponse:
    result = await safe_read_state()
    if not result["ok"]:
        return JSONResponse(
            {"error": result["errorCode"], "reason": result["reason"]},
            status_code=500,
        )
    return JSONResponse(result["state"])


@router.post("/reset")
async def reset_state() -> JSONResponse:
    await write_state({"goals": [], "identity": {}, "history": []})
    return JSONResponse({"status": "reset"})
