'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { toDateStr } from '@/lib/date';
import { slugify, randomSuffix } from '@/lib/slugify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildEmailHtml } from '@/lib/email';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://helix-stage.vercel.app';
const RESEND_FROM = process.env.RESEND_FROM ?? 'HELIX STAGE <onboarding@resend.dev>';

// שולח מייל לבעל המוצר (תגובה חדשה / נרשם ל-waitlist). כשל לא שובר את הפעולה.
async function notifyOwnerByProduct(
  supabase: SupabaseClient,
  productId: string,
  subject: string,
  text: string
) {
  try {
    if (!process.env.RESEND_API_KEY) return;
    const { data } = await supabase
      .from('products')
      .select('name, slug, profiles!products_owner_id_fkey(email)')
      .eq('id', productId)
      .maybeSingle();
    const owner = data?.profiles as { email: string | null } | { email: string | null }[] | null;
    const email = Array.isArray(owner) ? owner[0]?.email : owner?.email;
    if (!email) return;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: RESEND_FROM, to: email, subject, text });
  } catch {
    // מתעלמים — התראה היא best-effort
  }
}

export async function toggleVote(launchId: string, path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  const { data: existing } = await supabase
    .from('votes')
    .select('id')
    .eq('user_id', user.id)
    .eq('launch_id', launchId)
    .maybeSingle();

  if (existing) {
    await supabase.from('votes').delete().eq('id', existing.id);
  } else {
    await supabase.from('votes').insert({ user_id: user.id, launch_id: launchId });
  }
  revalidatePath(path);
  return { ok: true };
}

export async function addComment(launchId: string, body: string, path: string) {
  const trimmed = body.trim();
  if (!trimmed) return { error: 'empty' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  await supabase.from('comments').insert({
    user_id: user.id,
    launch_id: launchId,
    body: trimmed.slice(0, 2000),
  });

  // התראה לבעל המוצר (לא על תגובה של עצמו)
  const { data: launch } = await supabase
    .from('launches')
    .select('product_id, products!inner(owner_id)')
    .eq('id', launchId)
    .maybeSingle();
  if (launch) {
    const prod = launch.products as { owner_id: string } | { owner_id: string }[] | null;
    const ownerId = Array.isArray(prod) ? prod[0]?.owner_id : prod?.owner_id;
    if (ownerId && ownerId !== user.id) {
      await notifyOwnerByProduct(
        supabase,
        launch.product_id as string,
        'תגובה חדשה על המוצר שלך — HELIX STAGE',
        `יש תגובה חדשה על המוצר שלך ב-HELIX STAGE:\n\n"${trimmed.slice(0, 300)}"\n\n${SITE_URL}`
      );
    }
  }

  revalidatePath(path);
  return { ok: true };
}

export async function joinWaitlist(productId: string, email: string) {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { error: 'invalid' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('waitlist_signups').insert({
    product_id: productId,
    email: trimmed,
    user_id: user?.id ?? null,
  });
  // כפילות (unique) נחשבת הצלחה מבחינת המשתמש
  if (error && error.code === '23505') return { ok: true };
  if (error) return { error: 'failed' };

  await notifyOwnerByProduct(
    supabase,
    productId,
    'הצטרפות חדשה לרשימת ההמתנה — HELIX STAGE',
    `מישהו (${trimmed}) הצטרף לרשימת ההמתנה של המוצר שלך ב-HELIX STAGE.\n${SITE_URL}`
  );
  return { ok: true };
}

export async function subscribeNewsletter(email: string, locale: string) {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { error: 'invalid' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email: trimmed, locale });
  if (error && error.code !== '23505') return { error: 'failed' };
  return { ok: true };
}

export type ProductInput = {
  locale: string;
  name: string;
  tagline: string;
  description: string;
  website: string;
  status: 'pre_launch' | 'beta' | 'live';
  categoryIds: number[];
  logoUrl: string | null;
  screenshots: string[];
  alternativeTo: string[];
  videoUrl: string;
};

function cleanAlternatives(list: string[]): string[] {
  return Array.from(
    new Set(
      list
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.slice(0, 40))
    )
  ).slice(0, 8);
}

