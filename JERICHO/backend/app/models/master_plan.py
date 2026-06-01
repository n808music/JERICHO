from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class MasterPlan(Base):
    __tablename__ = "master_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # JS id stored for client reconciliation (e.g. "masterplan-<uuid>")
    client_id = Column(String, unique=True, index=True, nullable=False)
    profile_id = Column(String, nullable=False, index=True)

    title = Column(String, nullable=False)
    status = Column(String, nullable=False, default="draft")  # draft|active|complete|archived
    north_star_outcome = Column(Text, nullable=False)

    horizon_start = Column(String)  # ISO date string
    horizon_end = Column(String)    # ISO date string

    # Anchors are first-class and few enough to embed as JSON.
    # Shape: list of { id, date, label, isFixed, affectedLaneIds, priority }
    anchors_json = Column(Text, default="[]")

    # Financial constraint — conversational, not clinical.
    # Shape: { exists, urgency, notes }
    financial_constraint_json = Column(Text, default="{}")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="master_plans")
    lanes = relationship("MasterPlanLane", back_populates="master_plan", cascade="all, delete-orphan")


class MasterPlanLane(Base):
    __tablename__ = "master_plan_lanes"

    id = Column(Integer, primary_key=True, index=True)
    master_plan_id = Column(Integer, ForeignKey("master_plans.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    client_id = Column(String, unique=True, index=True, nullable=False)

    title = Column(String, nullable=False)
    domain = Column(String, nullable=False)  # creative|product|brand|income|media
    role = Column(String, nullable=False)    # proof-artifact|attention-engine|...

    activation_state = Column(String, nullable=False, default="incubating")  # active|incubating|parked

    # System assessment — user description is input, assessed_stage is conclusion
    user_description = Column(Text, default="")
    assessed_stage = Column(String, default="")
    assessed_confidence = Column(String, default="low")  # high|medium|low
    assessment_notes = Column(Text, default="")

    capital_required = Column(Boolean, default=False)
    legal_required = Column(Boolean, default=False)

    lane_start = Column(String)  # ISO date string
    lane_end = Column(String)    # ISO date string

    # Ordered list of anchor ids this lane feeds into
    anchor_ids_json = Column(Text, default="[]")

    # Ordered list of lane ids this lane depends on
    depends_on_lane_ids_json = Column(Text, default="[]")

    # Requirements embedded as JSON — small list per lane, no need for a separate table.
    # Shape: list of { id, description, requirementType, scheduledAction,
    #                  completionQuestion, status, blocksProgress }
    requirements_json = Column(Text, default="[]")

    # Ordered milestone ids (references master_plan_milestones.client_id)
    milestone_ids_json = Column(Text, default="[]")

    # Derived — not user-entered
    priority_score = Column(Integer, default=0)

    master_plan = relationship("MasterPlan", back_populates="lanes")
    milestones = relationship("MasterPlanMilestone", back_populates="lane", cascade="all, delete-orphan")


class MasterPlanMilestone(Base):
    __tablename__ = "master_plan_milestones"

    id = Column(Integer, primary_key=True, index=True)
    lane_id = Column(Integer, ForeignKey("master_plan_lanes.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    client_id = Column(String, unique=True, index=True, nullable=False)
    anchor_id = Column(String)  # client anchor id, nullable for internal milestones

    title = Column(String, nullable=False)
    description = Column(Text, default="")

    milestone_type = Column(String, nullable=False, default="checkpoint")  # gate|checkpoint|anchor
    target_date = Column(String, nullable=False)   # ISO date — always backward from anchor
    derived_from = Column(String, nullable=False)  # audit trail e.g. "anchorId:oct17 - 6 weeks"

    flex = Column(String, nullable=False, default="low")  # none|low|high
    status = Column(String, nullable=False, default="pending")

    # Requirement ids that must close before this milestone completes
    requirement_ids_json = Column(Text, default="[]")

    miss_consequence = Column(Text, default="")
    origin = Column(String, nullable=False, default="system")  # system|user

    # Only set when origin === "user"
    # Shape: { milestoneType, flex, missConsequence }
    user_weight_json = Column(Text)

    lane = relationship("MasterPlanLane", back_populates="milestones")
