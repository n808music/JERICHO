# D2 — Organizational Architecture Intake

## Status

Planned upstream follow-up to the D1 initiative-aware projection bridge.

This milestone exists because the current Operation Endgame plan proved that
Jericho can generate a structurally strong long-horizon schedule before it has
fully normalized the user's underlying business architecture.

D1 remains valid as a downstream projection repair. D2 is the upstream fix.

---

## Objective

Require Jericho to organize a multi-entity goal's internal business reality
before full-horizon master-plan generation.

The product should not jump directly from chaotic multi-company or
multi-project goal text into generic operating lanes when the architecture is
still ambiguous.

The doctrine is:

```text
umbrella -> companies/divisions -> initiatives -> products/services -> deadlines -> lanes -> milestones -> blocks
```

Jericho should not only schedule a goal. It should first organize the goal's
internal reality well enough to schedule it correctly.

---

## Why This Exists

The current engine already understands useful operating categories:

```text
product/software
creative project
media/content
company/operations
income stream
capital/real-estate
institution/education
civic/district
```

Those are valid lane classes, but they are not the user's actual business
architecture.

For a goal like Operation Endgame, the user is not experiencing "media/content
lane" in the abstract. The user is experiencing named ventures such as:

```text
Help Yourself Podcast
BLACKMAN
D8 N8
Romance Riot
Jericho System
Global State Solutions
F8 ENERGY GUM
79th Street Real Estate
Institution / School
```

Without an upstream architecture pass, Jericho can produce mechanically valid
plans that still feel partially generic.

---

## Required Model

Add a normalized architecture object before long-horizon generation when the
goal contains multiple entities, companies, products, or projects.

Candidate model:

```ts
type OrganizationalArchitecture = {
  umbrellaName?: string;
  entities: Array<{
    id: string;
    name: string;
    type:
      | 'umbrella'
      | 'company'
      | 'division'
      | 'brand'
      | 'project'
      | 'product'
      | 'service'
      | 'institution'
      | 'real_estate'
      | 'content_series'
      | 'music_release'
      | 'technology_product';
    parentId?: string;
    lane?: string;
    status: 'active' | 'incubating' | 'future' | 'paused';
    productsOrServices?: string[];
    deadlines?: Array<{
      label: string;
      date: string;
      type: 'launch' | 'release' | 'filing' | 'funding' | 'milestone';
    }>;
    dependencies?: string[];
  }>;
};
```

The exact schema can evolve, but the product must preserve:

```text
umbrella
company/division
initiative
product/service
deadline/milestone
lane assignment
active/incubating/future status
dependency relationships
```

---

## Intake Questions

When a goal description suggests multiple businesses, ventures, products, or
content properties, Jericho should ask to normalize the structure before
generating a five-year plan.

Minimum question set:

```text
What is the umbrella name?
Which of these are companies, products, projects, or content properties?
Which are active now?
Which are future or incubating?
Which have deadlines?
Which should receive schedule lanes?
Which are support dependencies only?
```

The system should infer when possible, but it must confirm when confidence is
insufficient.

---

## Operation Endgame Reference Shape

The normalized architecture for Operation Endgame is closer to:

```text
Umbrella / ecosystem:
Global State

Companies / divisions:

1. Global State Solutions
   Project management / operations consulting

2. Global State Productions
   Media / TV / film / marketing
   Projects:
   - Help Yourself Podcast
   - The Imaginary CEO Season 1
   - Our Fearless Leader
   - State of Control
   - BLACKMAN
   - D8 N8

3. Global State Corp.
   Music / merch / shows / tours
   Projects:
   - Romance Riot
   - N8 artist releases

4. Global State Systems
   Technology company
   Projects:
   - Jericho System
   - Executable Schedule Standard

5. Global State Holdings
   Real estate / 79th Street corridor / headquarters

6. Global State Academy
   Private school / institution model

7. F8 Energy
   Energy gum product company
```

This structure should coexist with lanes, not replace them:

```text
Company: Global State Productions
Initiative: Help Yourself Podcast
Lane: Media / Content
Block: Plan content pipeline proof sequence
```

---

## Milestones

### D1 — Initiative-Aware Projection Bridge

Purpose:

```text
Improve initiative labels for the current approved Operation Endgame plan where confidence is high.
```

Scope:

```text
registry + projection + display only
```

Not sufficient as final intake architecture.

### D2 — Organizational Architecture Intake

Purpose:

```text
Normalize umbrella/company/initiative/product structure before future multi-entity long-horizon generation.
```

### D3 — Architecture-Aware Plan Labels

Purpose:

```text
Use normalized architecture metadata when naming lanes, initiatives, blocks, milestones, filters, and exports.
```

---

## Acceptance Criteria

PASS when:

```text
If a goal mentions multiple businesses/projects/products, Jericho creates or asks to confirm an organizational architecture before full-horizon schedule generation.
```

FAIL when:

```text
Jericho jumps directly from multi-entity goal text to generic lanes without resolving company/project names.
```

---

## Non-Goals

This milestone should not:

```text
- rewrite the current Operation Endgame generator in-place
- block simple single-entity goals behind excessive intake
- replace lanes with initiative names
- hardcode Operation Endgame into the generic scheduling engine
```

---

## Next Implementation Order

```text
1. Finish and commit D1 as a projection bridge.
2. Build organizational architecture intake schema and confirmation flow.
3. Gate future multi-entity master-plan generation on normalized architecture.
4. Reconcile labels, exports, and filters against architecture metadata.
```
