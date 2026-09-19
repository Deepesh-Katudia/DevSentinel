"use client";
import { CopyableUrl } from "@/components/ui/copyable-url";

/**
 * Sentry calls DevSentinel, not the other way round — so the user needs *our*
 * webhook URL (scoped to their org) to paste into Sentry, not a field to fill.
 */
export function SentryStep({ orgId }: { orgId: string }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
  const webhookUrl = `${apiBase}/webhooks/sentry?org_id=${encodeURIComponent(orgId)}`;

  return (
    <div className="space-y-3">
      <CopyableUrl label="Webhook URL" value={webhookUrl} />
      <ol className="text-[12px] text-[var(--ink-3)] space-y-1.5 list-decimal list-inside leading-relaxed">
        <li>
          In Sentry, open <b>Settings → Developer Settings → Custom Integrations</b> and create an{" "}
          <b>Internal Integration</b>.
        </li>
        <li>Paste the URL above into <b>Webhook URL</b> and enable the <b>issue</b> webhook.</li>
        <li>Save. New Sentry issues will open an incident room in DevSentinel.</li>
      </ol>
      <p className="text-[11px] text-[var(--ink-4)]">Optional — you can set this up later.</p>
    </div>
  );
}
