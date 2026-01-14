# JERICHO

**Deterministic Goal Planning & Execution System**

A production-ready goal planning system that transforms high-level objectives into executable, time-bound plans through deterministic auto-generation and mechanism-class-based templates.

## 🚀 Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd JERICHO

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests (374 tests passing)
npm test
```

## 📋 What is JERICHO?

JERICHO is a goal planning system that automatically generates executable plans from user goals without requiring manual task entry. The system uses:

- **Mechanism-Class Auto-Generation**: Automatically categorizes goals into 6 types (CREATE, PUBLISH, MARKET, LEARN, OPS, REVIEW)
- **Deterministic Templates**: Pre-built deliverable templates for each goal type
- **Time-Block Allocation**: Automatic scheduling with capacity-based planning
- **Zero-Input Planning**: "Regenerate Route" produces complete plans without manual deliverable entry

## 🏗️ Architecture

### Frontend (React/Vite)

- **UI**: React with Tailwind CSS, Balenciaga-inspired theme
- **State Management**: Custom store with deterministic state computation
- **Testing**: Vitest with 374 passing tests across 89 test files

### Backend (Python/FastAPI)

- **API**: FastAPI with PostgreSQL database
- **Authentication**: JWT (migrating to Supabase)
- **Deployment**: Railway-compatible

### Core Features

- **Goal Contracts**: Structured goal definitions with validation
- **Auto-Deliverables**: Template-based deliverable generation
- **Block Scheduling**: Time-bound work units with capacity planning
- **Execution Tracking**: Immutable event ledger for progress monitoring

## 📖 Documentation

### 🚀 For New Users

- [Getting Started Guide](docs/development/SETUP.md) - Installation and first steps
- [User Guide](docs/user/USER_GUIDE.md) - How to use JERICHO effectively

### 👨‍💻 For Developers

- [Developer Setup](docs/development/SETUP.md) - Development environment setup
- [Contributing Guidelines](docs/development/CONTRIBUTING.md) - How to contribute
- [Testing Guide](docs/development/TESTING.md) - Testing practices and patterns

### 🏛️ Technical Architecture

- [System Architecture](docs/architecture/EXECUTION_PLAN.md) - High-level system design
- [Authority Maps](docs/architecture/) - UI and Probability authority mappings
- [Mechanism Classes](docs/phases/PHASE_2_IMPLEMENTATION_SUMMARY.md) - Auto-generation system
- [API Documentation](docs/api/) - Backend API reference

### 📊 Project Status

- [Implementation Phases](docs/phases/) - Development history and progress
- [Bug Fixes](docs/phases/) - Resolution tracking and analysis

## 🎯 Key Features

### Auto-Generation System

- **6 Mechanism Classes**: CREATE, PUBLISH, MARKET, LEARN, OPS, REVIEW
- **Deterministic Templates**: Same goal always produces identical plans
- **Zero-Input Planning**: Click "Regenerate Route" → get executable plan
- **Performance**: <1ms mechanism detection, <5ms deliverable generation

### Planning & Execution

- **Capacity-Based Scheduling**: Respects user's available time
- **Deadline-Aware**: Automatically allocates blocks based on goal deadlines
- **Progress Tracking**: Immutable execution event ledger
- **Offline-First**: LocalStorage with gradual server migration

### Testing & Quality

- **374 Passing Tests**: Comprehensive test coverage
- **Deterministic Validation**: Tests verify no randomness in outputs
- **Integration Testing**: End-to-end flows for all mechanism types
- **Performance Testing**: Validates <500ms for 100 plan generations

## 🔄 Workflow Example

1. **Create Goal**: "Publish my music to Spotify"
2. **Auto-Classify**: System detects "PUBLISH" mechanism class
3. **Generate Deliverables**: 4 deliverables created automatically
   - Prepare music for release (4 blocks)
   - Create release materials (4 blocks)
   - Deploy music (2 blocks)
   - Monitor & support launch (4 blocks)
4. **Schedule Blocks**: 14 total blocks allocated across deadline period
5. **Execute**: Work through blocks in Today view
6. **Track**: Progress automatically logged to execution ledger

## 🛠️ Tech Stack

### Frontend

- **React 19.2.1** - UI framework
- **Vite 7.2.6** - Build tool and dev server
- **Tailwind CSS 3.4.14** - Styling framework
- **Vitest 4.0.15** - Testing framework

### Backend

- **Python FastAPI** - API framework
- **PostgreSQL** - Database with JSONB support
- **SQLAlchemy** - ORM
- **JWT** - Authentication

### Infrastructure

- **Railway** - Deployment platform
- **Supabase** - Planned authentication upgrade

## 📊 Project Status

- ✅ **Phase 1**: Auto-strategy foundation
- ✅ **Phase 2**: Mechanism-class auto-generation (96 new tests)
- 🔄 **Phase 3**: UI hardening and execution optimization
- 📋 **Phase 4**: Backend integration and server persistence

**Current Test Coverage**: 374 tests, 89 test files, all passing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

See [Contributing Guidelines](docs/development/CONTRIBUTING.md) for detailed instructions.

## 📄 License

[Add your license information here]

## 🔗 Links

- [Frontend Repository](https://github.com/your-org/jericho-frontend)
- [Backend Repository](https://github.com/your-org/jericho-backend)
- [Live Demo](https://jericho-demo.app)
- [Documentation](https://docs.jericho.app)
