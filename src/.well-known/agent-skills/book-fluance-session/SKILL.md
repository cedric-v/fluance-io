---
name: book-fluance-session
description: Open the Fluance booking flow for a selected class and explain the information needed to complete the reservation. Use when a user has chosen a course and wants to reserve a session.
---

# Book a Fluance Session

Use this skill after a specific Fluance class has been selected.

Required input:

- `courseId`

Booking flow URL:

- French: `https://fluance.io/presentiel/reserver/`
- English: `https://fluance.io/en/presentiel/reserver/`

What the user should expect:

- A free first session is available for newcomers.
- Existing pass holders can use their active pass.
- Other users can pay per session or choose a pass.
- The flow asks for email, first name, and last name. Phone is optional.

If the selected class is already full:

- The system can place the user on a waitlist.
