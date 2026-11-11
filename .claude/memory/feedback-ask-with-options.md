---
name: feedback-ask-with-options
description: "When asking the user clarifying/decision questions, ALWAYS use the options UI (AskUserQuestion tool), not plain prose questions"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 87018263-5262-4535-aa57-65bc1d4b7245
  modified: 2026-11-06T19:35:09.447Z
---

When asking the user clarifying or decision questions, **always use the AskUserQuestion tool (multiple-choice "with options" UI)** — not plain-text numbered questions. Stated explicitly 2026-11-07, and reinforces the earlier "Ask me questions with options please" request.

**Why:** the user strongly prefers picking from options over typing free-form answers; it's faster for them and keeps our back-and-forth tight.

**How to apply:** whenever their request says "ask me questions / don't assume" (a frequent pattern) — or any time I'd otherwise ask a clarifying/decision question — frame each question through AskUserQuestion with 2–4 concrete options (I can still recommend one by putting "(Recommended)" first). Only fall back to prose if the question genuinely can't be optioned (e.g. "paste the invoice number/ID"). Multi-select where choices aren't exclusive.
