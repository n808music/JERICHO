# API Documentation

This section contains the API documentation for JERICHO's backend services.

## 🚧 Under Construction

The API documentation is currently under development as we transition from the frontend-only prototype to a full-stack application.

## 📋 Planned API Structure

### Authentication Endpoints

```
/api/auth/*
├── POST /api/auth/login          # User authentication
├── POST /api/auth/register       # User registration
├── POST /api/auth/refresh        # Token refresh
└── POST /api/auth/logout         # User logout
```

### Goal Management

```
/api/goals/*
├── GET    /api/goals            # List user goals
├── POST   /api/goals            # Create new goal
├── GET    /api/goals/:id        # Get specific goal
├── PUT    /api/goals/:id        # Update goal
├── DELETE /api/goals/:id        # Delete goal
└── POST   /api/goals/:id/generate # Generate plan for goal
```

### Block Operations

```
/api/blocks/*
├── GET    /api/blocks           # List blocks (with filters)
├── POST   /api/blocks           # Create block
├── GET    /api/blocks/:id       # Get specific block
├── PUT    /api/blocks/:id       # Update block
├── DELETE /api/blocks/:id       # Delete block
└── POST   /api/blocks/:id/complete # Mark block complete
```

### Data Synchronization

```
/api/sync/*
├── GET    /api/sync/status      # Sync status
├── POST   /api/sync/upload      # Upload local data
├── GET    /api/sync/download    # Download server data
└── POST   /api/sync/resolve     # Resolve sync conflicts
```

### System Health

```
/api/health
├── GET    /api/health           # System health check
├── GET    /api/health/detailed  # Detailed health metrics
└── GET    /api/health/version   # Version information
```

## 🗄️ Database Schema

### Users Table

```sql
users {
  id: UUID PRIMARY KEY
  email: VARCHAR UNIQUE NOT NULL
  password_hash: VARCHAR NOT NULL
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
  metadata: JSONB
}
```

### Goals Table

```sql
goals {
  id: UUID PRIMARY KEY
  user_id: UUID FOREIGN KEY
  goal_contract: JSONB NOT NULL
  mechanism_class: VARCHAR NOT NULL
  deadline_iso: TIMESTAMP
  status: VARCHAR NOT NULL
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

### Cycles Table

```sql
cycles {
  id: UUID PRIMARY KEY
  goal_id: UUID FOREIGN KEY
  strategy: JSONB NOT NULL
  status: VARCHAR NOT NULL
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

### Blocks Table

```sql
blocks {
  id: UUID PRIMARY KEY
  cycle_id: UUID FOREIGN KEY
  title: VARCHAR NOT NULL
  required_blocks: INTEGER NOT NULL
  status: VARCHAR NOT NULL
  scheduled_date: TIMESTAMP
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

### Execution Events Table

```sql
execution_events {
  id: UUID PRIMARY KEY
  block_id: UUID FOREIGN KEY
  event_type: VARCHAR NOT NULL
  timestamp: TIMESTAMP NOT NULL
  metadata: JSONB
}
```

## 🔐 Authentication

### JWT Token Structure

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234567890,
  "scope": ["read:goals", "write:goals", "read:blocks", "write:blocks"]
}
```

### Authorization Scopes

- `read:goals` - Read user goals
- `write:goals` - Create and update goals
- `read:blocks` - Read user blocks
- `write:blocks` - Create and update blocks
- `sync:data` - Synchronize data

## 📊 Response Formats

### Standard Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation completed successfully",
  "timestamp": "2025-01-13T12:00:00Z"
}
```

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid goal contract",
    "details": {
      "field": "deadline_iso",
      "reason": "Date must be in the future"
    }
  },
  "timestamp": "2025-01-13T12:00:00Z"
}
```

## 🚀 Deployment

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/jericho

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# API Configuration
API_BASE_URL=https://api.jericho.app
CORS_ORIGIN=https://jericho.app

# Feature Flags
ENABLE_REGISTRATION=true
SYNC_ENABLED=false
```

### Railway Deployment

```bash
# Deploy to Railway
railway login
railway new
railway up

# Set environment variables
railway variables set DATABASE_URL=...
railway variables set JWT_SECRET=...
```

## 🧪 API Testing

### Test Data Examples

```json
// Goal Contract Example
{
  "goalId": "goal_123",
  "goalText": "Publish my music to Spotify",
  "terminalOutcome": {
    "text": "Music published on Spotify"
  },
  "deadlineISO": "2025-12-31T23:59:59Z",
  "mechanism": "PUBLISH"
}

// Block Example
{
  "id": "block_456",
  "cycleId": "cycle_789",
  "title": "Prepare music for release",
  "requiredBlocks": 4,
  "status": "SCHEDULED",
  "scheduledDate": "2025-01-15T09:00:00Z"
}
```

### Testing Commands

```bash
# Run API tests
pytest tests/api/

# Run integration tests
pytest tests/integration/

# Test with coverage
pytest --cov=app tests/
```

## 📚 Related Documentation

- [Backend README](../../backend/README.md) - Backend setup and configuration
- [Architecture Overview](../architecture/) - System design and technical specs
- [Development Guide](../development/) - Frontend development practices

## 🔄 Migration Strategy

### Phase 1: Dual Storage

- Frontend maintains localStorage as primary
- Backend serves as backup/sync
- Gradual migration of user data

### Phase 2: Backend Primary

- Backend becomes primary data source
- Frontend caching for performance
- Offline mode fallback

### Phase 3: Full Integration

- Complete backend integration
- Advanced features requiring server
- Multi-user functionality

This API documentation will be expanded as the backend implementation progresses. Check back for updates! 🎯
