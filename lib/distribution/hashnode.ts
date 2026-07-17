import type { ChannelConfig, SendResult } from './types';

// Hashnode — config: { api_key, publication_id, title? }. GraphQL publishPost mutation.
export async function sendHashnode(config: ChannelConfig, content: string): Promise<SendResult> {
  const apiKey = config.api_key as string | undefined;
  const publicationId = config.publication_id as string | undefined;
  if (!apiKey || !publicationId) return { ok: false, error: 'hashnode_not_configured' };
  const title = (config.title as string | undefined) || content.split('\n')[0].slice(0, 120) || 'Post';
  const query = `mutation Publish($input: PublishPostInput!) { publishPost(input: $input) { post { id url } } }`;
  try {
    const res = await fetch('https://gql.hashnode.com/', {
      method: 'POST',
      headers: { authorization: apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { input: { title, contentMarkdown: content, publicationId } },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { publishPost?: { post?: { id?: string } } };
      errors?: { message?: string }[];
    };
    if (!res.ok || json.errors?.length) return { ok: false, error: json.errors?.[0]?.message ?? `hashnode_${res.status}` };
    return { ok: true, externalId: json.data?.publishPost?.post?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
