#!/usr/bin/env python3
"""
On-Chain Disc Golf - Feedback Digest Script

This script fetches encrypted feedback (NIP-59 Gift Wraps) sent to the support npub,
decrypts them, and uses Claude to generate a summary digest.

Usage:
    python feedback_digest.py [--days 7] [--output terminal|file]

Environment Variables Required:
    SUPPORT_NSEC: The nsec for the support keypair (to decrypt messages)
    ANTHROPIC_API_KEY: Claude API key for generating summaries
"""

import os
import sys
import json
import argparse
import asyncio
import hashlib
import time
from datetime import datetime, timedelta
from typing import Optional
import websockets
import ssl

# For NIP-44 decryption
try:
    from secp256k1 import PrivateKey, PublicKey
    from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False

try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False

# Bech32 decoding for nsec/npub
BECH32_ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

def bech32_decode(bech: str) -> tuple[str, bytes]:
    """Decode a bech32 string."""
    if bech != bech.lower() and bech != bech.upper():
        raise ValueError("Mixed case")
    bech = bech.lower()
    pos = bech.rfind('1')
    if pos < 1 or pos + 7 > len(bech):
        raise ValueError("Invalid separator position")
    hrp = bech[:pos]
    data = [BECH32_ALPHABET.find(c) for c in bech[pos+1:]]
    if -1 in data:
        raise ValueError("Invalid character")
    # Convert 5-bit to 8-bit
    acc = 0
    bits = 0
    result = []
    for value in data[:-6]:  # Exclude checksum
        acc = (acc << 5) | value
        bits += 5
        while bits >= 8:
            bits -= 8
            result.append((acc >> bits) & 0xff)
    return hrp, bytes(result)

def nsec_to_hex(nsec: str) -> str:
    """Convert nsec to hex private key."""
    hrp, data = bech32_decode(nsec)
    if hrp != "nsec":
        raise ValueError(f"Expected nsec, got {hrp}")
    return data.hex()

def npub_to_hex(npub: str) -> str:
    """Convert npub to hex public key."""
    hrp, data = bech32_decode(npub)
    if hrp != "npub":
        raise ValueError(f"Expected npub, got {hrp}")
    return data.hex()

def hex_to_npub(hex_pubkey: str) -> str:
    """Convert hex pubkey to npub (simplified)."""
    return f"npub1...{hex_pubkey[:8]}"

# Default relays
DEFAULT_RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.snort.social", 
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


async def fetch_events_from_relay(relay_url: str, filter_obj: dict, timeout: int = 10) -> list[dict]:
    """Fetch events from a single relay."""
    events = []
    subscription_id = f"feedback_{int(time.time())}"
    
    try:
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        async with websockets.connect(relay_url, ssl=ssl_context, close_timeout=5) as ws:
            # Send REQ
            req = json.dumps(["REQ", subscription_id, filter_obj])
            await ws.send(req)
            
            # Receive events until EOSE or timeout
            start = time.time()
            while time.time() - start < timeout:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=2)
                    data = json.loads(msg)
                    
                    if data[0] == "EVENT" and data[1] == subscription_id:
                        events.append(data[2])
                    elif data[0] == "EOSE":
                        break
                except asyncio.TimeoutError:
                    break
            
            # Send CLOSE
            await ws.send(json.dumps(["CLOSE", subscription_id]))
            
    except Exception as e:
        print(f"  ⚠️  {relay_url}: {e}")
    
    return events


async def fetch_gift_wraps(support_pubkey_hex: str, since_timestamp: int) -> list[dict]:
    """Fetch Gift Wrap events from multiple relays."""
    filter_obj = {
        "kinds": [1059],  # Gift Wrap
        "#p": [support_pubkey_hex],  # Tagged to support pubkey
        "since": since_timestamp
    }
    
    relays = get_relays()
    all_events = []
    seen_ids = set()
    
    print(f"\n📡 Fetching from {len(relays)} relays...")
    
    tasks = [fetch_events_from_relay(relay, filter_obj) for relay in relays]
    results = await asyncio.gather(*tasks)
    
    for relay, events in zip(relays, results):
        for event in events:
            event_id = event.get("id", "")
            if event_id not in seen_ids:
                seen_ids.add(event_id)
                all_events.append(event)
        if events:
            print(f"  ✓ {relay}: {len(events)} events")
        else:
            print(f"  - {relay}: 0 events")
    
    return all_events


