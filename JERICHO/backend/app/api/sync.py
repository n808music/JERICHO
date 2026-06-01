from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.user_state import UserState

router = APIRouter()


class StatePushPayload(BaseModel):
    state_blob: str
    client_updated_at: Optional[str] = None


@router.post("/push")
async def push_sync(
    payload: StatePushPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_state = db.query(UserState).filter(UserState.user_id == current_user.id).first()
    if user_state:
        user_state.state_blob = payload.state_blob
        user_state.client_updated_at = payload.client_updated_at
    else:
        user_state = UserState(
            user_id=current_user.id,
            state_blob=payload.state_blob,
            client_updated_at=payload.client_updated_at,
        )
        db.add(user_state)
    db.commit()
    return {"ok": True}


@router.get("/pull")
async def pull_sync(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_state = db.query(UserState).filter(UserState.user_id == current_user.id).first()
    if not user_state:
        return {"state_blob": None, "client_updated_at": None}
    return {"state_blob": user_state.state_blob, "client_updated_at": user_state.client_updated_at}