export async function createProduct(input: ProductInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  const name = input.name.trim();
  const tagline = input.tagline.trim().slice(0, 60);
  if (!name || !tagline) return { error: 'missing' };

  let slug = slugify(name) || `product-${randomSuffix()}`;
  const { data: taken } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (taken) slug = `${slug}-${randomSuffix()}`;

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      owner_id: user.id,
      name,
      slug,
      tagline,
      description: input.description.trim() || null,
      website_url: input.website.trim() || null,
      logo_url: input.logoUrl,
      video_url: input.videoUrl.trim() || null,
      screenshots: input.screenshots ?? [],
      alternative_to: cleanAlternatives(input.alternativeTo ?? []),
      status: input.status,
    })
    .select('id, slug')
    .single();

  if (error || !product) return { error: 'failed' };

  await supabase.from('launches').insert({
    product_id: product.id,
    launch_date: toDateStr(new Date()),
  });

  if (input.categoryIds.length > 0) {
    await supabase.from('product_categories').insert(
      input.categoryIds.slice(0, 3).map((category_id) => ({
        product_id: product.id,
        category_id,
      }))
    );
  }

  // מוודאים שהמעלה מסומן כיזם
  await supabase.from('profiles').update({ user_type: 'maker' }).eq('id', user.id);

  redirect(`/${input.locale}/products/${product.slug}`);
}

export async function updateProduct(productId: string, input: ProductInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  const name = input.name.trim();
  const tagline = input.tagline.trim().slice(0, 60);
  if (!name || !tagline) return { error: 'missing' };

  // slug נשאר קבוע כדי לא לשבור קישורים משותפים
  const { error } = await supabase
    .from('products')
    .update({
      name,
      tagline,
      description: input.description.trim() || null,
      website_url: input.website.trim() || null,
      logo_url: input.logoUrl,
      video_url: input.videoUrl.trim() || null,
      screenshots: input.screenshots ?? [],
      alternative_to: cleanAlternatives(input.alternativeTo ?? []),
      status: input.status,
    })
    .eq('id', productId)
    .eq('owner_id', user.id);

  if (error) return { error: 'failed' };

  await supabase.from('product_categories').delete().eq('product_id', productId);
  if (input.categoryIds.length > 0) {
    await supabase.from('product_categories').insert(
      input.categoryIds.slice(0, 3).map((category_id) => ({
        product_id: productId,
        category_id,
      }))
    );
  }

  revalidatePath(`/${input.locale}`, 'layout');
  redirect(`/${input.locale}/dashboard`);
}

export type OnboardingInput = {
  locale: string;
  userType: 'consumer' | 'maker';
  name: string;
  roleTitle: string;
  company: string;
  linkedinUrl: string;
  interests: number[];
};

export async function completeOnboarding(input: OnboardingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  const { error } = await supabase
    .from('profiles')
    .update({
      user_type: input.userType,
      name: input.name.trim() || null,
      role_title: input.roleTitle.trim() || null,
      company: input.company.trim() || null,
      linkedin_url: input.linkedinUrl.trim() || null,
      interests: input.interests,
      onboarding_completed: true,
    })
    .eq('id', user.id);

  if (error) return { error: 'failed' };
  revalidatePath(`/${input.locale}`, 'layout');
  return { ok: true };
}

