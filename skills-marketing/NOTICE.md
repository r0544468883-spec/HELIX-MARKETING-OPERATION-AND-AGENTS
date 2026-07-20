# HELIX Marketing Skills Pack

64 agent-native marketing skills (Claude-Code `SKILL.md` format) vendored for use
by **HELIX Agent OS** (product 6) and **Marketing Ops Hub** (product 1). Each skill
is a self-contained prompt+frontmatter pack (`reads`/`writes`/`depends-on`/`triggers`/
`env_vars`) that an agent can register and run.

## Source & License
Harvested from **[MoizIbnYousaf/marketing-cli](https://github.com/MoizIbnYousaf/marketing-cli)** — **MIT** (Copyright (c) 2026 Moiz Ibn Yousaf). Full upstream license in `UPSTREAM-LICENSE`. MIT permits commercial use, modification, and redistribution with attribution.

## How HELIX uses this
- **Agent OS registry** (`lib/agentos/registry.ts`) can load a skill pack by name and run it against Ollama/Claude.
- Skills that write to `brand/*` or `marketing/*` map to HELIX workspace artifacts.
- **Hebrew:** upstream skills are English. Wrap output through `lib/hebrew.ts` (HEBREW_STYLE + humanizeHe) for Hebrew-first delivery. Add a proofread pass (see baldiga note).

## Layers (from `skills-manifest.json`)
- **Foundation** — brand-voice, audience-research, competitive-intel, company-research, positioning-angles, voice-extraction
- **Strategy** — keyword-research, launch-strategy, pricing-strategy, free-tool-strategy, marketing-psychology
- **Execution** — direct-response-copy, seo-content, ai-seo, seo-audit, page-cro, conversion-flow-cro, content-atomizer, video-content, image-gen
- **Distribution** — postiz (30+ networks), typefully, newsletter, email-sequences, send-email, resend-inbound, social-campaign, referral-program, lead-generation

## Product mapping
| Skills | HELIX product |
|---|---|
| brand-voice, audience-research, seo-content, ai-seo, page-cro, content-atomizer, postiz, newsletter, social-campaign, email-sequences, referral-program | **1 — Marketing Ops** |
| lead-generation, company-research, competitive-intel, competitor-alternatives, churn-prevention, direct-response-copy | **3 — SDR** |
| ai-seo, seo-audit, seo-content, off-page-seo, keyword-research, seo-machine | **4 — HELIX Rank** |
| cmo (orchestrator), create-skill, deepen-plan | **6 — Agent OS** |

## Excluded from scope (vendor-specific, low HELIX value)
higgsfield-*, remotion/cmo-remotion, tiktok-slideshow, app-store-screenshots, frontend-slides — kept for completeness but not wired.
