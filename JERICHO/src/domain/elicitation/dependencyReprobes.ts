export const DEPENDENCY_REPROBES = {
  DEPENDENCY_DOWNSTREAM_MISSING: {
    spine: 'Which artifact depends on something else — what is being gated?',
    pickSet: 'declaredNodeOptions',
    examples: {
      musician: 'e.g. Romance Riot tape (the thing that requires the mastered WAV)',
      founder: 'e.g. deployed MVP (the thing that requires the CI pipeline)',
      writer: 'e.g. finished manuscript (the thing that requires the outline)',
      generic: 'e.g. the final report (the thing that requires the data)',
    },
  },
  DEPENDENCY_DOWNSTREAM_UNRESOLVED: {
    spine: "That artifact isn't declared yet — pick from the declared artifacts or declare it first.",
    pickSet: 'declaredNodeOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  DEPENDENCY_UPSTREAM_MISSING: {
    spine: 'What must exist first — what is this artifact blocked on?',
    pickSet: 'declaredNodeOptions',
    examples: {
      musician: 'e.g. mastered WAV (the prerequisite the tape needs before it can go live)',
      founder: 'e.g. CI pipeline (must be green before the MVP deploys)',
      writer: 'e.g. approved outline (must be signed off before drafting begins)',
      generic: 'e.g. the raw data (must be collected before the report can be written)',
    },
  },
  DEPENDENCY_SELF_EDGE: {
    spine: 'An artifact cannot depend on itself — pick a different prerequisite.',
    pickSet: 'declaredNodeOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  DEPENDENCY_UPSTREAM_UNRESOLVED: {
    spine: "That prerequisite isn't declared yet — pick from the declared artifacts or declare it first.",
    pickSet: 'declaredNodeOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  DEPENDENCY_CYCLE: {
    spine: 'That would create a circular dependency — pick a prerequisite that is not already downstream of this artifact.',
    pickSet: 'declaredNodeOptions',
    examples: {
      musician: 'e.g. if A needs B and B needs C, you cannot make C need A',
      founder: 'e.g. the pipeline cannot depend on the MVP if the MVP already depends on the pipeline',
      writer: 'e.g. the outline cannot require the chapter if the chapter already requires the outline',
      generic: 'e.g. pick any artifact not already reachable from this one by following REQUIRES edges',
    },
  },
  DEPENDENCY_TYPE_MISSING: {
    spine: 'What kind of dependency is this — hard gate, directional pull, or informational link?',
    pickSet: 'dependencyTypeOptions',
    examples: {
      musician: 'hard_gate: tape cannot go live without the WAV; directional: album informs the visual style',
      founder: 'hard_gate: MVP blocks on CI; directional: user research informs the spec',
      writer: 'hard_gate: draft blocked until outline approved; directional: prior chapter informs the next',
      generic: 'hard_gate: output blocked until input exists; informational: awareness only',
    },
  },
};
