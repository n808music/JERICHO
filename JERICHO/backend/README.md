# JERICHO Backend

Production-ready backend infrastructure for JERICHO goal planning system.

## Quick MVP Implementation (1-2 weeks)

### Tech Stack

- **Backend**: Python FastAPI
- **Database**: PostgreSQL with JSONB
- **Auth**: JWT (upgrade to Supabase later)
- **Deployment**: Railway
- **ORM**: SQLAlchemy

### API Structure

```
/api/auth/*        - Authentication endpoints
/api/goals/*       - Goal management & planning
/api/blocks/*      - Block operations & execution
/api/sync/*        - Data synchronization
/api/health        - System health check
```

### Database Schema

- Users (authentication + metadata)
- Goals (contracts + validation)
- Cycles (goal lifecycles)
- Blocks (work units + execution)
- Execution events (immutable ledger)

### Migration Strategy

1. Preserve localStorage functionality
2. Gradual migration to server persistence
3. Maintain offline-first capabilities
