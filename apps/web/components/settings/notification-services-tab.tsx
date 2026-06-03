"use client";
import { useState, useEffect, useCallback } from "react";
import { Bell, Plus, Trash2, AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOrg } from "@/contexts/org-context";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import InteractiveHoverButton from "@/components/ui/interactive-hover-button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationChannel {
  id: string;
  name: string;
  channelType: string;
  emails: string[];
  events: string[];
  isEnabled: boolean;
  createdAt: string;
}

interface ChannelFormState {
  name: string;
  emailInput: string;
  emails: string[];
  events: string[];
  isEnabled: boolean;
}

const EMPTY_FORM: ChannelFormState = {
  name: "",
  emailInput: "",
  emails: [],
  events: ["incident_created", "pr_review_completed"],
  isEnabled: true,
};

const EVENT_LABELS: Record<string, string> = {
  incident_created: "New incident created",
  pr_review_completed: "PR review completed",
};

// ─── Email tag input ──────────────────────────────────────────────────────────

function EmailTagInput({
  emails,
  input,
  onChange,
  onInputChange,
  disabled,
}: {
  emails: string[];
  input: string;
  onChange: (emails: string[]) => void;
  onInputChange: (v: string) => void;
  disabled: boolean;
}) {
  function addEmail(raw: string) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed || emails.includes(trimmed)) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    onChange([...emails, trimmed]);
    onInputChange("");
  }

  function removeEmail(email: string) {
    onChange(emails.filter((e) => e !== email));
  }

  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 flex flex-wrap gap-1.5 min-h-[38px] focus-within:border-[var(--ink-3)] transition-colors">
      {emails.map((email) => (
        <span
          key={email}
          className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-0.5 text-[11px] text-[var(--ink-2)]"
        >
          {email}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeEmail(email)}
              className="text-[var(--ink-4)] hover:text-[var(--neg)] ml-0.5"
            >
              <X size={10} />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          type="email"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addEmail(input);
            }
            if (e.key === "Backspace" && !input && emails.length) {
              onChange(emails.slice(0, -1));
            }
          }}
          onBlur={() => addEmail(input)}
          placeholder={emails.length === 0 ? "Type email and press Enter" : ""}
          className="flex-1 min-w-[180px] text-[13px] text-[var(--ink)] bg-transparent outline-none placeholder:text-[var(--ink-4)]"
        />
      )}
    </div>
  );
}

// ─── Channel row ──────────────────────────────────────────────────────────────

