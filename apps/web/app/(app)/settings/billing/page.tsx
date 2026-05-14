// apps/web/app/(app)/settings/billing/page.tsx
import { Button } from "@/components/ui/button";
import { Check, CreditCard, FileText } from "lucide-react";
import Link from "next/link";

const plans = [
  { name: "Free",  price: "$0",  features: ["1 repo", "50 reviews/mo", "7-day history"],              current: false },
  { name: "Pro",   price: "$29", features: ["Unlimited repos", "Unlimited reviews", "90-day history"], current: true  },
  { name: "Team",  price: "$79", features: ["Everything in Pro", "SSO", "1-year history", "SLA"],      current: false },
];

const invoices = [
  { date: "May 1, 2026",  amount: "$29.00", status: "Paid" },
  { date: "Apr 1, 2026",  amount: "$29.00", status: "Paid" },
  { date: "Mar 1, 2026",  amount: "$29.00", status: "Paid" },
];

export default function BillingPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-[28px] font-serif font-bold text-[var(--ink)]">Billing</h1>
        <p className="text-[14px] text-[var(--ink-4)] mt-1">
          Manage your subscription and payment details
        </p>
      </div>

      {/* Current plan */}
      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 shadow-sm mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">Current plan</h2>
          <span className="text-[11px] font-semibold bg-[var(--surface)] border border-[var(--border)] px-2.5 py-1 rounded-full text-[var(--ink-3)]">
            Pro · Renews Jun 1, 2026
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-[8px] p-4 border ${
                plan.current
                  ? "border-[var(--ink)] bg-[var(--card)]"
                  : "border-[var(--border)] bg-[var(--bg)]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[14px] font-semibold text-[var(--ink)]">{plan.name}</span>
                <span className="text-[16px] font-serif font-bold text-[var(--ink)]">{plan.price}<span className="text-[11px] font-sans text-[var(--ink-4)]">/mo</span></span>
              </div>
              <ul className="space-y-1 mb-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-[11px] text-[var(--ink-3)]">
                    <Check size={10} className="text-[var(--pos)] flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.current ? (
                <span className="text-[10px] font-semibold text-[var(--ink-3)]">Current plan</span>
              ) : (
                <Button variant="outline" size="sm" className="w-full text-[11px]" asChild>
                  <Link href="/pricing">
                    {plan.name === "Team" ? "Upgrade" : "Downgrade"}
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Payment method */}
      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 shadow-sm mb-5">
        <h2 className="text-[15px] font-semibold text-[var(--ink)] mb-4">Payment method</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-7 bg-[var(--card)] border border-[var(--border)] rounded flex items-center justify-center">
            <CreditCard size={14} className="text-[var(--ink-3)]" />
          </div>
          <div>
            <p className="text-[13px] text-[var(--ink)]">Visa ending in 4242</p>
            <p className="text-[11px] text-[var(--ink-4)]">Expires 12/2027</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto">
            Update card
          </Button>
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 shadow-sm">
        <h2 className="text-[15px] font-semibold text-[var(--ink)] mb-4">Invoices</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["Date", "Amount", "Status", ""].map((h) => (
                <th key={h} className="text-left pb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.date} className="border-b border-[var(--surface)] last:border-0">
                <td className="py-3 text-[13px] text-[var(--ink-2)]">{inv.date}</td>
                <td className="py-3 text-[13px] text-[var(--ink-2)]">{inv.amount}</td>
                <td className="py-3">
                  <span className="text-[10px] font-semibold bg-[#d8e8d8] text-[#2e5a2e] border border-[#b0ccb0] px-2 py-0.5 rounded">
                    {inv.status}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <Button variant="ghost" size="sm" className="text-[11px] gap-1">
                    <FileText size={11} /> Download
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
