import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import json

from main import app
from app.core.database import get_db, Base, engine
from app.models.user import User


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
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
    
    @pytest.fixture
    def client(self):
        """Get test client"""
        return TestClient(app)
    
    def test_register_user_success(self, client, db_session):
        """Test successful user registration"""
        user_data = {
            "email": "test@example.com",
            "password": "testpassword123"
        }
        
        response = client.post("/api/auth/register", json=user_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["email"] == "test@example.com"
        assert data["is_active"] is True
        
        # Verify user was created in database
        user = db_session.query(User).filter(User.email == "test@example.com").first()
        assert user is not None
        assert user.email == "test@example.com"
    
    def test_register_duplicate_email(self, client):
        """Test registration with duplicate email"""
        # First registration
        user_data = {
            "email": "test@example.com",
            "password": "testpassword123"
        }
        client.post("/api/auth/register", json=user_data)
        
        # Second registration with same email
        response = client.post("/api/auth/register", json=user_data)
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "already registered" in data["detail"].lower()
    
    def test_login_success(self, client, db_session):
        """Test successful user login"""
        # First register a user
        user_data = {
            "email": "test@example.com",
            "password": "testpassword123"
        }
        client.post("/api/auth/register", json=user_data)
        
        # Then login
        login_data = {
            "email": "test@example.com",
            "password": "testpassword123"
        }
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
    
    def test_login_wrong_password(self, client):
        """Test login with wrong password"""
        # First register a user
        user_data = {
            "email": "test@example.com",
            "password": "testpassword123"
        }
        client.post("/api/auth/register", json=user_data)
        
        # Then login with wrong password
        login_data = {
            "email": "test@example.com",
            "password": "wrongpassword"
        }
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "incorrect" in data["detail"].lower()
    
    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user"""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "somepassword"
        }
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "incorrect" in data["detail"].lower()
    
    def test_protected_endpoint_without_token(self, client):
        """Test accessing protected endpoint without token"""
        response = client.get("/api/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "not authenticated" in data["detail"].lower()
    
    def test_protected_endpoint_with_valid_token(self, client):
        """Test accessing protected endpoint with valid token"""
        # First register and login
        user_data = {
            "email": "test@example.com",
            "password": "testpassword123"
        }
        client.post("/api/auth/register", json=user_data)
        
        login_data = {
            "email": "test@example.com",
            "password": "testpassword123"
        }
        login_response = client.post("/api/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        
        # Then access protected endpoint
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["is_active"] is True
    
    def test_protected_endpoint_with_invalid_token(self, client):
        """Test accessing protected endpoint with invalid token"""
        headers = {"Authorization": "Bearer invalid_token_123"}
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "validate" in data["detail"].lower()
    
    def test_token_refresh(self, client):
        """Test token refresh endpoint"""
        # First register and login
        user_data = {
            "email": "test@example.com",
            "password": "testpassword123"
        }
        client.post("/api/auth/register", json=user_data)
        
        login_data = {
            "email": "test@example.com",
            "password": "testpassword123"
        }
        login_response = client.post("/api/auth/login", json=login_data)
        initial_token = login_response.json()["access_token"]
        
        # Then refresh token
        headers = {"Authorization": f"Bearer {initial_token}"}
        response = client.post("/api/auth/refresh", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["access_token"] != initial_token  # New token should be different


if __name__ == "__main__":
    pytest.main([__file__])