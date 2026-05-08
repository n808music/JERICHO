# JERICHO Documentation

Welcome to the comprehensive documentation for JERICHO, a deterministic goal
planning and execution system.

## 🚀 Quick Navigation

### 👨‍💻 For Developers

- **[Getting Started](development/SETUP.md)** - Install and setup development
  environment
- **[Contributing](development/CONTRIBUTING.md)** - How to contribute to the
  project
- **[Testing Guide](development/TESTING.md)** - Testing practices and
  requirements

### 🏛️ Technical Architecture

- **[System Architecture](architecture/README.md)** - High-level system design
- **[Execution Plan](architecture/EXECUTION_PLAN.md)** - Implementation roadmap
- **[Authority Maps](architecture/)** - UI and Probability authority patterns

### 📊 Project Progress

- **[Implementation History](phases/README.md)** - Complete development history
- **[Phase 2 Implementation](phases/PHASE_2_IMPLEMENTATION_SUMMARY.md)** -
  Auto-generation system

### 🔌 API Documentation

- **[Backend API](api/README.md)** - REST API specification (in development)

## 📋 Documentation Structure

```
docs/
├── development/           # Developer guides and practices
│   ├── SETUP.md          # Development environment setup
│   ├── CONTRIBUTING.md   # Contribution guidelines
│   ├── TESTING.md        # Testing practices and requirements
│   └── README.md         # Development documentation index
├── architecture/         # System architecture and design
│   ├── README.md         # Architecture overview
│   ├── EXECUTION_PLAN.md # Implementation roadmap
│   ├── UI_AUTHORITY_MAP.md # UI component authority
│   ├── PROBABILITY_AUTHORITY_MAP.md # Probability calculations
│   ├── MVP3_AUDIT_NOTES.md # System audit findings
│   ├── UI_AUDIT_REPORT.md # UI analysis and recommendations
│   ├── STRUCTURE_TAB_REDESIGN.md # UI redesign specifications
│   └── probabilitySpec.md # Mathematical models and specifications
├── phases/              # Development history and progress
│   ├── README.md        # Phase overview and summary
│   ├── PHASE_2_IMPLEMENTATION_SUMMARY.md # Phase 2 complete implementation
│   ├── PHASE_2_QUICK_REFERENCE.md # Phase 2 quick guide
│   ├── TASK_5_STORE_WIRING_SUMMARY.md # State management integration
│   ├── DEADLINE_INVALID_FIX_SUMMARY.md # Deadline fix analysis
│   ├── DEADLINE_INVALID_FIX_QUICK_REFERENCE.md # Deadline fix guide
│   ├── DEADLINE_INVALID_FIX_CHECKLIST.md # Implementation checklist
│   ├── QUICK_STATUS.md # Current project status
│   ├── PHASE_3_FINAL_STATE.md # Phase 3 final state
│   ├── PHASE_3_PROGRESS.md # Phase 3 progress tracking
│   ├── PHASE_3_TASKS_6_8_COMPLETION.md # Task completion status
│   ├── IMPLEMENTATION_AUTO_STRATEGY.md # Auto-generation strategy
│   ├── UI_REDUCTION_LIST.md # UI simplification plans
│   └── TESTING_HARDENING_SUMMARY.md # Testing improvements
└── api/                 # API documentation
    ├── README.md        # API overview and roadmap
    └── [future files]   # Detailed API specifications
```

## 🎯 Key Concepts

### Mechanism Classes

JERICHO automatically classifies goals into 6 mechanism types:

- **CREATE**: Building new things (software, products, content)
- **PUBLISH**: Releasing content/software (music, apps, articles)
- **MARKET**: Marketing and growth initiatives (user acquisition, sales)
- **LEARN**: Learning and skill development (languages, technologies)
- **OPS**: Operations and infrastructure (CI/CD, monitoring)
- **REVIEW**: Analysis, audit, and optimization (code review, process
  improvement)

### Deterministic Design

All core logic is deterministic:

- Same goal text → same mechanism classification
- Same goal contract → same deliverable set
- Same plan → same block allocation
- No random numbers or API calls in critical paths

### Auto-Generation System

Click "Regenerate Route" and get:

