from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class UserCalendarCredential(Base):
    __tablename__ = "user_calendar_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    credential_type = Column(String, nullable=False)  # "google" | "caldav"
    encrypted_payload = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (UniqueConstraint("user_id", "credential_type", name="uq_user_cred_type"),)

    user = relationship("User", back_populates="calendar_credentials")