def hkdf_extract_expand(salt: bytes, ikm: bytes, info: bytes, length: int) -> bytes:
    """Simple HKDF implementation."""
    import hmac
    # Extract
    prk = hmac.new(salt if salt else b'\x00' * 32, ikm, hashlib.sha256).digest()
    # Expand
    t = b""
    okm = b""
    for i in range(1, (length + 31) // 32 + 1):
        t = hmac.new(prk, t + info + bytes([i]), hashlib.sha256).digest()
        okm += t
    return okm[:length]


def nip44_decrypt(ciphertext_b64: str, conversation_key: bytes) -> str:
    """Decrypt NIP-44 encrypted content."""
    import base64
    
    ciphertext = base64.b64decode(ciphertext_b64)
    
    # NIP-44 format: version (1) + nonce (32) + ciphertext + tag (16)
    version = ciphertext[0]
    if version != 2:
        raise ValueError(f"Unsupported NIP-44 version: {version}")
    
    nonce = ciphertext[1:33]
    encrypted = ciphertext[33:]
    
    # Derive encryption key using HKDF
    enc_key = hkdf_extract_expand(nonce, conversation_key, b"nip44-v2", 76)
    chacha_key = enc_key[:32]
    chacha_nonce = enc_key[32:44]
    
    # Decrypt with ChaCha20-Poly1305
    cipher = ChaCha20Poly1305(chacha_key)
    plaintext_padded = cipher.decrypt(chacha_nonce, encrypted, None)
    
    # Remove padding (first 2 bytes are length)
    length = int.from_bytes(plaintext_padded[:2], 'big')
    plaintext = plaintext_padded[2:2+length]
    
    return plaintext.decode('utf-8')


def get_conversation_key(sk_hex: str, pk_hex: str) -> bytes:
    """Compute NIP-44 conversation key (shared secret)."""
    sk = PrivateKey(bytes.fromhex(sk_hex))
    pk = PublicKey(bytes.fromhex("02" + pk_hex), raw=True)
    shared = sk.ecdh(pk.serialize())
    return shared


def decrypt_gift_wrap(event: dict, recipient_sk_hex: str) -> Optional[dict]:
    """
    Decrypt a NIP-59 Gift Wrap event.
    
    Gift Wrap structure:
    1. Gift Wrap (kind 1059) - encrypted with ephemeral key to recipient
    2. Seal (kind 13) - contains sender info, encrypted
    3. Rumor - the actual content
    """
    try:
        # Step 1: Decrypt gift wrap to get seal
        ephemeral_pk = event["pubkey"]
        conversation_key = get_conversation_key(recipient_sk_hex, ephemeral_pk)
        seal_json = nip44_decrypt(event["content"], conversation_key)
        seal = json.loads(seal_json)
        
        # Step 2: Decrypt seal to get rumor
        sender_pk = seal["pubkey"]
        conversation_key_2 = get_conversation_key(recipient_sk_hex, sender_pk)
        rumor_json = nip44_decrypt(seal["content"], conversation_key_2)
        rumor = json.loads(rumor_json)
        
        # Step 3: Parse the rumor content (our feedback JSON)
        try:
            feedback = json.loads(rumor.get("content", "{}"))
            feedback["_sender_pubkey"] = sender_pk
            feedback["_received_at"] = event.get("created_at", 0)
            return feedback
        except json.JSONDecodeError:
            return {
                "type": "unknown",
                "message": rumor.get("content", ""),
                "_sender_pubkey": sender_pk,
                "_received_at": event.get("created_at", 0)
            }
            
    except Exception as e:
        print(f"  ⚠️  Failed to decrypt: {str(e)[:50]}")
        return None


def fetch_feedback(sk_hex: str, days: int = 7) -> list[dict]:
    """Fetch and decrypt all feedback from the last N days."""
    support_pubkey_hex = npub_to_hex(SUPPORT_NPUB)
    since_timestamp = int((datetime.now() - timedelta(days=days)).timestamp())
    
    print(f"🔑 Support pubkey: {support_pubkey_hex[:16]}...")
    print(f"📅 Looking back {days} days (since {datetime.fromtimestamp(since_timestamp)})")
    
    # Fetch events
    events = asyncio.run(fetch_gift_wraps(support_pubkey_hex, since_timestamp))
    print(f"\n🔍 Found {len(events)} Gift Wrap events")
    
    if not events:
        return []
    
    # Decrypt each event
    feedback_items = []
    print("\n🔓 Decrypting messages...")
    
    for event in events:
        feedback = decrypt_gift_wrap(event, sk_hex)
        if feedback:
            feedback_items.append(feedback)
            msg_preview = feedback.get('message', '')[:40]
            print(f"  ✓ {feedback.get('type', 'unknown')}: {msg_preview}...")
    
    print(f"\n✅ Decrypted {len(feedback_items)}/{len(events)} messages")
    return feedback_items


def generate_digest(feedback_items: list[dict]) -> str:
    """Use Claude to analyze feedback and generate a digest."""
    if not feedback_items:
        return "📭 No feedback received in this period.\n\nThis could mean:\n- No users have submitted feedback yet\n- Feedback events haven't propagated to the queried relays\n- The time window didn't capture any submissions"
    
    if not HAS_ANTHROPIC:
        return "⚠️ Anthropic SDK not installed. Cannot generate AI summary.\n\nRaw feedback:\n" + json.dumps(feedback_items, indent=2, default=str)
    
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return "⚠️ ANTHROPIC_API_KEY not set.\n\nRaw feedback:\n" + json.dumps(feedback_items, indent=2, default=str)
    
    print("\n🤖 Generating AI digest with Claude...")
    
    client = anthropic.Anthropic(api_key=api_key)
    feedback_text = json.dumps(feedback_items, indent=2, default=str)
    
    prompt = f"""Analyze these {len(feedback_items)} feedback submissions for the On-Chain Disc Golf app (a disc golf scorecard with Bitcoin/Lightning payments).

Provide a concise digest with:

1. **Summary** - Overall sentiment and key themes (2-3 sentences)

2. **Bug Reports** - List bugs with severity (Critical/High/Medium/Low)

3. **Feature Requests** - List requests with effort estimate

4. **General Feedback** - Notable comments, UX issues

5. **Action Items** - Top 3 things to address

Be concise. Focus on actionable insights.

Feedback:
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
    header = f"""# 📬 On-Chain Disc Golf - Feedback Digest

**Period:** Last {days} days  
**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}  
**Total Feedback:** {len(feedback_items)} items

