// Model router — sends volume/low-stakes work to local Ollama, quality work to Claude.
import { claude } from '../engagement/ai';
import { callOllama } from './ollama';

export type OllamaCfg = { baseUrl: string; model: string; apiKey?: string } | null;
export type Tier = 'local' | 'quality' | 'auto';

// Returns a bound run(tier, system, user) using the workspace's Ollama endpoint.
export function makeRunner(ollama: OllamaCfg) {
  return async function run(tier: Tier, system: string, user: string): Promise<{ text: string; model: string }> {
    // No local endpoint, or quality requested → Claude.
    if (tier === 'quality' || !ollama) {
      return { text: await claude(system, user, 600), model: 'claude' };
    }
    if (tier === 'local') {
      return { text: await callOllama(ollama.baseUrl, ollama.model, system, user, ollama.apiKey), model: ollama.model };
    }
    // auto → try local, fall back to Claude on error.
    try {
      return { text: await callOllama(ollama.baseUrl, ollama.model, system, user, ollama.apiKey), model: ollama.model };
    } catch {
      return { text: await claude(system, user, 600), model: 'claude(fallback)' };
    }
  };
}

export type RunFn = ReturnType<typeof makeRunner>;