function ChannelRow({
  channel,
  isAdmin,
  onToggle,
  onEdit,
  onDelete,
}: {
  channel: NotificationChannel;
  isAdmin: boolean;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (channel: NotificationChannel) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[var(--surface)] last:border-0 gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[13px] font-medium text-[var(--ink)]">{channel.name}</span>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${
              channel.isEnabled
                ? "bg-[#d8e8d8] border-[#b0ccb0] text-[#2e5a2e]"
                : "bg-[var(--surface)] border-[var(--border)] text-[var(--ink-4)]"
            }`}
          >
            {channel.isEnabled ? "enabled" : "disabled"}
          </span>
        </div>
        <p className="text-[12px] text-[var(--ink-3)] truncate">
          {channel.emails.join(", ") || "No recipients"}
        </p>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {channel.events.map((ev) => (
            <span
              key={ev}
              className="text-[10px] font-medium px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--ink-4)]"
            >
              {EVENT_LABELS[ev] ?? ev}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isAdmin && (
          <>
            <button
              onClick={() => onToggle(channel.id, !channel.isEnabled)}
              title={channel.isEnabled ? "Disable" : "Enable"}
              className="text-[11px] px-2.5 py-1.5 rounded border border-[var(--border)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-[var(--ink-3)] transition-colors"
            >
              {channel.isEnabled ? "Disable" : "Enable"}
            </button>
            <button
              onClick={() => onEdit(channel)}
              className="text-[11px] px-2.5 py-1.5 rounded border border-[var(--border)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-[var(--ink-3)] transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(channel.id)}
              title="Delete channel"
              className="text-[11px] px-2.5 py-1.5 rounded border border-[var(--border)] text-[var(--ink-3)] hover:text-[var(--neg)] hover:border-[var(--neg)] transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotificationServicesTab() {
  const { org, role } = useOrg();
  const { session } = useAuth();
  const isAdmin = role === "admin";

  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ChannelFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);


  const token = session?.access_token ?? "";

  const loadChannels = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setListError(null);
    try {
      const res = await apiFetch<{ data: NotificationChannel[] }>(
        "/notifications/channels",
        token,
        { orgId: org.id }
      );
      setChannels(res.data ?? []);
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, [org, token]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveMsg(null);
    setFormOpen(true);
  }

  function openEdit(channel: NotificationChannel) {
    setEditingId(channel.id);
    setForm({
      name: channel.name,
      emailInput: "",
      emails: channel.emails,
      events: channel.events,
      isEnabled: channel.isEnabled,
    });
    setSaveMsg(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveMsg(null);
  }

  async function saveChannel() {
    if (!org || !form.name.trim() || form.emails.length === 0) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const body = {
        name: form.name.trim(),
        emails: form.emails,
        events: form.events,
        is_enabled: form.isEnabled,
      };
      if (editingId) {
        const res = await apiFetch<{ data: NotificationChannel }>(
          `/notifications/channels/${editingId}`,
          token,
          { method: "PATCH", body: JSON.stringify(body), orgId: org.id }
        );
        setChannels((prev) =>
          prev.map((c) => (c.id === editingId ? res.data : c))
        );
      } else {
        const res = await apiFetch<{ data: NotificationChannel }>(
          "/notifications/channels",
          token,
          { method: "POST", body: JSON.stringify(body), orgId: org.id }
        );
        setChannels((prev) => [...prev, res.data]);
      }
      setSaveMsg({ type: "ok", text: editingId ? "Channel updated" : "Channel created" });
      setTimeout(closeForm, 800);
    } catch (e: unknown) {
      setSaveMsg({ type: "err", text: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleChannel(id: string, enabled: boolean) {
    if (!org) return;
    try {
      const res = await apiFetch<{ data: NotificationChannel }>(
        `/notifications/channels/${id}`,
        token,
        { method: "PATCH", body: JSON.stringify({ is_enabled: enabled }), orgId: org.id }
      );
      setChannels((prev) => prev.map((c) => (c.id === id ? res.data : c)));
    } catch {}
  }

  async function deleteChannel(id: string) {
    if (!org) return;
    try {
      await apiFetch<void>(`/notifications/channels/${id}`, token, {
        method: "DELETE",
        orgId: org.id,
      });
      setChannels((prev) => prev.filter((c) => c.id !== id));
    } catch {}
  }

  function toggleEvent(event: string) {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  }

  if (!org) return null;

  return (
    <>
      {/* Channel list card */}
      <div className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 shadow-sm mb-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[var(--ink)] rounded-lg flex items-center justify-center">
            <Bell size={14} className="text-[var(--bg)]" />
          </div>
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">Email Channels</h2>
          <span className="ml-auto text-[11px] text-[var(--ink-4)]">
            {channels.length} channel{channels.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-[var(--surface)] rounded-md animate-pulse" />
            ))}
          </div>
        ) : listError ? (
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--neg)]">
            <AlertCircle size={12} />
            {listError}
          </div>
        ) : channels.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-4)]">
            No channels configured yet.{" "}
            {isAdmin && (
              <button
                onClick={openCreate}
                className="underline text-[var(--ink-3)] hover:text-[var(--ink)]"
              >
                Add one
              </button>
            )}
          </p>
        ) : (
          <div>
            {channels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                isAdmin={isAdmin}
                onToggle={toggleChannel}
                onEdit={openEdit}
                onDelete={deleteChannel}
              />
            ))}
          </div>
        )}

        {isAdmin && !formOpen && (
          <button
            onClick={openCreate}
            className="mt-4 flex items-center gap-1.5 text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          >
            <Plus size={13} />
            Add channel
          </button>
        )}
      </div>

      {/* Add / edit form card */}
      <AnimatePresence>
        {formOpen && isAdmin && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 shadow-sm mb-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-[15px] font-semibold text-[var(--ink)]">
                {editingId ? "Edit channel" : "New email channel"}
              </h2>
              <button
                onClick={closeForm}
                className="ml-auto text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">
                  Channel name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. On-call team"
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--ink-3)] transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">
                  Recipients
                </label>
                <EmailTagInput
                  emails={form.emails}
                  input={form.emailInput}
                  onChange={(emails) => setForm((prev) => ({ ...prev, emails }))}
                  onInputChange={(emailInput) => setForm((prev) => ({ ...prev, emailInput }))}
                  disabled={false}
                />
                <p className="text-[11px] text-[var(--ink-4)] mt-1">
                  Press Enter or comma to add each address
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-2">
                  Notify on
                </label>
                <div className="space-y-2">
                  {Object.entries(EVENT_LABELS).map(([ev, label]) => (
                    <label key={ev} className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={form.events.includes(ev)}
                        onChange={() => toggleEvent(ev)}
                        className="w-3.5 h-3.5 accent-[var(--ink)] cursor-pointer"
                      />
                      <span className="text-[13px] text-[var(--ink-2)] group-hover:text-[var(--ink)] transition-colors">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="ch-enabled"
                  checked={form.isEnabled}
                  onChange={(e) => setForm((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                  className="w-3.5 h-3.5 accent-[var(--ink)] cursor-pointer"
                />
                <label htmlFor="ch-enabled" className="text-[13px] text-[var(--ink-2)] cursor-pointer">
                  Enabled
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-5">
              <InteractiveHoverButton
                text={editingId ? "Save changes" : "Create channel"}
                loadingText="Saving…"
                successText="Saved!"
                isLoading={saving}
                isSuccess={saveMsg?.type === "ok"}
                disabled={!form.name.trim() || form.emails.length === 0 || form.events.length === 0}
                onClick={saveChannel}
                className="h-8 px-4 text-[12px] rounded-lg"
              />
              <button
                onClick={closeForm}
                className="text-[12px] text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors px-3"
              >
                Cancel
              </button>
              {saveMsg?.type === "err" && (
                <span className="flex items-center gap-1.5 text-[12px] text-[var(--neg)]">
                  <AlertCircle size={12} />
                  {saveMsg.text}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
