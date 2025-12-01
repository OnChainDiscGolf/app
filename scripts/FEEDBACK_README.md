# On-Chain Disc Golf - Feedback System

## How It Works

1. Users tap **"Send Feedback"** in the app (Settings menu)
2. Feedback is encrypted and sent as a **NIP-59 Gift Wrap** to your Support npub
3. You read the feedback in any Nostr client

## Reading Feedback

### Your Support npub
```
npub1xg8nc32sw6u3m337wzhk8gs3nqmh73r86z6a93s3hetca4jvktls68qyue
```

### How to Read Messages

1. **Open a Nostr client** (Amethyst, Primal, 0xchat, etc.)
2. **Login with the Support keypair** (use Amber for remote signing)
3. **Check your DMs** - feedback appears as encrypted messages

That's it! No automation needed.

---

## Optional: Local AI Digest

If you want an AI-powered summary of feedback, you can run the script locally:

```bash
cd scripts
pip install anthropic websockets coincurve cryptography

export SUPPORT_NSEC='nsec1...'
export ANTHROPIC_API_KEY='sk-ant-...'

python feedback_digest.py --days 7
```

This fetches feedback from the last 7 days and generates a Claude-powered summary.

