# helix-ops — Agent Team

This product is a **department of agents** (HELIX intra-department architecture).
The specialists below live in this repo's `.claude/agents/`, so the team is
versioned with the product.

## How it fits the methodology
- **Orchestrator** — `multi-agent-coordinator` runs the department: splits the
  task, dispatches specialists, reconciles their output.
- **Specialists (Researcher / Maker / Critic)** for this product:
  - `content-marketer`
  - `growth-loops`
  - `landing-page-copywriter`
  - `ab-test-analysis`
  - `trend-analyst`
  - `email-deliverability-engineer`
- **Tools they use** — the product's `helix-*` skills (pdf / tts / clean-text /
  screen-recording / email-campaigns …) are the *capabilities*; these agents are
  the *workers* that wield them.
- **Existing product agent** — these AUGMENT the product's own agent/chief
  (CHIEF / department-chief); they do not replace it. The product agent stays the
  front door; specialists are summoned by name when their domain comes up.
- **Autonomy** — all run under the product's autonomy mode
  (advisor → approve → autopilot).

## Use
Invoke a specialist by name, or let `multi-agent-coordinator` assemble the team
for a multi-step job. They are also globally available; this file makes the
product's *dedicated* roster explicit.

## GTM Skills — domain layer (wired 2026-09-02)
This is the department's explicit **domain layer**. Following "Agent = archetype ×
domain(skill)", each specialist below is a role/format/gate archetype; the GTM
skills in this repo's `.claude/skills/` are the domain it wields. Every skill
named here was verified to exist in that folder. Skills stay one-per-capability
and shared; agents are the workers that load them.

- **Paid media / Ads** → `content-marketer` (Maker) + `ab-test-analysis` (Critic)
  - `google-ads`, `google-ads-pmax-asset-groups`, `google-ads-ppc-math`,
    `meta-ads-operating-system`, `meta-campaign-structure`, `linkedin-ads`,
    `ads-campaign-planning`, `ads-budget-allocation`, `advantage-plus`,
    `creating-campaigns-ads-audiences`, `creative-fatigue-detection`,
    `ads-measurement-scorecard` (the last two feed `ab-test-analysis`).
- **ABM** → `growth-loops`
  - `linkedin-abm-strategy-planner`, `linkedin-abm-audit`,
    `linkedin-abm-ad-design`, `linkedin-abm-monthly-report`, `abm-on-meta`,
    `abm-retargeting-framework`, `1-to-1-abm-ads`, `abm-measurement-framework`,
    `linkedin-abm-1to1-few-many`.
- **Creator / Influencer** → `trend-analyst` (scout) + `content-marketer` (brief)
  - `find-b2b-creators-linkedin`, `build-influencer-marketing-strategy`,
    `creator-led-growth-90-days`, `linkedin-creator-campaign-launch`,
    `creator-deal-pricing`, `creator-programme-qbr`,
    `influencer-post-engager-capture`, `founder-employees-or-creators`.
- **Newsletter & email content** → `content-marketer`
  - `newsletter-value-prop`, `newsletter-format`, `newsletter-welcome-sequence`,
    `52-newsletter-ideas`, `beehiiv-newsletter-report`, `email-content-ideas`,
    `weekly-roundup-email`, `lead-magnet-welcome-email`,
    `viral-linkedin-lead-magnet-post`.
- **Reddit / Community authority** → `trend-analyst` (radar) + `content-marketer` (voice)
  - `reddit-authority-commenting`, `reddit-campaign-launcher`,
    `reddit-account-warmup`, `quora-authority-answering`, `subreddit-research`,
    `community-radar`, `brand-mention-monitor`, `advocate-voice-tuning`,
    `recent-discourse-sweep`.
- **LinkedIn organic** → `content-marketer`
  - `linkedin-ghostwriting`, `linkedin-post-to-newsletter`,
    `linkedin-engagement-handler`, `linkedin-dm-signal-classifier`,
    `founder-post-triggers-24`.
- **Copy quality guardrail** → all writers (`content-marketer`,
  `landing-page-copywriter`, and any specialist producing text)
  - `anti-ai-slop-writing`, `content-de-slop-ai`, `human-mannerisms`,
    `ad-copywriting`, `ads-writing-style`.
- **Landing pages** → `landing-page-copywriter`
  - `newsletter-landing-page`.

**Product leap:** OPS moves from a single gray auto-comment path to a
multi-channel demand-gen and authority engine, paid plus ABM plus creator plus
community plus newsletter, orchestrated by `multi-agent-coordinator` and gated
by the copy-quality guardrail on every text output.