export async function submitReview(input: {
  productId: string;
  rating: number;
  pros: string;
  cons: string;
  body: string;
  path: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
  const { error } = await supabase.from('reviews').upsert(
    {
      product_id: input.productId,
      user_id: user.id,
      rating,
      pros: input.pros.trim() || null,
      cons: input.cons.trim() || null,
      body: input.body.trim() || null,
    },
    { onConflict: 'product_id,user_id' }
  );
  if (error) return { error: 'failed' };
  revalidatePath(input.path);
  return { ok: true };
}

export async function createPost(input: {
  locale: string;
  body: string;
  type: 'build_in_public' | 'show_il';
  topic?: string | null;
  productId?: string | null;
}) {
  const trimmed = input.body.trim();
  if (!trimmed) return { error: 'empty' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  const { error } = await supabase.from('posts').insert({
    user_id: user.id,
    body: trimmed.slice(0, 2000),
    type: input.type,
    topic: input.topic ?? null,
    product_id: input.productId ?? null,
  });
  if (error) return { error: 'failed' };
  revalidatePath(`/${input.locale}/community`);
  return { ok: true };
}

export async function togglePostVote(postId: string, path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  const { data: existing } = await supabase
    .from('post_votes')
    .select('id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .maybeSingle();

  if (existing) {
    await supabase.from('post_votes').delete().eq('id', existing.id);
  } else {
    await supabase.from('post_votes').insert({ user_id: user.id, post_id: postId });
  }
  revalidatePath(path);
  return { ok: true };
}

export async function addPostReply(postId: string, body: string, path: string) {
  const trimmed = body.trim();
  if (!trimmed) return { error: 'empty' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  await supabase.from('post_comments').insert({
    post_id: postId,
    user_id: user.id,
    body: trimmed.slice(0, 2000),
  });
  revalidatePath(path);
  return { ok: true };
}

export async function updateGtm(
  productId: string,
  input: {
    locale: string;
    betaEnabled: boolean;
    betaWhatsappUrl: string;
    betaNote: string;
    landingEnabled: boolean;
    landingHeadline: string;
    landingSubheadline: string;
    landingCta: string;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  const { error } = await supabase
    .from('products')
    .update({
      beta_enabled: input.betaEnabled,
      beta_whatsapp_url: input.betaWhatsappUrl.trim() || null,
      beta_note: input.betaNote.trim() || null,
      landing_enabled: input.landingEnabled,
      landing_headline: input.landingHeadline.trim() || null,
      landing_subheadline: input.landingSubheadline.trim() || null,
      landing_cta: input.landingCta.trim() || null,
    })
    .eq('id', productId)
    .eq('owner_id', user.id);

  if (error) return { error: 'failed' };
  revalidatePath(`/${input.locale}/dashboard/products/${productId}`);
  return { ok: true };
}

export async function createListing(input: {
  locale: string;
  type: 'hiring' | 'open_to_work' | 'collab';
  roleTitle: string;
  body: string;
  productId: string | null;
  contactEmail: string;
}) {
  const trimmed = input.body.trim();
  if (!trimmed) return { error: 'empty' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  const { error } = await supabase.from('listings').insert({
    user_id: user.id,
    type: input.type,
    role_title: input.roleTitle.trim() || null,
    body: trimmed.slice(0, 2000),
    product_id: input.productId || null,
    contact_email: input.contactEmail.trim() || null,
  });
  if (error) return { error: 'failed' };
  revalidatePath(`/${input.locale}/board`);
  return { ok: true };
}

export async function deleteListing(listingId: string, path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };
  await supabase.from('listings').delete().eq('id', listingId).eq('user_id', user.id);
  revalidatePath(path);
  return { ok: true };
}

export async function contactListing(listingId: string, fromName: string, message: string) {
  const trimmed = message.trim();
  if (!trimmed) return { error: 'empty' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  try {
    if (!process.env.RESEND_API_KEY) return { error: 'noemail' };
    const { data: listing } = await supabase
      .from('listings')
      .select('contact_email, profiles!listings_user_id_fkey(email)')
      .eq('id', listingId)
      .maybeSingle();
    const prof = listing?.profiles as { email: string | null } | { email: string | null }[] | null;
    const profileEmail = Array.isArray(prof) ? prof[0]?.email : prof?.email;
    const to = listing?.contact_email || profileEmail;
    if (!to) return { error: 'noemail' };

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject: 'הודעה חדשה מלוח החיבורים — HELIX STAGE',
      text: `${fromName.trim() || 'מישהו'} יצר איתך קשר דרך לוח החיבורים ב-HELIX STAGE:\n\n"${trimmed.slice(0, 1000)}"\n\nהשב/י ישירות למייל הזה.\n${SITE_URL}`,
      replyTo: user.email ?? undefined,
    });
    return { ok: true };
  } catch {
    return { error: 'failed' };
  }
}

export async function updateProfile(input: {
  locale: string;
  name: string;
  roleTitle: string;
  company: string;
  linkedinUrl: string;
  websiteUrl: string;
  bio: string;
  avatarUrl: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      name: input.name.trim() || null,
      role_title: input.roleTitle.trim() || null,
      company: input.company.trim() || null,
      linkedin_url: input.linkedinUrl.trim() || null,
      website_url: input.websiteUrl.trim() || null,
      bio: input.bio.trim() || null,
      avatar_url: input.avatarUrl,
      // עדכון סטטוס אימות לפי קיום LinkedIn
      is_verified: Boolean(input.linkedinUrl.trim()),
    })
    .eq('id', user.id)
    .select('username')
    .single();

  if (error || !updated) return { error: 'failed' };
  revalidatePath(`/${input.locale}/profile/${updated.username}`);
  return { ok: true, username: updated.username };
}

// ---------- דיוור ----------
export async function saveTemplate(input: { name: string; subject: string; bodyHtml: string; id?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };
  if (!input.name.trim() || !input.subject.trim() || !input.bodyHtml.trim()) return { error: 'missing' };

  if (input.id) {
    await supabase
      .from('email_templates')
      .update({ name: input.name.trim(), subject: input.subject.trim(), body_html: input.bodyHtml })
      .eq('id', input.id)
      .eq('owner_id', user.id);
    return { ok: true, id: input.id };
  }
  const { data, error } = await supabase
    .from('email_templates')
    .insert({ owner_id: user.id, name: input.name.trim(), subject: input.subject.trim(), body_html: input.bodyHtml })
    .select('id')
    .single();
  if (error || !data) return { error: 'failed' };
  return { ok: true, id: data.id };
}

export async function deleteTemplate(id: string, locale: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };
  await supabase.from('email_templates').delete().eq('id', id).eq('owner_id', user.id);
  revalidatePath(`/${locale}/dashboard/email`);
  return { ok: true };
}

export type CampaignInput = {
  subject: string;
  bodyHtml: string;
  fromName: string;
  fromEmail: string;
  segment: 'all' | 'product_waitlist' | 'my_contacts';
  productId: string | null;
  localeFilter: string | null;
  tagFilter: string | null;
  scheduledAt: string | null;
};

function personalize(text: string, r: { name?: string | null; email: string }): string {
  const name = (r.name ?? '').trim() || (text.includes('{{name}}') ? '' : '');
  return text
    .replace(/\{\{\s*name\s*\}\}/g, name || (text.includes('שלום') ? '' : ''))
    .replace(/\{\{\s*email\s*\}\}/g, r.email);
}

export async function createCampaign(input: CampaignInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };
  if (!input.subject.trim() || !input.bodyHtml.trim()) return { error: 'missing' };

  const { data, error } = await supabase
    .from('email_campaigns')
    .insert({
      owner_id: user.id,
      subject: input.subject.trim(),
      body_html: input.bodyHtml,
      from_name: input.fromName.trim() || 'HELIX STAGE',
      from_email: input.fromEmail.trim() || null,
      segment: input.segment,
      product_id: input.segment === 'product_waitlist' ? input.productId : null,
      locale_filter: input.localeFilter,
      tag_filter: input.segment === 'my_contacts' ? input.tagFilter : null,
      scheduled_at: input.scheduledAt,
      status: input.scheduledAt ? 'scheduled' : 'draft',
    })
    .select('id')
    .single();
  if (error || !data) return { error: 'failed' };
  return { ok: true, id: data.id };
}

// שליחת מייל בדיקה לעצמי (בלי קמפיין/מעקב)
export async function sendTestEmail(input: CampaignInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'auth' };
  if (!process.env.RESEND_API_KEY) return { error: 'noresend' };
  try {
    const { data: prof } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
    const r = { email: user.email, name: prof?.name };
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = input.fromEmail.trim()
      ? `${input.fromName.trim() || 'HELIX STAGE'} <${input.fromEmail.trim()}>`
      : RESEND_FROM;
    const html = buildEmailHtml({
      bodyHtml: personalize(input.bodyHtml, r),
      sendId: 'test',
      subject: input.subject,
      unsubscribeLabel: 'הסרה מרשימת התפוצה',
    });
    await resend.emails.send({ from, to: user.email, subject: `[בדיקה] ${personalize(input.subject, r)}`, html });
    return { ok: true };
  } catch {
    return { error: 'failed' };
  }
}

