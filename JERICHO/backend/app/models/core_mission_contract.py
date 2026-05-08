"""
CoreMissionContract: SQLAlchemy model for durable multi-year missions

The core mission sits above the MasterPlan and establishes continuity across
changing tactics, campaigns, and execution cycles.

When plan changes, the core objective may remain stable. The system distinguishes:
- Schedule delay (local)
- Tactical pivot (campaign level)
- Campaign failure (strategic)
- Mission drift (existential)
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class CoreMissionContract(Base):
    __tablename__ = "core_mission_contracts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Mission and profile identifiers
    mission_id = Column(String, unique=True, index=True, nullable=False)
    profile_id = Column(String, nullable=False, index=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ===== CORE OBJECTIVE =====
    # The durable goal that does not change easily
    durable_objective = Column(Text, nullable=False)

    # Long-horizon numerical target (e.g., "3.5B outcome")
    magnitude_target = Column(String)

    # How many years does this mission span? (e.g., 10)
    horizon_years = Column(Integer, nullable=False)

    # Where are we in the long-term mission? (e.g., "Second half of 10-year arc")
    current_phase = Column(String, nullable=False)

    # ===== STRATEGIC THESIS =====
    # The theory for HOW the core goal becomes real
    strategic_thesis = Column(Text, nullable=False)

    # ===== COMMITMENTS & CONSTRAINTS =====
    # Non-negotiables: values that cannot be traded away
    # Shape: list of strings, stored as JSON
    non_negotiables_json = Column(Text, default="[]")

    # Allowed tradeoffs: what can flex when entropy hits
    # Shape: list of strings, stored as JSON
    allowed_tradeoffs_json = Column(Text, default="[]")

    # Forbidden tradeoffs: lines that must never be crossed
    # Shape: list of strings, stored as JSON
    forbidden_tradeoffs_json = Column(Text, default="[]")

    # ===== CAMPAIGNS =====
    # Active campaign IDs (references to external campaign objects)
    active_campaign_ids_json = Column(Text, default="[]")

    # Full campaign registry with details
    # Shape: list of { id, name, contributionDescription, status, startedAt, endedAt }
    campaign_registry_json = Column(Text, default="[]")

    # ===== CONTINUITY & DERAILMENT SIGNALS =====
    # Continuity signals: metrics indicating progress toward the durable objective
    # Shape: list of { name, measurementApproach, target, currentState }
    continuity_signals_json = Column(Text, default="[]")

    # Derailment signals: warnings that the core mission may be endangered
    # Shape: list of { name, triggerCondition, currentSeverity, mitigationAction }
    derailment_signals_json = Column(Text, default="[]")

    # ===== HISTORY & ADAPTATION =====
    # Entropy events: challenges that forced route corrections
    # Shape: list of { timestamp, category, description, impactedCampaignIds, correctionApplied, continuityPreserved }
    entropy_events_json = Column(Text, default="[]")

    # Revision history: record of changes to this contract
    # Shape: list of { timestamp, revisionType, description, rationale, continuousElements, previousState }
    revision_history_json = Column(Text, default="[]")

    # ===== CURRENT STATUS =====
    # Core continuity status: aligned | strained | drifting | endangered
    continuity_status = Column(String, default="aligned")

    # Rationale for current continuity status
    continuity_status_rationale = Column(Text, default="")

    # ===== RELATIONSHIPS =====
    # Associated master plan IDs (can be multiple if multi-phase)
    # Shape: list of strings, stored as JSON
    master_plan_ids_json = Column(Text, default="[]")

    # Relationship to user
    user = relationship("User", back_populates="core_mission_contracts")


class CoreMissionRevisionLog(Base):
    """
    Immutable log of all changes to CoreMissionContract
    Ensures audit trail of mission evolution
    """
    __tablename__ = "core_mission_revision_logs"

    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(String, ForeignKey("core_mission_contracts.mission_id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # When was this revision recorded
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Type: objective-update | thesis-refinement | campaign-adjustment | tradeoff-decision
    revision_type = Column(String, nullable=False)

    # What changed
    description = Column(Text, nullable=False)

    # Why the change was necessary
    rationale = Column(Text)

    # What stayed constant (list of elements as JSON)
    continuous_elements_json = Column(Text, default="[]")

    # Previous state (snapshot of contract before change)
    previous_state_json = Column(Text)

    # Relationship to mission
    user = relationship("User", back_populates="core_mission_revision_logs")


class EntropyEventLog(Base):
    """
    Log of entropy events that tested mission continuity
    Shows how the system adapted while preserving core objective
    """
    __tablename__ = "entropy_event_logs"

    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(String, ForeignKey("core_mission_contracts.mission_id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # When entropy was observed
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Category of entropy: job-loss, money-pressure, relocation, technical-delay, bad-partners, fatigue, etc
    category = Column(String, nullable=False)

    # Description of what happened
    description = Column(Text, nullable=False)

    # Which campaigns/cycles were affected (list as JSON)
    impacted_campaign_ids_json = Column(Text, default="[]")

    # What adjustment was made in response
    correction_applied = Column(Text)

    # Whether core mission continuity was maintained
    continuity_preserved = Column(Boolean, default=False)

    # Relationship to mission
    user = relationship("User", back_populates="entropy_event_logs")
