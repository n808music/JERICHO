import pytest
from fastapi.testclient import TestClient
import json

from main import app


class TestBasicAuth:
    """Test basic authentication functionality"""
    
    @pytest.fixture
    def client(self):
        """Get test client"""
        return TestClient(app)
    
    def test_register_endpoint_exists(self, client):
        """Test register endpoint exists and returns proper structure"""
        user_data = {
            "email": "test@example.com",
            "password": "testpassword123"
        }
        
        response = client.post("/api/auth/register", json=user_data)
        # Should either succeed (200) or have validation errors (422)
        assert response.status_code in [200, 422]
        
        data = response.json()
        if response.status_code == 200:
            # If successful, should have user data
            assert "id" in data or "email" in data
        else:
            # If validation error, should have error details
            assert "detail" in data
    
    def test_login_endpoint_exists(self, client):
        """Test login endpoint exists and returns proper structure"""
        login_data = {
            "email": "test@example.com",
            "password": "testpassword123"
        }
        
        response = client.post("/api/auth/login", json=login_data)
        # Should either succeed (200) or have validation/auth errors (401, 422)
        assert response.status_code in [200, 401, 422]
        
        data = response.json()
        if response.status_code == 200:
            # If successful, should have token data
            assert "access_token" in data or "detail" in data
        else:
            # If error, should have error details
            assert "detail" in data
    
    def test_protected_endpoint_structure(self, client):
        """Test protected endpoint has proper response structure"""
        # Test without token
        response = client.get("/api/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "not authenticated" in data["detail"].lower()
    
    def test_health_check_with_auth(self, client):
        """Test health check works with auth system"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "version" in data


if __name__ == "__main__":
    pytest.main([__file__])