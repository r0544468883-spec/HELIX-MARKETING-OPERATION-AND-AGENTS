// Agent registry — drop-in handlers. Adding an agent type = add a handler here;
// the scheduler never changes (folder-of-agents pattern, productized).
import type { RunFn, Tier } from './model-router';
import { humanizeHe } from '../hebrew';

export type AgentCtx = {
  config: Record<string, unknown>;
  tier: Tier;
  run: RunFn;
};

export type AgentResult = { body: string; model: string };
export type AgentHandler = (ctx: AgentCtx) => Promise<AgentResult>;

const handlers: Record<string, AgentHandler> = {
  // Generic prompt agent: runs a configured system+prompt through the router.
  prompt: async ({ config, tier, run }) => {
    const system =
      (config.system as string) || 'אתה עוזר שכותב סיכום קצר, ברור ומועיל בעברית. החזר רק את הסיכום.';
    const user = (config.prompt as string) || 'סכם את המצב.';
    const { text, model } = await run(tier, system, user);
    // Hebrew output always routes through the shared Hebrew writing skill.
    const body = await humanizeHe(text);
    return { body, model };
  },

  // Echo agent (no model) — useful for static reminders / testing.
  echo: async ({ config }) => {
    return { body: (config.text as string) || '', model: 'none' };
  },
};

export function getHandler(type: string): AgentHandler | null {
  return handlers[type] ?? null;
}

export function knownTypes(): string[] {
  return Object.keys(handlers);
}
