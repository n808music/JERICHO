import pytest
from app.core.database import get_db, Base, engine
from app.models.user import User, Goal, Cycle, Block, ExecutionEvent
from sqlalchemy.orm import Session


class TestDatabaseModels:
    """Test database models and relationships"""
    
    @pytest.fixture(autouse=True)
    def setup_database(self):
        """Setup test database"""
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        yield
        Base.metadata.drop_all(bind=engine)
    
    @pytest.fixture
    def db_session(self):
        """Get database session for testing"""
        db = next(get_db())
        try:
            yield db
        finally:
            db.close()
    
    def test_user_model_creation(self, db_session):
        """Test User model can be created"""
        user_data = {
            "email": "test@example.com",
            "password_hash": "hashed_password"
        }
        user = User(**user_data)
        db_session.add(user)
        db_session.commit()
        
        retrieved_user = db_session.query(User).filter(User.email == "test@example.com").first()
        assert retrieved_user is not None
        assert retrieved_user.email == "test@example.com"
        assert retrieved_user.password_hash == "hashed_password"
        assert retrieved_user.is_active is True
    
    def test_goal_model_creation(self, db_session):
        """Test Goal model can be created"""
        # First create a user
        user = User(email="test@example.com", password_hash="hash")
        db_session.add(user)
        db_session.commit()
        
        # Then create a goal
        goal_data = {
            "user_id": user.id,
            "title": "Test Goal",
            "goal_execution_contract": '{"test": "contract"}',
            "goal_governance_contract": '{"test": "governance"}',
            "admission_status": "pending"
        }
        goal = Goal(**goal_data)
        db_session.add(goal)
        db_session.commit()
        
        retrieved_goal = db_session.query(Goal).filter(Goal.title == "Test Goal").first()
        assert retrieved_goal is not None
        assert retrieved_goal.user_id == user.id
        assert retrieved_goal.title == "Test Goal"
        assert retrieved_goal.admission_status == "pending"
    
    def test_cycle_model_creation(self, db_session):
        """Test Cycle model can be created"""
        # Create user and goal first
        user = User(email="test@example.com", password_hash="hash")
        db_session.add(user)
        db_session.commit()
        
        goal = Goal(
            user_id=user.id,
            title="Test Goal",
            goal_execution_contract='{}',
            admission_status="admitted"
        )
        db_session.add(goal)
        db_session.commit()
        
        # Then create a cycle
        cycle_data = {
            "user_id": user.id,
            "goal_id": goal.id,
            "status": "active",
            "cycle_data": '{"test": "cycle_data"}'
        }
        cycle = Cycle(**cycle_data)
        db_session.add(cycle)
        db_session.commit()
        
        retrieved_cycle = db_session.query(Cycle).filter(Cycle.goal_id == goal.id).first()
        assert retrieved_cycle is not None
        assert retrieved_cycle.user_id == user.id
        assert retrieved_cycle.goal_id == goal.id
        assert retrieved_cycle.status == "active"
    
    def test_block_model_creation(self, db_session):
        """Test Block model can be created"""
        # Create prerequisites
        user = User(email="test@example.com", password_hash="hash")
        db_session.add(user)
        db_session.commit()
        
        goal = Goal(
            user_id=user.id,
            title="Test Goal",
            goal_execution_contract='{}',
            admission_status="admitted"
        )
        db_session.add(goal)
        db_session.commit()
        
        cycle = Cycle(
            user_id=user.id,
            goal_id=goal.id,
            status="active"
        )
        db_session.add(cycle)
        db_session.commit()
        
        # Create block
        block_data = {
            "user_id": user.id,
            "goal_id": goal.id,
            "cycle_id": cycle.id,
            "day_key": "2026-01-15",
            "practice": "Creation",
            "title": "Test Block",
            "duration_minutes": 60,
            "status": "scheduled",
            "block_data": '{"test": "block_data"}'
        }
        block = Block(**block_data)
        db_session.add(block)
        db_session.commit()
        
        retrieved_block = db_session.query(Block).filter(Block.title == "Test Block").first()
        assert retrieved_block is not None
        assert retrieved_block.user_id == user.id
        assert retrieved_block.goal_id == goal.id
        assert retrieved_block.cycle_id == cycle.id
        assert retrieved_block.day_key == "2026-01-15"
        assert retrieved_block.practice == "Creation"
        assert retrieved_block.status == "scheduled"
    
    def test_execution_event_model_creation(self, db_session):
        """Test ExecutionEvent model can be created"""
        # Create prerequisites
        user = User(email="test@example.com", password_hash="hash")
        db_session.add(user)
        db_session.commit()
        
        goal = Goal(
            user_id=user.id,
            title="Test Goal",
            goal_execution_contract='{}',
            admission_status="admitted"
        )
        db_session.add(goal)
        db_session.commit()
        
        cycle = Cycle(
            user_id=user.id,
            goal_id=goal.id,
            status="active"
        )
        db_session.add(cycle)
        db_session.commit()
        
        block = Block(
            user_id=user.id,
            goal_id=goal.id,
            cycle_id=cycle.id,
            day_key="2026-01-15",
            practice="Creation",
            title="Test Block",
            duration_minutes=60
        )
        db_session.add(block)
        db_session.commit()
        
        # Create execution event
        event_data = {
            "user_id": user.id,
            "cycle_id": cycle.id,
            "event_type": "BLOCK_STARTED",
            "block_id": block.id,
            "event_data": '{"test": "event_data"}',
            "event_hash": "test_hash_123"
        }
        event = ExecutionEvent(**event_data)
        db_session.add(event)
        db_session.commit()
        
        retrieved_event = db_session.query(ExecutionEvent).filter(
            ExecutionEvent.event_type == "BLOCK_STARTED"
        ).first()
        assert retrieved_event is not None
        assert retrieved_event.user_id == user.id
        assert retrieved_event.cycle_id == cycle.id
        assert retrieved_event.block_id == block.id
        assert retrieved_event.event_type == "BLOCK_STARTED"
        assert retrieved_event.event_hash == "test_hash_123"
    
    def test_model_relationships(self, db_session):
        """Test model relationships work correctly"""
        # Create full hierarchy
        user = User(email="test@example.com", password_hash="hash")
        db_session.add(user)
        db_session.commit()
        
        goal = Goal(
            user_id=user.id,
            title="Test Goal",
            goal_execution_contract='{}',
            admission_status="admitted"
        )
        db_session.add(goal)
        db_session.commit()
        
        cycle = Cycle(
            user_id=user.id,
            goal_id=goal.id,
            status="active"
        )
        db_session.add(cycle)
        db_session.commit()
        
        block = Block(
            user_id=user.id,
            goal_id=goal.id,
            cycle_id=cycle.id,
            day_key="2026-01-15",
            practice="Creation",
            title="Test Block",
            duration_minutes=60
        )
        db_session.add(block)
        db_session.commit()
        
        # Test relationships from user
        db_session.refresh(user)
        assert len(user.goals) == 1
        assert len(user.cycles) == 1
        assert len(user.blocks) == 1
        
        # Test relationships from goal
        db_session.refresh(goal)
        assert len(goal.cycles) == 1
        assert len(goal.blocks) == 1
        
        # Test relationships from cycle
        db_session.refresh(cycle)
        assert len(cycle.blocks) == 1
        
        # Test navigation through relationships
        assert user.goals[0].title == "Test Goal"
        assert goal.cycles[0].status == "active"
        assert cycle.blocks[0].title == "Test Block"


if __name__ == "__main__":
    pytest.main([__file__])