1. **Goal Classification**: Automatic mechanism detection (<1ms)
2. **Deliverable Generation**: Template-based deliverable creation (<5ms)
3. **Block Allocation**: Time-based scheduling with capacity constraints
4. **Executable Plan**: Ready-to-execute blocks in Today view

## 📊 Current Status

### Development Phase

- **Phase 1**: ✅ Auto-strategy foundation (278 tests)
- **Phase 2**: ✅ Mechanism-class auto-generation (+96 tests = 374 total)
- **Phase 3**: 🔄 UI hardening and execution optimization
- **Phase 4**: 📋 Backend integration and server persistence

### Test Coverage

- **Total Tests**: 374 passing tests
- **Test Files**: 89 test files
- **Coverage**: 100% (statements, branches, functions, lines)
- **Performance**: All benchmarks met

### Key Features Implemented

- ✅ Deterministic goal classification
- ✅ Template-based deliverable generation
- ✅ Zero-input plan generation
- ✅ Capacity-based scheduling
- ✅ Performance optimization
- ✅ Comprehensive testing

## 🔧 Technical Stack

### Frontend

- **React 19.2.1** - UI framework
- **Vite 7.2.6** - Build tool and dev server
- **Tailwind CSS 3.4.14** - Styling framework
- **Vitest 4.0.15** - Testing framework

### Backend (Planned)

- **Python FastAPI** - API framework
- **PostgreSQL** - Database with JSONB
- **SQLAlchemy** - ORM
- **JWT** - Authentication

## 🚀 Quick Start

```bash
# Clone repository
git clone <repository-url>
cd JERICHO

# Install dependencies
npm install

# Start development
npm run dev

# Run tests
npm test
```

## 📚 Learning Path

### New Contributors

1. Read the [main README](../README.md) for project overview
2. Follow the [Setup Guide](development/SETUP.md) for environment setup
3. Review [Contributing Guidelines](development/CONTRIBUTING.md) for development
   practices
4. Study [Testing Guide](development/TESTING.md) for testing requirements

### Understanding Architecture

1. Start with [Architecture Overview](architecture/README.md)
2. Review [Execution Plan](architecture/EXECUTION_PLAN.md) for roadmap
3. Study [Authority Maps](architecture/) for system patterns
4. Check [Probability Specification](architecture/probabilitySpec.md) for
   mathematical models

### Implementation History

1. Read [Phase Overview](phases/README.md) for development context
2. Study [Phase 2 Implementation](phases/PHASE_2_IMPLEMENTATION_SUMMARY.md) for
   current system
3. Review [Bug Fixes](phases/DEADLINE_INVALID_FIX_SUMMARY.md) for problem
   resolution
4. Check [Progress Tracking](phases/QUICK_STATUS.md) for current status

## 🔍 Finding Information

### By Role

- **Developers**: Start with [Development](development/) section
- **Architects**: Start with [Architecture](architecture/) section
- **Contributors**: Start with
  [Contributing Guidelines](development/CONTRIBUTING.md)
- **Testers**: Start with [Testing Guide](development/TESTING.md)

### By Topic

- **Setup & Installation**: [Development Setup](development/SETUP.md)
- **Code Structure**:
  [Project Structure](development/SETUP.md#project-structure)
- **Testing**: [Testing Guide](development/TESTING.md)
- **API**: [API Documentation](api/)
- **Architecture**: [Architecture Documentation](architecture/)
- **History**: [Phase Documentation](phases/)

## 🤝 Getting Help

- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions and share ideas
- **Documentation**: Check existing docs first
- **Code Reviews**: Review test files for usage examples

## 📝 Contributing to Documentation

Documentation is a living part of the project. To contribute:

1. **Fix Issues**: Correct typos, clarify explanations, fix broken links
2. **Add Content**: Document new features, add examples, improve guides
3. **Update**: Keep documentation current with code changes
4. **Review**: Help others improve their documentation contributions

See [Contributing Guidelines](development/CONTRIBUTING.md) for detailed
instructions.

---

This documentation provides comprehensive guidance for understanding,
developing, and contributing to JERICHO. Navigate using the section links above
or use the table of contents in each document. 🎯
