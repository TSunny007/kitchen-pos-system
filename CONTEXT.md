# Kitchen POS

A point-of-sale app for taking and tracking orders at pop-up food events, scoped by Campaign (Terminal for order-taking, Kitchen Display for the kitchen line).

## Language

**Cup Label**:
A physical label printed for a single OrderItem the moment kitchen staff move it from `new` to `in_progress` on the Kitchen Display. Only items whose Category is flagged as requiring one produce a label — the flag lives on the Category, never on individual Items within it. Carries the item name, its modifiers, the customer name, and the order number (`Order.id`).
_Avoid_: Kitchen ticket, receipt — both imply a whole-order document; a Cup Label is always per-item.

**Print Agent**:
A process running on the event venue's local network that bridges the cloud-hosted app to a physical networked thermal printer. Exists because the app is Vercel-hosted with no server-side integration today, and the printer is not reachable from the public internet.

**Print Job**:
A queued request for the Print Agent to print one Cup Label, created the moment its OrderItem transitions to `in_progress`. The app has no way to know whether the physical print actually succeeded — a Print Job is marked handed off to the printer, not confirmed printed. A Print Job can also end up cancelled: whoever starts the Print Agent is asked what to do with any backlog left over from a previous session, and can choose to discard it rather than work through it. This is always a deliberate choice at agent startup, never automatic — there's no campaign- or category-level switch to stop jobs from being queued in the first place.
