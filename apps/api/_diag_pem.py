import asyncio
import time
from sqlalchemy import select
from models.database import AsyncSessionLocal
from models.org import Organization
from services.github_service import normalize_pem


async def main():
    async with AsyncSessionLocal() as db:
        orgs = (await db.execute(select(Organization))).scalars().all()
        for org in orgs:
            key = org.github_private_key or ""
            print(f"\n=== org={org.id} app_id={org.github_app_id!r} installation_id={org.github_installation_id} ===")
            if not key:
                print("  github_private_key: <EMPTY>")
                continue
            lines = key.splitlines()
            print(f"  length: {len(key)} chars, lines: {len(lines)}")
            print(f"  has real newlines: {chr(10) in key}")
            print(f"  has literal backslash-n: {chr(92)+'n' in key}")
            print(f"  has BEGIN marker: {'-----BEGIN' in key}")
            print(f"  has END marker: {'-----END' in key}")
            print(f"  first line: {lines[0][:45]!r}" if lines else "  (no lines)")
            print(f"  last line : {lines[-1][:45]!r}" if lines else "")
            # Try to repair + sign
            from jose import jwt as jose_jwt
            try:
                fixed = normalize_pem(key)
                tok = jose_jwt.encode(
                    {"iat": int(time.time()) - 60, "exp": int(time.time()) + 600, "iss": org.github_app_id or "1"},
                    fixed, algorithm="RS256",
                )
                print(f"  >>> normalize_pem + sign: OK ({len(tok)} char JWT)")
                print(f"  >>> repaired lines: {len(fixed.splitlines())}")
            except Exception as exc:
                print(f"  >>> normalize_pem + sign FAILED: {type(exc).__name__}: {exc}")


asyncio.run(main())
