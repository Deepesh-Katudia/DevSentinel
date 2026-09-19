"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteStep({ orgId, token }: { orgId: string; token: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendInvite() {
    const address = email.trim().toLowerCase();
    setError(null);
    if (!EMAIL_PATTERN.test(address)) {
      setError("Enter a valid email address.");
      return;
    }
    if (sent.includes(address)) {
      setError(`${address} has already been invited.`);
      return;
    }

    setIsSending(true);
    try {
      await apiFetch("/orgs/invite", token, {
        method: "POST",
        orgId,
        body: JSON.stringify({ email: address, role: "member" }),
      });
      setSent((prev) => [...prev, address]);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1.5">
          Invite by email
        </label>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendInvite();
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-md px-3.5 py-2.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--ink-3)] transition-colors"
          />
          <Button type="submit" variant="outline" size="sm" disabled={isSending || !email.trim()}>
            {isSending ? "Sending…" : "Invite"}
          </Button>
        </form>
      </div>

      {error && <p className="text-[12px] text-[var(--neg)]">{error}</p>}

      {sent.length > 0 && (
        <ul className="space-y-1">
          {sent.map((address) => (
            <li key={address} className="flex items-center gap-1.5 text-[12px] text-[var(--ink-3)]">
              <Check size={12} className="text-[var(--pos)]" /> Invitation sent to {address}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-[var(--ink-4)]">Optional — invite more teammates later in Settings.</p>
    </div>
  );
}
