from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class BlockCreate(BaseModel):
    """Block creation schema"""
    day_key: str
    practice: str
    title: str
    duration_minutes: int
    goal_id: int
    cycle_id: int
    block_data: Optional[Dict[str, Any]] = None


class BlockResponse(BaseModel):
    """Block response schema"""
    id: int
    user_id: int
    goal_id: int
    cycle_id: int
    day_key: str
    practice: str
    title: str
    duration_minutes: int
    status: str
    start_iso: Optional[str] = None
    completion_iso: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BlockUpdate(BaseModel):
    """Block update schema"""
    status: Optional[str] = None
    start_iso: Optional[str] = None
    completion_iso: Optional[str] = None
    block_data: Optional[Dict[str, Any]] = None


class ExecutionEventCreate(BaseModel):
    """Execution event creation schema"""
    event_type: str
    block_id: int
    event_data: Optional[Dict[str, Any]] = None
    cycle_id: int


class ExecutionEventResponse(BaseModel):
    """Execution event response schema"""
    id: int
    user_id: int
    cycle_id: int
    event_type: str
    block_id: int
    event_data: Optional[Dict[str, Any]] = None
    timestamp: datetime
    event_hash: str

    class Config:
        from_attributes = True