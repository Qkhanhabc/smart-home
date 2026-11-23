# Password recovery

The login page links to `/forgot-password.html`. Recovery uses the SMTP settings already used by smoke alert emails (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and optionally `SMTP_SECURE`/`SMTP_FROM`). Set `PUBLIC_BASE_URL` to the website's public origin, for example `https://smarthome.example.com`; for local development it can be `http://localhost:3000`.

The reset link contains a cryptographically random, single-use token valid for 15 minutes. MongoDB stores only its SHA-256 hash. Requests are rate limited per client IP and email in the running backend process, and the response does not reveal whether an email belongs to an account. After a successful reset, all existing login sessions and outstanding reset links for that account are deleted.

For production, serve the website over HTTPS, configure a trusted SMTP provider, and set `PUBLIC_BASE_URL` to the exact HTTPS origin users visit. Restart the backend after changing `.env`.
