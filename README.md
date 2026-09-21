# Job Sieve

A local-first Chrome extension that filters loaded LinkedIn, Greenhouse, and Lever job cards by freshness, location, sponsorship policy, and profile fit. It uses local filtering first, then optionally asks Jev to classify a full job description through a local backend.

## Load it in Chrome

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked**.
3. Run `npm run build`, then select this repository directory.
4. Click the extension's reload button any time you pull a new commit.
5. Open the extension's **Profile & filters** page and save your target roles and skills.
6. Visit a supported job page, then select **Scan loaded jobs** from the extension popup.

Only cards already loaded in the page are processed. A listing without its full description is marked **Check**. A job older than the configured time window is rejected locally without a classifier call.

If LinkedIn finishes navigating after the extension loads, clicking **Scan loaded jobs** injects the scanner into that user-selected tab on demand.

## Enable Jev classification

Set `TYPESAFE_API_KEY` in a local terminal and run `npm run server`. The extension uses `http://localhost:8787` by default. The key stays in the backend environment; it is never stored in the extension.

## Current support and limitations

- LinkedIn card extraction supports both `linkedin.com/jobs/*` and `www.linkedin.com/jobs/*`; page markup can still change.
- Greenhouse and Lever list cards are supported provisionally; full detail extraction and Jev classification are next milestones.
- Without the optional local backend, full descriptions show **Check · Classifier unavailable** after local filtering.
- A score is fit against entered fields, not a probability of getting hired.

## Development milestones

See [HANDOFF_PLAN.md](HANDOFF_PLAN.md) for the full multi-agent implementation plan, contracts, and verification criteria.
