# Brevo verification email setup

Supabase Auth remains responsible for users, passwords, sessions, and verification. Brevo is the configured SMTP delivery provider for the intended project. No Brevo key belongs in frontend code or Git.

## Saved configuration

- Custom SMTP enabled in Supabase Authentication settings.
- Host smtp-relay.brevo.com, port 587, and SMTP login from the correct user-selected Brevo account.
- Verified sender configured with display name Class Attendance.
- Signup subject: Your Class Attendance verification code.
- Signup body: `supabase/templates/confirmation.html`, using `{{ .Token }}` instead of a confirmation link.

The app accepts the project's eight-digit code and uses `verifyOtp({ email, token, type: 'email' })`. Resending uses signup confirmation and a client cooldown; server rate limits remain authoritative.

## Verified delivery

Initial SMTP requests failed with 525 / 5.7.1 Unauthorized IP address. With explicit user approval, only the blocked Supabase source IP 43.203.42.234 was authorized in Brevo. IP blocking remains enabled. Future egress changes may require reviewing another specific source address.

A new signup to a real Gmail inbox alias was sent and delivered by Brevo on 23 October 2026 at 19:11 Asia/Calcutta. The user received the code; entering it in the local app returned a real confirmed Supabase session. Independent password login and getUser checks then passed. The code and SMTP credential are not stored in project files.

Brevo rewrites the free Gmail sender to its authenticated delivery domain. A verified custom sender domain can be configured later for branded delivery; it is not required for the successful test above.

References:
- https://supabase.com/docs/guides/auth/auth-smtp
- https://developers.brevo.com/docs/supabase-smtp-integration
- https://supabase.com/docs/guides/auth/auth-email-templates
