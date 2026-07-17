import type { ChannelConfig, SendResult } from './types';

// LinkedIn — config: { author_urn, access_token }.
// author_urn = 'urn:li:organization:123' (company) or 'urn:li:person:xxx'.
export async function sendLinkedIn(config: ChannelConfig, content: string): Promise<SendResult> {
  const author = config.author_urn as string | undefined;
  const token = config.access_token as string | undefined;
  if (!author || !token) return { ok: false, error: 'linkedin_not_configured' };

  try {
    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: content },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });
    if (!res.ok) return { ok: false, error: `linkedin_${res.status}` };
    return { ok: true, externalId: res.headers.get('x-restli-id') ?? undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