// ---------- אנשי קשר ----------
export async function addContact(input: { locale: string; email: string; name: string; tags: string }) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'invalid' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };
  const tags = input.tags.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const { error } = await supabase
    .from('contacts')
    .upsert({ owner_id: user.id, email, name: input.name.trim() || null, tags, source: 'manual' }, { onConflict: 'owner_id,email' });
  if (error) return { error: 'failed' };
  revalidatePath(`/${input.locale}/dashboard/email/contacts`);
  return { ok: true };
}

export async function deleteContact(id: string, locale: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };
  await supabase.from('contacts').delete().eq('id', id).eq('owner_id', user.id);
  revalidatePath(`/${locale}/dashboard/email/contacts`);
  return { ok: true };
}

export async function importContacts(locale: string, rows: { email: string; name?: string }[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };
  const clean = rows
    .map((r) => ({ email: (r.email ?? '').trim().toLowerCase(), name: (r.name ?? '').trim() || null }))
    .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))
    .slice(0, 5000)
    .map((r) => ({ owner_id: user.id, email: r.email, name: r.name, source: 'import' }));
  if (clean.length === 0) return { error: 'empty' };
  const { error } = await supabase.from('contacts').upsert(clean, { onConflict: 'owner_id,email', ignoreDuplicates: true });
  if (error) return { error: 'failed' };
  revalidatePath(`/${locale}/dashboard/email/contacts`);
  return { ok: true, count: clean.length };
}

