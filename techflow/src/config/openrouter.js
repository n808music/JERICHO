// OpenRouter Configuration
export const OPENROUTER_CONFIG = {
  baseURL: 'https://openrouter.ai/api/v1',
  models: {
    primary: 'anthropic/claude-3.5-sonnet',
    fallback: 'openai/gpt-4-turbo',
    fast: 'openai/gpt-3.5-turbo'
  },
  defaultParams: {
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' }
  }
};

// Task Decomposition Prompts
export const DECOMPOSITION_PROMPTS = {
  system: `You are a strategic planning assistant that breaks down objectives into actionable tasks.
  
Your task is to decompose a high-level objective into specific, measurable tasks across multiple time horizons.
Output valid JSON with this structure:
{
  "objective": "Original objective",
  "tasks": [
    {
      "id": "unique_task_id",
      "title": "Clear task title",
      "description": "Detailed description of what needs to be done",
      "estimatedHours": number,
      "priority": "high|medium|low",
      "dependencies": ["task_id_array"],
      "timeHorizon": "daily|weekly|monthly|quarterly|annual",
      "category": "development|planning|review|coordination|other"
    }
  ],
  "successCriteria": ["Measurable success criteria"],
  "risks": ["Potential risks or blockers"]
}

Guidelines:
- Break complex objectives into manageable tasks (2-8 hours each)
- Consider logical dependencies between tasks
- Assign realistic time horizons
- Use clear, action-oriented language
- Identify potential risks
- Include success criteria
- Limit to 5-10 tasks per objective`,

  getTaskPrompt: (objective, timeHorizon, context = {}) => {
    return `Break down this objective for ${timeHorizon} planning: "${objective}"
    
Current context:
- Team size: ${context.teamSize || 'not specified'}
- Available resources: ${context.resources || 'not specified'}
- Deadline: ${context.deadline || 'not specified'}
- Constraints: ${context.constraints || 'none'}

Please provide a structured task breakdown following the JSON format.`;
  }
};
