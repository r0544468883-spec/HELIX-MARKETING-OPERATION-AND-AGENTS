// Landing page = an ordered list of typed blocks. Templates provide the layout +
// placeholder content; the user (or AI) fills the content. UX style themes the render.

export type UxStyle = 'minimal' | 'bold' | 'luxury' | 'dark' | 'editorial';

export type FormField = { name: string; label: string; type: 'text' | 'email' | 'tel' };

export type Section =
  | { type: 'hero'; headline: string; sub: string; cta_label: string; image?: string }
  | { type: 'benefits'; title: string; items: { title: string; desc: string }[] }
  | { type: 'video'; title: string; video_url: string }
  | { type: 'proof'; title: string; testimonials: { quote: string; name: string }[] }
  | { type: 'faq'; title: string; items: { q: string; a: string }[] }
  | { type: 'cta'; headline: string; cta_label: string }
  | { type: 'form'; title: string; fields: FormField[]; submit_label: string };

export type SectionType = Section['type'];

export type LandingTemplate = {
  key: string;
  vertical: string;
  name: string;
  ux_style: UxStyle;
  sections: Section[];
};

export const UX_STYLES: { id: UxStyle; name: string }[] = [
  { id: 'minimal', name: 'מינימלי' },
  { id: 'bold', name: 'נועז' },
  { id: 'luxury', name: 'יוקרתי' },
  { id: 'dark', name: 'כהה' },
  { id: 'editorial', name: 'עיתונאי' },
];

// Standard lead form used across templates.
export const LEAD_FORM: Extract<Section, { type: 'form' }> = {
  type: 'form',
  title: 'השאירו פרטים ונחזור אליכם',
  submit_label: 'שליחה',
  fields: [
    { name: 'name', label: 'שם מלא', type: 'text' },
    { name: 'phone', label: 'טלפון', type: 'tel' },
    { name: 'email', label: 'אימייל', type: 'email' },
  ],
};
