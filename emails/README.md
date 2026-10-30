# NagarTrace email templates (PREP ONLY - nothing here sends)

Branded HTML templates for the consented-mail roadmap. Palette and voice match
the site (--paper #f4f3ee, --navy #0e1b2c, --accent #ff6b1a, Inter/system stack).

**Sending status: no email has ever been sent by NagarTrace.** The live product
has no SMTP provider (Supabase default mailer is dev-only), no verified
recipients for authorities, and no per-user consent records for mail access.
Every template below is inert text until ALL of these exist for a given send:

1. A verified recipient address (for complaints/reminders: the actual
   responsible authority's published contact - never a guessed one).
2. The reporting user's explicit approval of that exact message text.
3. Where Gmail access is involved, a separate consent scope - product signup
   does not grant it.

Merge fields use {{FIELD}}. `{{TOKEN}}` in verify-email.html is the Supabase
numeric-OTP slot (requires the custom SMTP + template change, peer-owned).

Files:
- verify-email.html - branded signup verification (numeric OTP variant)
- welcome.html - post-verification welcome
- reminder-day7.html / reminder-day10.html / reminder-day15.html - report follow-ups TO THE REPORTER (status nudge, not authority contact)
- authority-reminder.html - draft reminder TO the responsible authority (needs verified recipient + per-report approval)
- escalation-notice.html - day-30 escalation draft TO the next level up (same gates)
