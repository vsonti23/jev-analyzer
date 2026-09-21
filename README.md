# Job Sieve

A local-first Chrome extension that filters loaded LinkedIn, Greenhouse, and Lever job cards by freshness, location, sponsorship policy, and profile fit. This initial milestone uses deterministic local matching; the Jev integration is deliberately not wired until a backend can keep the API key out of the extension.

## Load it in Chrome

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked**.
3. Select this repository directory.
4. Open the extension's **Profile & filters** page and save your target roles and skills.
5. Visit a supported job page, then select **Scan loaded jobs** from the extension popup.

Only cards already loaded in the page are processed. A listing without its full description is marked **Check**. A job older than the configured time window is rejected locally without a classifier call.

## Current support and limitations

- LinkedIn card extraction is intentionally conservative and page markup can change.
- Greenhouse and Lever list cards are supported provisionally; full detail extraction and Jev classification are next milestones.
- This version does not make network calls or upload profile/job data.
- A score is fit against entered fields, not a probability of getting hired.

## Development milestones

See [HANDOFF_PLAN.md](HANDOFF_PLAN.md) for the full multi-agent implementation plan, contracts, and verification criteria.
