// Composes the individual agent outputs into one daily digest (Markdown).

export type DigestSection = { title: string; body: string };

export function composeDigest(sections: DigestSection[], date: string): string {
  const head = `# 📅 הדייג'סט היומי — ${date}`;
  if (sections.length === 0) return `${head}\n\nהכל שקט היום 🙂`;
  const body = sections
    .filter((s) => s.body.trim())
    .map((s) => `## ${s.title}\n${s.body.trim()}`)
    .join('\n\n');
  return `${head}\n\n${body}`;
}

// Collect the union of channels declared across a workspace's agents.
export function collectChannels(configs: Record<string, unknown>[]): string[] {
  const set = new Set<string>();
  for (const c of configs) {
    const chans = (c.channels as string[] | undefined) ?? [];
    chans.forEach((ch) => set.add(ch));
  }
  return set.size ? Array.from(set) : ['טלגרם'];
}
