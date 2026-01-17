from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class GoalCreate(BaseModel):
    """Goal creation schema"""
    title: str
    goal_execution_contract: Dict[str, Any]
    goal_governance_contract: Optional[Dict[str, Any]] = None


class GoalResponse(BaseModel):
    """Goal response schema"""
    id: int
    user_id: int
    title: str
    admission_status: str
    admission_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool

    class Config:
        from_attributes = True


class GoalValidationRequest(BaseModel):
    """Goal validation request schema"""
    goal_execution_contract: Dict[str, Any]
    goal_governance_contract: Optional[Dict[str, Any]] = None


class GoalValidationResponse(BaseModel):
    """Goal validation response schema"""
    is_valid: bool
    admission_status: str
    admission_reason: Optional[str] = None
    validation_errors: Optional[List[str]] = None


class CycleCreate(BaseModel):
    """Cycle creation schema"""
    goal_id: int
    cycle_data: Optional[Dict[str, Any]] = None


class CycleResponse(BaseModel):
    """Cycle response schema"""
    id: int
    user_id: int
    goal_id: int
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True