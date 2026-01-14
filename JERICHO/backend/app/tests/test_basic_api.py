import pytest
import httpx
from fastapi.testclient import TestClient
from main import app

# Test client setup
client = TestClient(app)


class TestBasicAPI:
    """Test basic API endpoints"""
    
    def test_root_endpoint(self):
        """Test root endpoint returns proper response"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "JERICHO Backend API"
        assert data["status"] == "healthy"
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "version" in data
        assert "environment" in data


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_register_endpoint_exists(self):
        """Test register endpoint exists and returns proper structure"""
        response = client.post("/api/auth/register", json={})
        assert response.status_code in [200, 422]  # 200 if implemented, 422 if validation error
        data = response.json()
        assert "message" in data
    
    def test_login_endpoint_exists(self):
        """Test login endpoint exists and returns proper structure"""
        response = client.post("/api/auth/login", json={})
        assert response.status_code in [200, 422]
        data = response.json()
        assert "message" in data


class TestGoalsEndpoints:
    """Test goals endpoints"""
    
    def test_get_goals_endpoint_exists(self):
        """Test get goals endpoint exists"""
        response = client.get("/api/goals/")
        assert response.status_code in [200, 401]  # 401 if auth required
        data = response.json()
        assert "message" in data
    
    def test_create_goal_endpoint_exists(self):
        """Test create goal endpoint exists"""
        response = client.post("/api/goals/", json={})
        assert response.status_code in [200, 422]
        data = response.json()
        assert "message" in data


class TestBlocksEndpoints:
    """Test blocks endpoints"""
    
    def test_get_blocks_endpoint_exists(self):
        """Test get blocks endpoint exists"""
        response = client.get("/api/blocks/")
        assert response.status_code in [200, 401]
        data = response.json()
        assert "message" in data
    
    def test_create_block_endpoint_exists(self):
        """Test create block endpoint exists"""
        response = client.post("/api/blocks/", json={})
        assert response.status_code in [200, 422]
        data = response.json()
        assert "message" in data


class TestSyncEndpoints:
    """Test synchronization endpoints"""
    
    def test_pull_sync_endpoint_exists(self):
        """Test pull sync endpoint exists"""
        response = client.get("/api/sync/pull")
        assert response.status_code in [200, 401]
        data = response.json()
        assert "message" in data
    
    def test_push_sync_endpoint_exists(self):
        """Test push sync endpoint exists"""
        response = client.post("/api/sync/push", json={})
        assert response.status_code in [200, 422]
        data = response.json()
        assert "message" in data


if __name__ == "__main__":
    pytest.main([__file__])