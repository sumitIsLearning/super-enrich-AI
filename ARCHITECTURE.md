ARCHITECTURE.md

Running log of what got built, why, and how pieces connect. One entry per increment, four lines max each. This is your interview-prep doc as it accumulates — don't let it go stale.


[Example — delete once real entries start]

Feature: Rate limiter, token bucket
Why this shape: Lazy refill (calculated on each call) instead of a background timer — avoids a setInterval running when the app is idle.
Connects to: Called by API middleware before every request; depends on Date.now() only, no external state.
Breaks if removed: No cap on request rate — a single client could exhaust downstream resources.


[Next entry goes here]

Feature:
Why this shape:
Connects to:
Breaks if removed: