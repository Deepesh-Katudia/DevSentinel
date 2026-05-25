// apps/web/app/(app)/settings/billing/page.tsx
import { BillingContent } from "@/components/settings/billing-content";

export default function BillingPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-[28px] font-serif font-bold text-[var(--ink)]">Billing</h1>
        <p className="text-[14px] text-[var(--ink-4)] mt-1">
          Manage your subscription and payment details
        </p>
      </div>
      <BillingContent />
    </>
  );
}
