from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    """User model for authentication and basic user data"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    
    # Relationships
    goals = relationship("Goal", back_populates="user")
    cycles = relationship("Cycle", back_populates="user")
    blocks = relationship("Block", back_populates="user")


class Goal(Base):
    """Goal model with full contract data in JSON"""
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    
    # Store complete goal contract as JSON (mirrors frontend structure)
    goal_execution_contract = Column(Text)  # JSON string
    goal_governance_contract = Column(Text)  # JSON string
    admission_status = Column(String, default="pending")  # pending, admitted, rejected
    admission_reason = Column(Text)  # Reason for rejection if any
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    
    # Relationships
    user = relationship("User", back_populates="goals")
    cycles = relationship("Cycle", back_populates="goal")
    blocks = relationship("Block", back_populates="goal")


class Cycle(Base):
    """Cycle model representing goal execution lifecycle"""
    __tablename__ = "cycles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False, index=True)
    
    # Cycle metadata
    status = Column(String, default="active")  # active, completed, archived
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True))
    
    # Store complete cycle state as JSON (mirrors frontend cycle data)
    cycle_data = Column(Text)  # JSON string with all cycle state
    
    # Relationships
    user = relationship("User", back_populates="cycles")
    goal = relationship("Goal", back_populates="cycles")
    blocks = relationship("Block", back_populates="cycle")


class Block(Base):
    """Block model for individual work units"""
    __tablename__ = "blocks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False, index=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, index=True)
    
    # Core block data
    day_key = Column(String, nullable=False, index=True)  # YYYY-MM-DD format
    practice = Column(String, nullable=False)  # Creation, Focus, etc.
    title = Column(String, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    
    # Block status and execution
    status = Column(String, default="scheduled")  # scheduled, started, completed, skipped
    start_iso = Column(String)  # ISO timestamp when block started
    completion_iso = Column(String)  # ISO timestamp when block completed
    
    # Block metadata
    block_data = Column(Text)  # JSON string with additional block properties
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="blocks")
    goal = relationship("Goal", back_populates="blocks")
    cycle = relationship("Cycle", back_populates="blocks")


class ExecutionEvent(Base):
    """Immutable execution event log for audit trail"""
    __tablename__ = "execution_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, index=True)
    
    # Event data
    event_type = Column(String, nullable=False)  # BLOCK_STARTED, BLOCK_COMPLETED, etc.
    block_id = Column(Integer, ForeignKey("blocks.id"), nullable=False, index=True)
    event_data = Column(Text)  # JSON string with complete event data
    
    # Immutable timestamp
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Event hash for integrity verification
    event_hash = Column(String, nullable=False, index=True)