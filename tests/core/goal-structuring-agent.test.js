/**
 * Tests for Goal Structuring Agent
 */

describe('Goal Structuring Agent', () => {
  let structureGoal, confirmGoalStructure;

  beforeAll(async () => {
    const module = await import('../../src/core/goal-structuring-agent.js');
    structureGoal = module.structureGoal;
    confirmGoalStructure = module.confirmGoalStructure;
  });

  it('should resolve VentureLaunch family from product launch input', () => {
    const rawInputs = {
      goalDescription: 'Launch a new SaaS product for project management',
      desiredOutcome: 'Have 100 paying customers',
      timeframeSense: 'in 6 months',
      priorityLevel: 'high',
      currentStatus: 'not started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('VentureLaunch');
    expect(result.normalizedPayload.goalSubtype).toBe('SaaS Product Launch');
    expect(result.normalizedPayload.priorityLevel).toBe('HIGH');
    expect(result.normalizedPayload.currentStatus).toBe('NOT_STARTED');
  });

  it('should resolve SkillAcquisition family from learning input', () => {
    const rawInputs = {
      goalDescription: 'Learn React and Node.js',
      desiredOutcome: 'Build full-stack web applications',
      timeframeSense: 'in 3 months',
      priorityLevel: 'medium',
      currentStatus: 'started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('SkillAcquisition');
    expect(result.normalizedPayload.goalSubtype).toBe('Software Skill Acquisition');
  });

  it('should resolve ProfessionalQualification from certification input', () => {
    const rawInputs = {
      goalDescription: 'Get AWS Solutions Architect certification',
      desiredOutcome: 'Pass the exam',
      timeframeSense: 'by April',
      priorityLevel: 'high',
      currentStatus: 'in progress'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('ProfessionalQualification');
    expect(result.normalizedPayload.goalSubtype).toBe('Certification Exam');
  });

  it('should resolve PhysicalTraining from fitness input', () => {
    const rawInputs = {
      goalDescription: 'Lose 20 pounds and build muscle',
      desiredOutcome: 'Get to 180 pounds with visible abs',
      timeframeSense: 'by summer',
      priorityLevel: 'medium',
      currentStatus: 'started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('PhysicalTraining');
    expect(result.normalizedPayload.goalSubtype).toBe('Weight Loss / Body Composition');
  });

  it('should resolve JobSearchPipeline from job search input', () => {
    const rawInputs = {
      goalDescription: 'Find a new job as a software engineer',
      desiredOutcome: 'Get hired at a great company',
      timeframeSense: 'in 2 months',
      priorityLevel: 'high',
      currentStatus: 'not started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('JobSearchPipeline');
    expect(result.normalizedPayload.goalSubtype).toBe('Corporate Role Search');
  });

  it('should resolve CreativeProduction from content creation input', () => {
    const rawInputs = {
      goalDescription: 'Start a podcast about technology',
      desiredOutcome: 'Have 1000 listeners per episode',
      timeframeSense: 'this year',
      priorityLevel: 'medium',
      currentStatus: 'started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('CreativeProduction');
    expect(result.normalizedPayload.goalSubtype).toBe('Podcast Production');
  });

  it('should resolve BrandLaunch from brand building input', () => {
    const rawInputs = {
      goalDescription: 'Build a personal brand as a tech thought leader',
      desiredOutcome: 'Have 10k followers and speaking opportunities',
      timeframeSense: 'in 6 months',
      priorityLevel: 'high',
      currentStatus: 'not started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('BrandLaunch');
    expect(result.normalizedPayload.goalSubtype).toBe('Personal Brand Launch');
  });

  it('should resolve SalesPipeline from sales input', () => {
    const rawInputs = {
      goalDescription: 'Build a sales pipeline for consulting services',
      desiredOutcome: 'Close $50k in deals this quarter',
      timeframeSense: 'in 3 months',
      priorityLevel: 'high',
      currentStatus: 'started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('SalesPipeline');
    expect(result.normalizedPayload.goalSubtype).toBe('B2B Service Sales');
  });

  it('should resolve Fundraising from money raising input', () => {
    const rawInputs = {
      goalDescription: 'Raise seed funding for my startup',
      desiredOutcome: 'Get $250k from investors',
      timeframeSense: 'in 6 months',
      priorityLevel: 'high',
      currentStatus: 'not started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('Fundraising');
    expect(result.normalizedPayload.goalSubtype).toBe('Seed Round Raise');
  });

  it('should handle confirmation correctly', () => {
    const payload = {
      goalId: 'test-123',
      confirmationStatus: 'PENDING'
    };

    const confirmed = confirmGoalStructure(payload, 'correct');
    expect(confirmed.confirmationStatus).toBe('CONFIRMED');

    const rejected = confirmGoalStructure(payload, 'start_over');
    expect(rejected.confirmationStatus).toBe('REJECTED');
    expect(rejected.errorCode).toBe('CONFIRMATION_REJECTED');
  });

  it('should produce valid normalized payload schema', () => {
    const rawInputs = {
      goalDescription: 'Launch a mobile app',
      desiredOutcome: '1000 downloads',
      timeframeSense: 'in 4 months',
      priorityLevel: 'high',
      currentStatus: 'not started'
    };

    const result = structureGoal(rawInputs);
    const payload = result.normalizedPayload;

    expect(payload).toHaveProperty('goalId');
    expect(payload).toHaveProperty('rawGoalStatement');
    expect(payload).toHaveProperty('normalizedGoalStatement');
    expect(payload).toHaveProperty('goalFamily');
    expect(payload).toHaveProperty('goalSubtype');
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(payload.priorityLevel);
    expect(['NOT_STARTED', 'IN_PROGRESS']).toContain(payload.currentStatus);
    expect(payload).toHaveProperty('intakeTimestamp');
    expect(['PENDING', 'CONFIRMED', 'REJECTED']).toContain(payload.confirmationStatus);
  });

  it('should resolve VentureLaunch family from product launch input', () => {
    const rawInputs = {
      goalDescription: 'Launch a new SaaS product for project management',
      desiredOutcome: 'Have 100 paying customers',
      timeframeSense: 'in 6 months',
      priorityLevel: 'high',
      currentStatus: 'not started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('VentureLaunch');
    expect(result.normalizedPayload.goalSubtype).toBe('SaaS Product Launch');
    expect(result.normalizedPayload.priorityLevel).toBe('HIGH');
    expect(result.normalizedPayload.currentStatus).toBe('NOT_STARTED');
  });

  it('should resolve SkillAcquisition family from learning input', () => {
    const rawInputs = {
      goalDescription: 'Learn React and Node.js',
      desiredOutcome: 'Build full-stack web applications',
      timeframeSense: 'in 3 months',
      priorityLevel: 'medium',
      currentStatus: 'started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('SkillAcquisition');
    expect(result.normalizedPayload.goalSubtype).toBe('Software Skill Acquisition');
  });

  it('should resolve ProfessionalQualification from certification input', () => {
    const rawInputs = {
      goalDescription: 'Get AWS Solutions Architect certification',
      desiredOutcome: 'Pass the exam',
      timeframeSense: 'by April',
      priorityLevel: 'high',
      currentStatus: 'in progress'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('ProfessionalQualification');
    expect(result.normalizedPayload.goalSubtype).toBe('Certification Exam');
  });

  it('should resolve PhysicalTraining from fitness input', () => {
    const rawInputs = {
      goalDescription: 'Lose 20 pounds and build muscle',
      desiredOutcome: 'Get to 180 pounds with visible abs',
      timeframeSense: 'by summer',
      priorityLevel: 'medium',
      currentStatus: 'started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('PhysicalTraining');
    expect(result.normalizedPayload.goalSubtype).toBe('Weight Loss / Body Composition');
  });

  it('should resolve JobSearchPipeline from job search input', () => {
    const rawInputs = {
      goalDescription: 'Find a new job as a software engineer',
      desiredOutcome: 'Get hired at a great company',
      timeframeSense: 'in 2 months',
      priorityLevel: 'high',
      currentStatus: 'not started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('JobSearchPipeline');
    expect(result.normalizedPayload.goalSubtype).toBe('Corporate Role Search');
  });

  it('should resolve CreativeProduction from content creation input', () => {
    const rawInputs = {
      goalDescription: 'Start a podcast about technology',
      desiredOutcome: 'Have 1000 listeners per episode',
      timeframeSense: 'this year',
      priorityLevel: 'medium',
      currentStatus: 'started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('CreativeProduction');
    expect(result.normalizedPayload.goalSubtype).toBe('Podcast Production');
  });

  it('should resolve BrandLaunch from brand building input', () => {
    const rawInputs = {
      goalDescription: 'Build a personal brand as a tech thought leader',
      desiredOutcome: 'Have 10k followers and speaking opportunities',
      timeframeSense: 'in 6 months',
      priorityLevel: 'high',
      currentStatus: 'not started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('BrandLaunch');
    expect(result.normalizedPayload.goalSubtype).toBe('Personal Brand Launch');
  });

  it('should resolve SalesPipeline from sales input', () => {
    const rawInputs = {
      goalDescription: 'Build a sales pipeline for consulting services',
      desiredOutcome: 'Close $50k in deals this quarter',
      timeframeSense: 'in 3 months',
      priorityLevel: 'high',
      currentStatus: 'started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('SalesPipeline');
    expect(result.normalizedPayload.goalSubtype).toBe('B2B Service Sales');
  });

  it('should resolve Fundraising from money raising input', () => {
    const rawInputs = {
      goalDescription: 'Raise seed funding for my startup',
      desiredOutcome: 'Get $250k from investors',
      timeframeSense: 'in 6 months',
      priorityLevel: 'high',
      currentStatus: 'not started'
    };

    const result = structureGoal(rawInputs);

    expect(result.normalizedPayload.goalFamily).toBe('Fundraising');
    expect(result.normalizedPayload.goalSubtype).toBe('Seed Round Raise');
  });

  it('should handle confirmation correctly', () => {
    const payload = {
      goalId: 'test-123',
      confirmationStatus: 'PENDING'
    };

    const confirmed = confirmGoalStructure(payload, 'correct');
    expect(confirmed.confirmationStatus).toBe('CONFIRMED');

    const rejected = confirmGoalStructure(payload, 'start_over');
    expect(rejected.confirmationStatus).toBe('REJECTED');
    expect(rejected.errorCode).toBe('CONFIRMATION_REJECTED');
  });

  it('should produce valid normalized payload schema', () => {
    const rawInputs = {
      goalDescription: 'Launch a mobile app',
      desiredOutcome: '1000 downloads',
      timeframeSense: 'in 4 months',
      priorityLevel: 'high',
      currentStatus: 'not started'
    };

    const result = structureGoal(rawInputs);
    const payload = result.normalizedPayload;

    expect(payload).toHaveProperty('goalId');
    expect(payload).toHaveProperty('rawGoalStatement');
    expect(payload).toHaveProperty('normalizedGoalStatement');
    expect(payload).toHaveProperty('goalFamily');
    expect(payload).toHaveProperty('goalSubtype');
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(payload.priorityLevel);
    expect(['NOT_STARTED', 'IN_PROGRESS']).toContain(payload.currentStatus);
    expect(payload).toHaveProperty('intakeTimestamp');
    expect(['PENDING', 'CONFIRMED', 'REJECTED']).toContain(payload.confirmationStatus);
  });
});