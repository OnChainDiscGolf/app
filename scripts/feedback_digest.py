#!/usr/bin/env python3
"""
On-Chain Disc Golf - Feedback Digest Script

This script fetches encrypted feedback (NIP-59 Gift Wraps) sent to the support npub,
decrypts them, and uses Claude to generate a summary digest.

Usage:
    python feedback_digest.py [--days 7] [--output terminal|file|nostr]

Environment Variables Required:
    SUPPORT_NSEC: The nsec for the support keypair (to decrypt messages)
    ANTHROPIC_API_KEY: Claude API key for generating summaries

Optional:
    NOSTR_RELAYS: Comma-separated relay URLs (defaults to common relays)
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import Optional

# Check for required dependencies
try:
    from nostr_sdk import Keys, Client, Filter, Kind, Timestamp, nip44, PublicKey, SecretKey
    HAS_NOSTR_SDK = True
except ImportError:
    HAS_NOSTR_SDK = False
    print("⚠️  nostr-sdk not installed. Install with: pip install nostr-sdk")

try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False
    print("⚠️  anthropic not installed. Install with: pip install anthropic")


# Default relays
DEFAULT_RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.snort.social",
    "wss://relay.nostr.net",
    "wss://relay.primal.net",
    "wss://nos.lol"
]

# Support npub (receives feedback)
SUPPORT_NPUB = "npub1xg8nc32sw6u3m337wzhk8gs3nqmh73r86z6a93s3hetca4jvktls68qyue"


def get_relays() -> list[str]:
    """Get relay list from environment or use defaults."""
    relays_env = os.getenv("NOSTR_RELAYS")
    if relays_env:
        return [r.strip() for r in relays_env.split(",")]
    return DEFAULT_RELAYS


def decrypt_gift_wrap(event, recipient_keys: Keys) -> Optional[dict]:
    """
    Decrypt a NIP-59 Gift Wrap event.
    
    Gift Wrap structure:
    1. Gift Wrap (kind 1059) - encrypted with ephemeral key
    2. Seal (kind 13) - encrypted to recipient
    3. Rumor (unsigned event) - the actual content
    """
    try:
        # Step 1: Decrypt gift wrap to get seal
        # The gift wrap is encrypted to our pubkey using an ephemeral key
        conversation_key = nip44.v2.utils.get_conversation_key(
            recipient_keys.secret_key(),
            PublicKey.parse(event.pubkey)
        )
        seal_json = nip44.v2.decrypt(event.content, conversation_key)
        seal = json.loads(seal_json)
        
        # Step 2: Decrypt seal to get rumor
        # The seal is encrypted from the sender's pubkey
        conversation_key_2 = nip44.v2.utils.get_conversation_key(
            recipient_keys.secret_key(),
            PublicKey.parse(seal["pubkey"])
        )
        rumor_json = nip44.v2.decrypt(seal["content"], conversation_key_2)
        rumor = json.loads(rumor_json)
        
        # Step 3: Parse the rumor content (our feedback JSON)
        try:
            feedback = json.loads(rumor.get("content", "{}"))
            feedback["_sender_pubkey"] = seal["pubkey"]
            feedback["_received_at"] = event.created_at
            return feedback
        except json.JSONDecodeError:
            # Content might be plain text
            return {
                "type": "unknown",
                "message": rumor.get("content", ""),
                "_sender_pubkey": seal["pubkey"],
                "_received_at": event.created_at
            }
            
    except Exception as e:
        print(f"  ⚠️  Failed to decrypt event {event.id[:16]}...: {e}")
        return None


def fetch_feedback(keys: Keys, days: int = 7) -> list[dict]:
    """Fetch and decrypt all feedback from the last N days."""
    print(f"\n📡 Connecting to relays...")
    
    client = Client(keys)
    relays = get_relays()
    
    for relay in relays:
        try:
            client.add_relay(relay)
            print(f"  ✓ Added {relay}")
        except Exception as e:
            print(f"  ✗ Failed to add {relay}: {e}")
    
    client.connect()
    print("  ✓ Connected")
    
    # Calculate timestamp for N days ago
    since = Timestamp.from_secs(int((datetime.now() - timedelta(days=days)).timestamp()))
    
    # Create filter for Gift Wraps addressed to us
    support_pubkey = PublicKey.parse(SUPPORT_NPUB)
    filter = Filter().kind(Kind(1059)).pubkey(support_pubkey).since(since)
    
    print(f"\n🔍 Fetching Gift Wraps from last {days} days...")
    events = client.get_events_of([filter], timedelta(seconds=10))
    print(f"  Found {len(events)} encrypted messages")
    
    # Decrypt each event
    feedback_items = []
    print("\n🔓 Decrypting messages...")
    
    for event in events:
        feedback = decrypt_gift_wrap(event, keys)
        if feedback:
            feedback_items.append(feedback)
            print(f"  ✓ Decrypted: {feedback.get('type', 'unknown')} - {feedback.get('message', '')[:50]}...")
    
    print(f"\n✅ Successfully decrypted {len(feedback_items)} feedback items")
    
    client.disconnect()
    return feedback_items


def generate_digest(feedback_items: list[dict]) -> str:
    """Use Claude to analyze feedback and generate a digest."""
    if not feedback_items:
        return "No feedback received in this period."
    
    if not HAS_ANTHROPIC:
        return "Anthropic SDK not installed. Cannot generate AI summary."
    
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return "ANTHROPIC_API_KEY not set. Cannot generate AI summary.\n\nRaw feedback:\n" + json.dumps(feedback_items, indent=2)
    
    print("\n🤖 Generating AI digest with Claude...")
    
    client = anthropic.Anthropic(api_key=api_key)
    
    # Prepare feedback for Claude
    feedback_text = json.dumps(feedback_items, indent=2, default=str)
    
    prompt = f"""You are analyzing user feedback for the On-Chain Disc Golf app - a disc golf scorecard app with Bitcoin/Lightning payments integration.

