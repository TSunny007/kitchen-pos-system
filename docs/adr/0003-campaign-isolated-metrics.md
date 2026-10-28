---
status: accepted
---

# Metrics are strictly Campaign-isolated, with no cross-Campaign view

The Metrics page is a post-event review tool, which naturally invites "how did this pop-up compare to the last one?" — a genuine alternative was an aggregate or comparison view across Campaigns. We rejected that for v1: every existing operational view (Terminal, Kitchen Display) is already scoped to exactly one Campaign at a time via the same selector, and mixing revenue/timing data across unrelated pop-up events (different menus, different days, different scale) would be misleading without deliberate normalization. Metrics reuses that single-Campaign scoping rather than introducing a new cross-Campaign aggregation model.

Cross-Campaign comparison is a real future need, but should be designed deliberately (e.g. explicit Campaign-vs-Campaign comparison, not a blended aggregate) rather than bolted onto the single-Campaign view.
