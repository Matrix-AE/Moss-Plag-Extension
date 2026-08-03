---
train: packages
bump: patch
security: false
approval: standard
---

Fix a started Pair Check run hanging on "Run in progress" forever. The popup now drives the run through named phases to a terminal state, enforces a 90s deadline (including after the popup is reopened), surfaces errors with recovery actions, credits back a run when nothing was submitted, and produces a clearly labelled local demo report link instead of a silent spinner.
