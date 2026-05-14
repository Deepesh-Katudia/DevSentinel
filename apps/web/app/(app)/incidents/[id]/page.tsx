import { IncidentRoom } from "@/components/incidents/incident-room";
import type { Incident } from "@/types";

// Mock data — replaced by API call with real auth token
const mockIncident: Incident = {
  id: "i1",
  orgId: "org1",
  repoId: "r1",
  repoName: "api-service",
  title: "NullPointerException in payment processor",
  severity: "P1",
  status: "active",
  rootCause:
    "Missing null check on user.paymentMethod before accessing its properties. Triggered when guest checkout flow skips method selection.",
  suggestedFix:
    "Add null guard: `if (!user.paymentMethod) return handleMissingPaymentMethod()` on line 87 of checkout.ts before accessing paymentMethod.type.",
  affectedFiles: [
    "src/checkout/processor.ts",
    "src/users/payment-methods.ts",
  ],
  usersAffected: 1247,
  messages: [
    {
      id: "m1",
      incidentId: "i1",
      authorName: "DevSentinel AI",
      authorInitials: "AI",
      body: "I've analyzed the stack trace. Root cause is a null reference on `user.paymentMethod.type` at checkout/processor.ts:87. Last commit to this file was by jsmith (2h ago). Suggested fix: add null guard before accessing `.type`.",
      isAI: true,
      createdAt: new Date(Date.now() - 8 * 60000).toISOString(),
    },
    {
      id: "m2",
      incidentId: "i1",
      authorName: "James Smith",
      authorInitials: "JS",
      body: "On it — I can reproduce this locally. Pushing a hotfix now.",
      isAI: false,
      createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    },
  ],
  createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
};

export default function IncidentRoomPage({
  params,
}: {
  params: { id: string };
}) {
  return <IncidentRoom incident={mockIncident} wsToken={null} />;
}