// סנכרון כל נרשמי ה-Waitlist של המוצרים שלי לאנשי הקשר
export async function syncWaitlistToContacts(locale: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };
  const { data: prods } = await supabase.from('products').select('id').eq('owner_id', user.id);
  const ids = (prods ?? []).map((p: { id: string }) => p.id);
  if (ids.length === 0) return { ok: true, count: 0 };
  const { data: wl } = await supabase.from('waitlist_signups').select('email').in('product_id', ids).limit(5000);
  const emails = Array.from(new Set((wl ?? []).map((r: { email: string }) => r.email.trim().toLowerCase())));
  if (emails.length === 0) return { ok: true, count: 0 };
  const rows = emails.map((email) => ({ owner_id: user.id, email, source: 'waitlist' }));
  await supabase.from('contacts').upsert(rows, { onConflict: 'owner_id,email', ignoreDuplicates: true });
  revalidatePath(`/${locale}/dashboard/email/contacts`);
  return { ok: true, count: emails.length };
}

type Recipient = { email: string; name?: string | null };

// בניית נמענים לקמפיין (admin client, לפי owner_id שבקמפיין)
async function buildRecipients(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  campaign: Record<string, unknown>
): Promise<Recipient[]> {
  const seg = campaign.segment as string;
  const ownerId = campaign.owner_id as string;

  if (seg === 'all') {
    let q = admin.from('newsletter_subscribers').select('email, name').is('unsubscribed_at', null);
    if (campaign.locale_filter) q = q.eq('locale', campaign.locale_filter as string);
    const { data } = await q.limit(5000);
    return (data ?? []) as Recipient[];
  }
  if (seg === 'my_contacts') {
    let q = admin.from('contacts').select('email, name').eq('owner_id', ownerId).is('unsubscribed_at', null);
    if (campaign.tag_filter) q = q.contains('tags', [campaign.tag_filter as string]);
    const { data } = await q.limit(5000);
    return (data ?? []) as Recipient[];
  }
  // product_waitlist
  const { data: wl } = await admin
    .from('waitlist_signups')
    .select('email')
    .eq('product_id', campaign.product_id as string)
    .limit(5000);
  const { data: unsub } = await admin
    .from('newsletter_subscribers')
    .select('email')
    .not('unsubscribed_at', 'is', null);
  const blocked = new Set((unsub ?? []).map((u: { email: string }) => u.email));
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of (wl ?? []) as { email: string }[]) {
    if (blocked.has(r.email) || seen.has(r.email)) continue;
    seen.add(r.email);
    out.push({ email: r.email });
  }
  return out;
}

