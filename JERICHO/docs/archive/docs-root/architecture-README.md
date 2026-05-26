# Architecture Documentation

This section contains the technical architecture and design specifications for
JERICHO.

## 🏛️ System Architecture

### Core Components

- **[Execution Plan](EXECUTION_PLAN.md)** - High-level system design and
  implementation steps
- **[UI Authority Map](UI_AUTHORITY_MAP.md)** - UI component authority and
  interaction patterns
- **[Probability Authority Map](PROBABILITY_AUTHORITY_MAP.md)** - Probability
  calculations and metrics
- **[MVP3 Audit Notes](MVP3_AUDIT_NOTES.md)** - System audit and architectural
  review

### User Interface Design

- **[UI Audit Report](UI_AUDIT_REPORT.md)** - Comprehensive UI analysis and
  recommendations
- **[Structure Tab Redesign](STRUCTURE_TAB_REDESIGN.md)** - UI component
  redesign specifications

### Core Specifications

- **[Probability Specification](probabilitySpec.md)** - Mathematical models and
  probability calculations

## 🎯 Key Architectural Principles

### 1. Deterministic Design

- All core functions produce identical outputs for identical inputs
- No random number generation in critical paths
- Pure functions for business logic
- Time-zone handling centralized in `src/state/time/time.ts`

### 2. Mechanism-Class-Based Auto-Generation

- Six mechanism classes: CREATE, PUBLISH, MARKET, LEARN, OPS, REVIEW
- Template-based deliverable generation
- Keyword-based goal classification
- Performance requirements: <1ms classification, <5ms generation

### 3. State Management Architecture

- **Single Source of Truth**: Centralized state store
- **Deterministic Computation**: IdentityCompute for derived state
- **Event-Driven**: Immutable execution event ledger
- **Capacity-Based Planning**: User capacity constraints

### 4. Backend Integration Strategy

- **Offline-First**: LocalStorage with gradual server migration
- **API Structure**: RESTful endpoints for auth, goals, blocks, sync
- **Database Schema**: Users, Goals, Cycles, Blocks, Execution events
- **Migration Path**: Preserve existing functionality during transition

## 🏗️ System Layers

```
┌─────────────────────────────────────┐
│           UI Layer (React)          │
│  - StructurePageConsolidated       │
│  - Goal management components       │
│  - Today view and execution UI      │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│        State Management             │
│  - identityStore.js (store)         │
│  - identityCompute.js (computation) │
│  - Time management                  │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│         Core Logic                  │
│  - mechanismClass.ts                │
│  - autoDeliverables.ts             │
│  - Goal contract validation         │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│        Domain Layer                 │
│  - Goal contracts                   │
│  - Block allocation                 │
│  - Execution events                 │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│         Data Layer                  │
│  - LocalStorage (primary)           │
│  - Server API (secondary)           │
│  - PostgreSQL database              │
└─────────────────────────────────────┘
```

## 📊 Data Flow

### Goal Creation to Execution

1. **Goal Definition**
   - User creates goal with contract validation
   - Goal automatically classified via mechanismClass
   - Deadline validated and stored

2. **Plan Generation**
   - Auto-deliverables generated from mechanism class
   - Blocks allocated based on capacity and deadline
   - Proposed blocks stored in state

3. **Plan Execution**
   - User commits to proposed plan
   - Blocks become active in Today view
   - Execution events logged immutably

4. **Progress Tracking**
   - Completion events recorded
   - Progress metrics calculated
   - Success probability updated

## 🔧 Technical Specifications

### Performance Requirements

- **Mechanism Classification**: <1ms per goal
- **Deliverable Generation**: <5ms per goal
- **Plan Generation**: <100ms per goal
- **UI Interactions**: <16ms (60fps)

### Determinism Guarantees

- Same goal text → same mechanism class
- Same goal contract → same deliverables
- Same plan → same block allocation
- All randomness isolated to UI layer

### Testing Architecture

- **Unit Tests**: Individual function validation
- **Integration Tests**: End-to-end workflow testing
- **Performance Tests**: Time-sensitive operation validation
- **Determinism Tests**: Input-output consistency verification

## 🗂️ File Organization

```
src/
├── core/                          # Core business logic
│   ├── mechanismClass.ts          # Goal classification (6 mechanism types)
│   ├── autoDeliverables.ts        # Template-based deliverable generation
│   └── __tests__/                 # Core logic tests (96 tests)
├── components/                    # UI components
│   └── zion/                      # Main UI components
├── state/                         # State management
│   ├── identityStore.js           # Main state store
│   ├── identityCompute.js         # State computation and plan generation
│   └── time/                      # Time management utilities
└── domain/                        # Domain models
    ├── contracts/                 # Goal contract schemas
    ├── blocks/                    # Block allocation logic
    └── execution/                 # Execution event handling
```

## 🔐 Authority Patterns

### UI Authority Map

- Defines which UI components control which state
- Establishes clear boundaries between user actions
- Prevents state conflicts and race conditions

### Probability Authority Map

- Defines calculation methods for success probability
- Establishes metrics for progress tracking
- Provides deterministic probability models

## 📋 Implementation Status

### Completed

- ✅ Mechanism-class auto-generation system
- ✅ Deterministic template-based deliverables
- ✅ Comprehensive test suite (374 tests)
- ✅ Performance optimization
- ✅ UI authority mapping

### In Progress

- 🔄 Backend API integration
- 🔄 Server persistence
- 🔄 Enhanced probability calculations
- 🔄 Advanced UI features

### Planned

- 📋 Multi-language support
- 📋 User-configurable templates
- 📋 Advanced analytics
- 📋 Collaboration features

## 🔍 Design Decisions

### Why Deterministic Design?

- Enables reliable testing and debugging
- Ensures consistent user experience
- Simplifies caching and optimization
- Supports offline-first architecture

### Why Mechanism Classes?

- Reduces cognitive load for users
- Enables template-based automation
- Provides predictable patterns
- Supports scalable goal management

### Why Template-Based Generation?

- Eliminates manual deliverable entry
- Ensures consistent planning quality
- Enables rapid plan generation
- Supports deterministic behavior

## 📚 Related Documentation

- [Development Guide](../development/) - Implementation practices
- [Phase History](../phases/) - Development progression
- [API Documentation](../api/) - Backend specifications

This architecture ensures JERICHO provides deterministic, efficient, and
user-friendly goal planning and execution. 🎯
