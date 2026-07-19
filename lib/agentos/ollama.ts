// Ollama caller — talks to a local or shared Ollama server via its chat API.
// No SDK; plain fetch. Server-only.

export async function callOllama(
  baseUrl: string,
  model: string,
  system: string,
  user: string,
  apiKey?: string
): Promise<string> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`ollama_${res.status}`);
  const json = (await res.json()) as { message?: { content?: string } };
  return (json.message?.content ?? '').trim();
}