// שליחת קמפיין בפועל (משותף לשליחה ידנית ולתזמון). מחזיר כמות שנשלחה.
export async function deliverCampaign(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  campaign: Record<string, unknown>,
  locale: string
): Promise<number> {
  const recipients = await buildRecipients(admin, campaign);
  if (recipients.length === 0) {
    await admin.from('email_campaigns').update({ status: 'sent', recipients: 0, sent_at: new Date().toISOString() }).eq('id', campaign.id as string);
    return 0;
  }
  await admin.from('email_campaigns').update({ status: 'sending' }).eq('id', campaign.id as string);
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const from = campaign.from_email
    ? `${campaign.from_name} <${campaign.from_email}>`
    : RESEND_FROM;
  const unsubLabel = locale === 'en' ? 'Unsubscribe' : 'הסרה מרשימת התפוצה';

  let sent = 0;
  for (const r of recipients) {
    try {
      const { data: send } = await admin
        .from('email_sends')
        .insert({ campaign_id: campaign.id as string, email: r.email })
        .select('id')
        .single();
      if (!send) continue;
      const html = buildEmailHtml({
        bodyHtml: personalize(campaign.body_html as string, r),
        sendId: send.id,
        subject: campaign.subject as string,
        unsubscribeLabel: unsubLabel,
      });
      await resend.emails.send({ from, to: r.email, subject: personalize(campaign.subject as string, r), html });
      sent++;
    } catch {
      // ממשיכים
    }
  }
  await admin
    .from('email_campaigns')
    .update({ status: 'sent', sent_at: new Date().toISOString(), recipients: sent })
    .eq('id', campaign.id as string);
  return sent;
}

// שליחה ידנית מהמסך: אימות הרשאות ואז delivery.
export async function sendCampaign(campaignId: string, locale: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  const admin = createAdminClient();
  if (!admin) return { error: 'noadmin' };
  if (!process.env.RESEND_API_KEY) return { error: 'noresend' };

  const { data: campaign } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!campaign || campaign.status === 'sent') return { error: 'invalid' };

  // אימות הרשאות לפי סגמנט
  if (campaign.segment === 'all') {
    const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!prof?.is_admin) return { error: 'forbidden' };
  } else if (campaign.segment === 'product_waitlist') {
    const { data: p } = await supabase
      .from('products')
      .select('id')
      .eq('id', campaign.product_id)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (!p) return { error: 'forbidden' };
  }

  const sent = await deliverCampaign(admin, campaign, locale);
  revalidatePath(`/${locale}/dashboard/email`);
  if (sent === 0) return { error: 'empty' };
  return { ok: true, sent };
}

export async function becomeMaker(path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'auth' };

  await supabase.from('profiles').update({ user_type: 'maker' }).eq('id', user.id);
  revalidatePath(path);
  return { ok: true };
}
