# Experiments

- `captcha-attach/probe.js` — **promoted concept, historical prototype**.
  The Chrome-first attachment approach was rebuilt with lifecycle,
  profile-ownership and loopback-boundary tests in `chrome-session.js`
  and integrated through `controller.js` for r9. The original probe is
  retained for provenance, is not loaded by production, and hard-codes
  historical r8/staging paths. Do not run it over an active installation.
  Actual observations and limitations are recorded in
  [the Ubuntu deployment protocol](../tests/manual/ubuntu25-r8.md).
