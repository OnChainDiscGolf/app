# Feedback System Setup Guide

This guide explains how to set up the automated feedback digest system for On-Chain Disc Golf.

## Overview

The feedback system works as follows:

1. **Users** send feedback via the in-app "Send Feedback" button
2. **Feedback** is encrypted using NIP-59 (Gift Wrap) and sent to the Support npub
3. **GitHub Action** runs weekly (or on-demand) to:
   - Fetch encrypted feedback from Nostr relays
   - Decrypt using the Support nsec
   - Generate an AI summary using Claude
   - Create a GitHub Issue with the digest

## Support Keypair

- **npub**: `npub1xg8nc32sw6u3m337wzhk8gs3nqmh73r86z6a93s3hetca4jvktls68qyue`
- **nsec**: Keep this secret! Store it in GitHub Secrets.

## Setup Steps

### 1. Get Your Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account or sign in
3. Go to API Keys → Create Key
4. Copy the key (starts with `sk-ant-...`)

### 2. Add GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions → New repository secret

Add these two secrets:

| Secret Name | Value |
|-------------|-------|
| `SUPPORT_NSEC` | Your support keypair's nsec (starts with `nsec1...`) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (starts with `sk-ant-...`) |

### 3. Enable GitHub Actions

1. Go to your repository → Actions
2. If prompted, enable Actions for this repository
3. The "Weekly Feedback Digest" workflow should appear

### 4. Test the Workflow

1. Go to Actions → "Weekly Feedback Digest"
2. Click "Run workflow"
3. Choose the number of days to look back (default: 7)
4. Click "Run workflow"

The workflow will:
- Fetch feedback from the last N days
- Generate an AI digest
- Create a GitHub Issue with the results
- Upload the digest as an artifact

## Running Locally

You can also run the digest script locally:

```bash
# Install dependencies
cd scripts
pip install -r requirements.txt

# Set environment variables
export SUPPORT_NSEC='nsec1...'
export ANTHROPIC_API_KEY='sk-ant-...'

# Run the digest
python feedback_digest.py --days 7
```

### Command Line Options

```
--days N       Look back N days (default: 7)
--output MODE  Output mode: terminal, file, or json (default: terminal)
--raw          Output raw feedback without AI summary
```

### Examples

```bash
# Last 7 days, terminal output
python feedback_digest.py

# Last 30 days, save to file
python feedback_digest.py --days 30 --output file

# Raw JSON output (no AI summary)
python feedback_digest.py --raw --output json
```

## Checking Feedback Manually

You can also read feedback using any Nostr client that supports NIP-17/NIP-59:

1. Open Amethyst, Damus, Primal, or similar
2. Login with your Support keypair (via Amber or nsec)
3. Go to Direct Messages / DMs
4. Feedback will appear as encrypted messages

The messages contain JSON like:
```json
{
  "type": "bug",
  "message": "The payout screen is confusing...",
  "currentPath": "/wallet",
  "sentAt": "2025-12-01T...",
  "logs": {
    "device": { "platform": "Android", "browser": "Chrome", ... },
    "appState": { "walletMode": "cashu", ... },
    "errors": [ ... ],
    "navigation": [ ... ]
  }
}
```

## Troubleshooting

### "No feedback found"

- Check that the Support npub in `feedbackService.ts` matches your keypair
- Ensure users have actually sent feedback
- Try increasing the `--days` parameter

### "Failed to decrypt"

- Verify the SUPPORT_NSEC is correct
- Ensure it matches the npub in the app's feedbackService

### "ANTHROPIC_API_KEY not set"

- Make sure the secret is added to GitHub (for Actions)
- Or exported in your terminal (for local runs)

### Workflow fails

- Check the Actions log for specific error messages
- Verify both secrets are set correctly
- Try running locally to debug

## Security Notes

- The Support nsec is stored encrypted in GitHub Secrets
- GitHub Actions only expose secrets to workflows in the same repository
- Feedback is encrypted end-to-end using NIP-44
- Only the Support keypair can decrypt feedback

## Future Improvements

- [ ] Send digest via Nostr DM instead of/in addition to GitHub Issue
- [ ] Add email notifications
- [ ] Store historical digests for trend analysis
- [ ] Add sentiment scoring
- [ ] Auto-create GitHub Issues for critical bugs

