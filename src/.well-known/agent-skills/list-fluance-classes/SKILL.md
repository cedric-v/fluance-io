---
name: list-fluance-classes
description: List currently available Fluance in-person classes with dates, locations, prices, and remaining spots. Use when an agent needs current availability before recommending or booking a session.
---

# List Fluance Classes

Use this skill to retrieve the current Fluance in-person classes.

Primary endpoint:

- `GET https://fluance.io/api/courses`

What to return:

- `id`
- `title`
- `date`
- `time`
- `location`
- `price`
- `spotsRemaining`
- `isFull`

Operational guidance:

- Prefer classes with remaining spots.
- If the list is empty, say that no class is currently available and point to the booking page for later checks.
- Keep the `id` because it is required to open the booking flow.

Useful follow-up:

- Booking page: https://fluance.io/presentiel/reserver/
