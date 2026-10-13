# Agent entitlement policy (synthetic, for the demo)
1. A trader sees only their own desk's books. Another desk's clients, counterparties, sizes, prices, positions and desk-level exposure are confidential.
2. Rows from another desk that sit in a trader's own book may be shown with detail withheld; their aggregate valuation impact on the trader's own book may be shown.
3. No AI agent may write to prices or bookings. Any such change needs a human.
4. Firm-wide or cross-desk aggregates need human approval for a single-desk trader (combining aggregates can reveal another desk).
5. Broad requests (e.g. "all books") must be limited to the requester's own books.
6. Free-text fields on another desk's rows are withheld (they can name clients).
7. Temporary grants: narrowest catalogued form, task-scoped, max 15 minutes.
8. Permanent changes must be the narrowest rule that serves a legitimate, routine need.
