import {
  OPENROUTER_CONFIG,
  DECOMPOSITION_PROMPTS
} from '../config/openrouter.js';

class OpenRouterService {
  constructor() {
    this.apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    this.baseURL = OPENROUTER_CONFIG.baseURL;
    this.cache = new Map();
  }

  async decomposeTask(objective, timeHorizon, context = {}) {
    const cacheKey = this.getCacheKey(objective, timeHorizon, context);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const prompt = this.buildDecompositionPrompt(
      objective,
      timeHorizon,
      context
    );
    const result = await this.callLLM(prompt, OPENROUTER_CONFIG.models.primary);

    // Cache successful results
    if (result) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  buildDecompositionPrompt(objective, timeHorizon, context) {
    return {
      messages: [
        {
          role: 'system',
          content: DECOMPOSITION_PROMPTS.system
        },
        {
          role: 'user',
          content: DECOMPOSITION_PROMPTS.getTaskPrompt(
            objective,
            timeHorizon,
            context
          )
        }
      ]
    };
  }

  async callLLM(prompt, model) {
    if (!this.apiKey) {
      throw new Error(
        'OpenRouter API key not configured. Please set VITE_OPENROUTER_API_KEY environment variable.'
      );
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'TechFlow Planner'
        },
        body: JSON.stringify({
          model,
          messages: prompt.messages,
          ...OPENROUTER_CONFIG.defaultParams
        })
      });

      if (!response.ok) {
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from OpenRouter');
      }

      // Parse JSON response
      try {
        return JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse LLM response:', content);
        throw new Error('Invalid response format from LLM');
      }
    } catch (error) {
      console.error('OpenRouter service error:', error);
      throw error;
    }
  }

  getCacheKey(objective, timeHorizon, context) {
    return `${objective.slice(0, 50)}-${timeHorizon}-${JSON.stringify(context)}`;
  }

  async validateApiKey() {
    try {
      await this.callLLM(
        { messages: [{ role: 'user', content: 'Test message' }] },
        OPENROUTER_CONFIG.models.fast
      );
      return true;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 100, // Configurable cache limit
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
    };
  }
}

// Singleton instance
export const openRouterService = new OpenRouterService();
export default openRouterService;