---

"""
    return header + digest


def main():
    parser = argparse.ArgumentParser(description="Generate feedback digest for On-Chain Disc Golf")
    parser.add_argument("--days", type=int, default=7, help="Days to look back (default: 7)")
    parser.add_argument("--output", choices=["terminal", "file"], default="terminal")
    parser.add_argument("--raw", action="store_true", help="Output raw feedback without AI summary")
    args = parser.parse_args()
    
    print("🏌️ On-Chain Disc Golf - Feedback Digest")
    print("=" * 45)
    
    # Check dependencies
    if not HAS_CRYPTO:
        print("\n❌ Missing crypto dependencies. Install with:")
        print("   pip install secp256k1 cryptography")
        sys.exit(1)
    
    # Get support nsec
    nsec = os.getenv("SUPPORT_NSEC")
    if not nsec:
        print("\n❌ SUPPORT_NSEC environment variable not set.")
        sys.exit(1)
    
    try:
        sk_hex = nsec_to_hex(nsec)
        print(f"🔑 Loaded keypair successfully")
    except Exception as e:
        print(f"\n❌ Invalid nsec: {e}")
        sys.exit(1)
    
    # Fetch feedback
    feedback_items = fetch_feedback(sk_hex, days=args.days)
    
    if args.raw:
        output = json.dumps(feedback_items, indent=2, default=str)
    else:
        digest = generate_digest(feedback_items)
        output = format_output(digest, feedback_items, args.days)
    
    # Handle output
    if args.output == "terminal":
        print("\n" + output)
    elif args.output == "file":
        filename = f"feedback_digest_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        with open(filename, "w") as f:
            f.write(output)
        print(f"\n📄 Saved to {filename}")
    
    print("\n✅ Done!")


if __name__ == "__main__":
    main()
