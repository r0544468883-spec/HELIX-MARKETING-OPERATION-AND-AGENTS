import type { ChannelConfig, SendResult } from './types';
import { sendTelegram } from './telegram';
import { sendWhatsApp } from './whatsapp';
import { sendEmail } from './email';
import { sendDiscord } from './discord';
import { sendSlack } from './slack';
import { sendFacebook } from './facebook';
import { sendInstagram } from './instagram';
import { sendLinkedIn } from './linkedin';
import { sendX } from './x';
import { sendMastodon } from './mastodon';
import { sendBluesky } from './bluesky';
import { sendThreads } from './threads';
import { sendReddit } from './reddit';
import { sendDevto } from './devto';
import { sendMedium } from './medium';
import { sendWordPress } from './wordpress';
import { sendHashnode } from './hashnode';
import { sendPinterest } from './pinterest';
import { sendGmb } from './gmb';
import { sendWarpcast } from './warpcast';
import { sendLemmy } from './lemmy';
import { sendVk } from './vk';
import { sendTikTok } from './tiktok';
import { sendYouTube } from './youtube';
import { sendNostr } from './nostr';
import { sendTwitch, sendKick, sendMeWe, sendDribbble } from './unsupported';

// All 29 channels with a native adapter. Text-ready ones work with just a token/webhook;
// media ones (Pinterest/Instagram = image, TikTok/YouTube = video) need a media URL;
// Twitch/Kick/MeWe/Dribbble have no public posting API (adapter returns an honest error).
export const SUPPORTED_CHANNELS = [
  'וואטסאפ', 'טלגרם', 'מייל', 'פייסבוק', 'אינסטגרם', 'לינקדאין', 'X',
  'Discord', 'Slack', 'Mastodon', 'Bluesky', 'Threads', 'Reddit', 'Dev.to',
  'Medium', 'WordPress', 'Hashnode', 'Pinterest', 'Google My Business',
  'Warpcast', 'Lemmy', 'VK', 'TikTok', 'YouTube', 'Nostr',
  'Twitch', 'Kick', 'MeWe', 'Dribbble',
] as const;

export async function sendToChannel(
  channel: string,
  config: ChannelConfig,
  content: string
): Promise<SendResult> {
  switch (channel) {
    case 'טלגרם': return sendTelegram(config, content);
    case 'וואטסאפ': return sendWhatsApp(config, content);
    case 'מייל': return sendEmail(config, content);
    case 'פייסבוק': return sendFacebook(config, content);
    case 'אינסטגרם': return sendInstagram(config, content);
    case 'לינקדאין': return sendLinkedIn(config, content);
    case 'X': return sendX(config, content);
    case 'Discord': return sendDiscord(config, content);
    case 'Slack': return sendSlack(config, content);
    case 'Mastodon': return sendMastodon(config, content);
    case 'Bluesky': return sendBluesky(config, content);
    case 'Threads': return sendThreads(config, content);
    case 'Reddit': return sendReddit(config, content);
    case 'Dev.to': return sendDevto(config, content);
    case 'Medium': return sendMedium(config, content);
    case 'WordPress': return sendWordPress(config, content);
    case 'Hashnode': return sendHashnode(config, content);
    case 'Pinterest': return sendPinterest(config, content);
    case 'Google My Business': return sendGmb(config, content);
    case 'Warpcast': return sendWarpcast(config, content);
    case 'Lemmy': return sendLemmy(config, content);
    case 'VK': return sendVk(config, content);
    case 'TikTok': return sendTikTok(config, content);
    case 'YouTube': return sendYouTube(config, content);
    case 'Nostr': return sendNostr(config, content);
    case 'Twitch': return sendTwitch(config, content);
    case 'Kick': return sendKick(config, content);
    case 'MeWe': return sendMeWe(config, content);
    case 'Dribbble': return sendDribbble(config, content);
    default: return { ok: false, error: 'channel_not_supported' };
  }
}
