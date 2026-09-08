---
name: competitor-intel
title: Competitor intel
description: |
  Pull a fact-led competitive intel brief on any competitor. Takes a
  competitor name and a one-line deal context — displacement play, renewal
  defence, or general competitive prep. Returns leadership changes, hiring
  signals, customer intent, recent product moves, and named displacement
  angles — all shaped by the deal you're in. Requires a Lusha connection.
category: Research
tags: [Research, Sales]
---

Pull a fact-led competitive intelligence brief on a named
competitor. Shape every signal, news item, and displacement
angle around the deal context the user provides. Return a brief
an AE can act on before walking into a competitive deal.

## Input

The user will provide via $ARGUMENTS:

- Competitor name (required) — company name or domain.
- Deal context (required) — one sentence on why this brief
  is being pulled and what decision it supports. Examples:
  - "displacement play — competitor is incumbent, Stage 3"
  - "renewal defence — competitor approaching our customer
    at renewal"
  - "displacement prospecting — find their customers showing
    intent on our category"
  - "general competitive prep — new rep onboarding to territory"

  If deal context is missing, ask once. If declined, default
  to general competitive intelligence and state that assumption
  at the top of the brief.

- Your company context (optional) — your product, ICP, and
  key differentiators. Used to frame displacement angles and
  customer intent signals. If not supplied, omit the
  displacement angles section and note why.

## Workflow

1. Anchor on the deal context.
   Read the deal context from $ARGUMENTS. Restate it in one
   sentence as the brief purpose. Derive 2-4 priority themes.
   Examples:
   - Displacement play → leadership instability, product gaps,
     customer intent on your category, recent executive hires
   - Renewal defence → recent product launches, pricing changes,
     customer satisfaction signals, competitive positioning moves
   - Displacement prospecting → customer intent signals, accounts
     showing switching behavior, hiring gaps at the competitor

2. Resolve the competitor via Lusha.
   Call companies_search with the competitor name or domain.
   Confirm the match before continuing. If ambiguous, surface
   the top two options and ask to confirm.

3. Pull data in parallel.
   Once the competitor is resolved, run these calls concurrently:
   - Firmographics: size, industry, HQ, revenue range, funding
     stage, recent funding events.
   - Recent news and scoops: last 90 days. Leadership moves,
     product launches, M&A, layoffs, pricing changes.
   - Hiring signals: open roles in target functions. Hiring
     surges signal investment areas. Hiring gaps signal weakness.
   - Key leadership contacts: C-suite and VP level. Recent
     hires and departures. Tenure flags.
   - Customer intent signals: accounts in the competitor's
     known customer base expressing intent on your category
     or adjacent solutions.

4. Triage against the deal context.
   Each retrieval is raw context. Now decide what makes the brief.
   - News and scoops: use the deal context as the primary filter.
     For displacement, a leadership departure outranks a product
     launch. For renewal defence, a new product feature outranks
     a routine hiring announcement. Dedupe. Trim to 5-7 items.
   - Hiring signals: flag surges (investment signal) and gaps
     (weakness signal) separately. Connect them to the deal
     context — a hiring surge in engineering signals product
     investment; a gap in CS signals retention risk.
   - Customer intent: keep only accounts expressing intent
     that maps to your category or a clear switching signal.
     Drop noise.
   - Cross-reference: connect the dots. A CTO departure +
     engineering hiring freeze + customer intent on your
     category = one displacement angle, not three bullets.

5. Write displacement angles last.
   Re-read the full body. Write 3-5 displacement angles —
   each tied to a specific signal or data point from the brief.
   No generic talking points. No "we're better because X."
   Every angle must reference something that is actually
   happening at the competitor right now.

## Output Format

### Competitor Intel Brief — [Competitor Name]

Deal context: [restate in one line, or "general competitive
intelligence (no context supplied)" if defaulted.]

Situation. [2-3 sentences: who they are, the dominant story
at the competitor right now, and the specific signal that
makes this brief timely for the stated deal context.]

---

### Company Snapshot

| Field | Value |
|---|---|
| Website | |
| Industry | |
| Employees | |
| Revenue range | |
| HQ | |
| Funding stage | |
| Most recent funding | |

---

### Leadership & Hiring Signals

Recent executive moves and hiring patterns — retained because
they map to the deal context or suggest a non-obvious angle.

**Leadership moves:**
For each: name (initials), title, move type (hire / departure
/ promotion), date, one-line implication for the deal.

**Hiring signals:**
| Function | Signal | Open Roles | Implication |
|---|---|---|---|

Surge = 5+ open roles in one function. Gap = 0 open roles
in a function where you'd expect hiring.

---

### Recent News & Scoops

Filtered against the deal context. Group by Leadership /
Product / Financial / Strategic if 5+ items span categories.
Otherwise list flat.

For each: headline, date, one-line summary, implication for
the deal.

---

### Customer Intent Signals

Accounts in the competitor's customer base expressing intent
on your category or a clear switching signal.

| Account | Industry | Employees | Intent Topic | Signal Score | Signal Date |
|---|---|---|---|---|---|

Top targets: [3 accounts most worth reaching out to, with
a one-line rationale for each.]

Omit this section if no customer intent data was found.

---

### Displacement Angles

3-5 named angles, each tied to a specific signal from the
brief. No generic positioning. Every angle must reference
something happening at the competitor right now.

**Angle 1: [Name]**
Signal: [what's happening]
Angle: [how to use it in the deal]
Discovery question: [one question to ask the prospect that
surfaces this angle without stating it directly]

Repeat for each angle.

Omit if no your company context was supplied.

---

### Key Takeaways

3-5 bullets connecting the dots across sources, framed by
the deal context. Each must reference a specific signal,
contact, or moment from the brief. No generic advice.

---

---

From Lusha's Campus plays library: https://www.lusha.com/campus/plays/competitor-intel-skill/
