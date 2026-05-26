import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.user import User
from app.models.user_calendar import UserCalendarCredential

# Import all models so SQLAlchemy mapper resolves all relationships
import app.models.master_plan  # noqa: F401
import app.models.core_mission_contract  # noqa: F401
import app.models.user_state  # noqa: F401


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def test_user_calendar_credential_model(db):
    user = User(email="cal@test.com", password_hash="x", is_active=True)
    db.add(user)
    db.flush()

    cred = UserCalendarCredential(
        user_id=user.id,
        credential_type="caldav",
        encrypted_payload=b"somebytes",
    )
    db.add(cred)
    db.commit()

    row = db.query(UserCalendarCredential).filter_by(user_id=user.id).first()
    assert row is not None
    assert row.credential_type == "caldav"
    assert row.encrypted_payload == b"somebytes"
