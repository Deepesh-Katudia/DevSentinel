"""
Run from apps/api/:  python debug_token.py

Paste your Supabase access_token when prompted.
Get it from: browser DevTools → Application → Local Storage → supabase.auth.token
  OR from the Network tab: look at any /orgs request → Authorization header → strip 'Bearer '
"""
import sys
import base64
import json
from dotenv import load_dotenv
import os

load_dotenv()

secret = os.getenv("SUPABASE_JWT_SECRET", "")
print(f"\n--- JWT Secret ---")
print(f"Length  : {len(secret)} chars")
print(f"Preview : {secret[:12]}...")
print(f"Looks like UUID? {len(secret) == 36 and secret.count('-') == 4}")

token = input("\nPaste your Supabase access_token (from browser): ").strip()
if not token:
    print("No token provided.")
    sys.exit(1)

# Decode header + payload WITHOUT verifying signature
parts = token.split(".")
if len(parts) != 3:
    print("Not a valid JWT (expected 3 parts separated by '.')")
    sys.exit(1)

def b64_decode(s):
    s += "=" * (4 - len(s) % 4)
    return json.loads(base64.urlsafe_b64decode(s))

header  = b64_decode(parts[0])
payload = b64_decode(parts[1])

print(f"\n--- Token Header ---")
print(json.dumps(header, indent=2))

print(f"\n--- Token Payload (unverified) ---")
print(json.dumps(payload, indent=2))

print(f"\n--- Verification attempt ---")
try:
    from jose import jwt, JWTError
    result = jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")
    print("✅ SUCCESS — token verified correctly")
    print(json.dumps(result, indent=2))
except JWTError as e:
    print(f"❌ FAILED: {e}")
    print("\n--- Trying WITHOUT audience check ---")
    try:
        result = jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
        print("✅ Passes without audience check — 'aud' claim mismatch is the issue")
        print(f"   Token has aud={payload.get('aud')!r}, but code expects 'authenticated'")
    except JWTError as e2:
        print(f"❌ Still fails: {e2} — SUPABASE_JWT_SECRET is almost certainly wrong")
        print(f"\n   → Go to Supabase Dashboard → Settings → API → JWT Settings → copy JWT Secret")
        print(f"   → It should be a long random string, NOT a UUID")