Analyze the following {len(feedback_items)} feedback submissions and provide:

1. **Executive Summary** (2-3 sentences)
   - Overall sentiment and key themes

2. **Bug Reports** (if any)
   - List each bug with severity (Critical/High/Medium/Low)
   - Include relevant device/platform info if provided
   - Suggested priority

3. **Feature Requests** (if any)
   - List each request
   - How many users mentioned similar things
   - Effort estimate (Easy/Medium/Hard)

4. **General Feedback** (if any)
   - Positive feedback worth noting
   - Pain points or confusion areas
   - UX improvement suggestions

5. **Recommended Actions**
   - Top 3 things to address this week
   - Any critical issues requiring immediate attention

Be concise but thorough. Focus on actionable insights.

Feedback Data:
```json
{feedback_text}
```"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return response.content[0].text


def format_output(digest: str, feedback_items: list[dict], days: int) -> str:
    """Format the final output."""
    header = f"""
╔══════════════════════════════════════════════════════════════════╗
║           ON-CHAIN DISC GOLF - FEEDBACK DIGEST                  ║
║                                                                  ║
║   Period: Last {days} days                                          ║
║   Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}                       ║
║   Total Feedback: {len(feedback_items)} items                                    ║
╚══════════════════════════════════════════════════════════════════╝
"""
    
    return header + "\n" + digest


def main():
    parser = argparse.ArgumentParser(description="Generate feedback digest for On-Chain Disc Golf")
    parser.add_argument("--days", type=int, default=7, help="Number of days to look back (default: 7)")
    parser.add_argument("--output", choices=["terminal", "file", "json"], default="terminal",
                       help="Output format (default: terminal)")
    parser.add_argument("--raw", action="store_true", help="Output raw feedback without AI summary")
    args = parser.parse_args()
    
    # Check dependencies
    if not HAS_NOSTR_SDK:
        print("\n❌ Error: nostr-sdk is required. Install with:")
        print("   pip install nostr-sdk")
        sys.exit(1)
    
    # Get support nsec from environment
    nsec = os.getenv("SUPPORT_NSEC")
    if not nsec:
        print("\n❌ Error: SUPPORT_NSEC environment variable not set.")
        print("   Set it with: export SUPPORT_NSEC='nsec1...'")
        sys.exit(1)
    
    try:
        keys = Keys.parse(nsec)
        print(f"🔑 Loaded support keypair: {keys.public_key().to_bech32()[:20]}...")
    except Exception as e:
        print(f"\n❌ Error: Invalid nsec: {e}")
        sys.exit(1)
    
    # Fetch feedback
    feedback_items = fetch_feedback(keys, days=args.days)
    
    if args.raw:
        # Output raw JSON
        output = json.dumps(feedback_items, indent=2, default=str)
    else:
        # Generate AI digest
        digest = generate_digest(feedback_items)
        output = format_output(digest, feedback_items, args.days)
    
    # Handle output
    if args.output == "terminal":
        print(output)
    elif args.output == "file":
        filename = f"feedback_digest_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{'json' if args.raw else 'md'}"
        with open(filename, "w") as f:
            f.write(output)
        print(f"\n📄 Saved to {filename}")
    elif args.output == "json":
        print(json.dumps({
            "generated_at": datetime.now().isoformat(),
            "period_days": args.days,
            "feedback_count": len(feedback_items),
            "digest": digest if not args.raw else None,
            "feedback": feedback_items
        }, indent=2, default=str))
    
    print("\n✅ Done!")


if __name__ == "__main__":
    main()

