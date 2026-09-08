---
name: Operation Endgame — Structure intake upload requirement
description: Future feature: Structure intake should accept typed text AND uploaded strategy artifacts, both feeding the same process
type: project
originSessionId: d87e5075-91e4-48f1-9a47-2ee61df1d843
---
Structure intake should eventually support two input modes:
1. Typed mission/goal text (current path)
2. Uploaded strategy artifacts (PDFs, docs, notes)

Both feed the same Structure intake process. Neither creates a separate planning module. The upload path is an alternative input surface, not a new feature.

**Why:** User explicitly flagged this as the next major feature after Core Mission is visible in the runtime spine. Keeping it tracked here to avoid scope drift — do not build until Core Mission consumption is fully proven.

**How to apply:** When Structure intake work is discussed, remember this requirement exists and don't build a separate planning module for uploads. The intake contract (extraction → lanes → milestones → plan) is the same regardless of input source.
