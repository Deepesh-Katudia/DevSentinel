"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Copy, CheckCheck, ExternalLink, GitBranch,
  AlertCircle, Loader2, ChevronUp, ChevronDown, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/contexts/org-context";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GitHubConfig {
  isConfigured: boolean;
  appName: string | null;
  isConnected: boolean;
  installationId: number | null;
}

interface Repo {
  id: string;
  name: string;
  fullName: string;
  isActive: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepProgress({ complete }: { complete: boolean }) {
  return (
    <div className="relative h-[2px] w-full bg-[var(--border)] rounded-full overflow-hidden mb-5">
      <motion.div
        className="absolute inset-y-0 left-0 bg-[var(--ink)] rounded-full"
        initial={{ width: "0%" }}
        animate={{ width: complete ? "100%" : "0%" }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
    </div>
  );
}

function StepBadge({ n, complete, active }: { n: number; complete: boolean; active: boolean }) {
  return (
    <div
      className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors",
        complete
          ? "bg-[var(--ink)] text-[var(--bg)]"
          : active
          ? "bg-[var(--ink-3)] text-[var(--bg)]"
          : "bg-[var(--border)] text-[var(--ink-3)]"
      )}
    >
      {complete ? <Check size={10} /> : n}
    </div>
  );
}

function CopyableUrl({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2 bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-4)] flex-shrink-0 w-20">
        {label}
      </span>
      <span className="text-[12px] text-[var(--ink-3)] font-mono truncate flex-1">{value}</span>
      <button
        onClick={copy}
        className="ml-1 p-1 rounded hover:bg-[var(--surface)] transition-colors flex-shrink-0"
        title="Copy to clipboard"
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <CheckCheck size={13} className="text-[var(--pos)]" />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <Copy size={13} className="text-[var(--ink-3)]" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}

function RepoToggle({
  active,
  disabled,
  onToggle,
}: {
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40",
        active ? "bg-[var(--ink)]" : "bg-[var(--border)]"
      )}
    >
      <motion.span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow"
        animate={{ x: active ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GitHubIntegrationTab({ justConnected = false }: { justConnected?: boolean }) {
  const { org, role } = useOrg();
  const { session } = useAuth();

  const isAdmin = role === "admin";
  const token = session?.access_token ?? "";
  const orgId = org?.id ?? "";

  // Config
  const [config, setConfig] = useState<GitHubConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Step 1
  const [step1Open, setStep1Open] = useState(true);
  const [formAppName, setFormAppName] = useState("");
  const [formAppId, setFormAppId] = useState("");
  const [formWebhookSecret, setFormWebhookSecret] = useState("");
  const [formPrivateKey, setFormPrivateKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Step 3
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [togglingRepo, setTogglingRepo] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    if (!org || !session) return;
    setReposLoading(true);
    try {
      const data = await apiFetch<Repo[]>("/orgs/repos", token, { orgId });
      setRepos(data ?? []);
    } catch {
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  }, [org, session, token, orgId]);

  // Load config on mount
  useEffect(() => {
    if (!org || !session) return;
    setConfigLoading(true);
    apiFetch<GitHubConfig>("/orgs/github/config", token, { orgId })
      .then((data) => {
        setConfig(data);
        if (data.isConfigured) setStep1Open(false);
      })
      .catch(() => setConfig(null))
      .finally(() => setConfigLoading(false));
  }, [org, session, token, orgId]);

  // Load repos when connected
  useEffect(() => {
    if (config?.isConnected) loadRepos();
  }, [config?.isConnected, loadRepos]);

  // Re-fetch after GitHub install redirect
  useEffect(() => {
    if (!justConnected || !org || !session) return;
    apiFetch<GitHubConfig>("/orgs/github/config", token, { orgId })
      .then((data) => {
        setConfig(data);
        if (data.isConfigured) setStep1Open(false);
      })
      .catch(() => {});
  }, [justConnected, org, session, token, orgId]);

  async function saveCredentials() {
    setSaving(true);
    setSaveError(null);
    try {
      const data = await apiFetch<GitHubConfig>("/orgs/github/config", token, {
        method: "POST",
        orgId,
        body: JSON.stringify({
          app_name: formAppName.trim(),
          app_id: formAppId.trim(),
          webhook_secret: formWebhookSecret.trim(),
          private_key: formPrivateKey.trim(),
        }),
      });
      setConfig(data);
      setStep1Open(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save credentials");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRepo(repoId: string, nextActive: boolean) {
    setTogglingRepo(repoId);
    try {
      await apiFetch(`/orgs/repos/${repoId}`, token, {
        method: "PATCH",
        orgId,
        body: JSON.stringify({ is_active: nextActive }),
      });
      setRepos((prev) =>
        prev.map((r) => (r.id === repoId ? { ...r, isActive: nextActive } : r))
      );
    } catch {}
    setTogglingRepo(null);
  }

  if (!org) return null;

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-[var(--ink-4)]" />
      </div>
    );
  }

  const step1Complete = config?.isConfigured ?? false;
  const step2Complete = config?.isConnected ?? false;
  const step3Complete = step2Complete && repos.length > 0;

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const appOrigin =
    typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? "";
  const webhookUrl = `${apiBase}/webhooks/github`;
  const redirectUrl = `${appOrigin}/api/github/callback`;
  const installUrl = config?.appName
    ? `https://github.com/apps/${config.appName}/installations/new?state=${orgId}`
    : null;

  return (
    <div className="space-y-4">
      {/* ── Step 1: Configure ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0 }}
        className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 shadow-sm"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StepBadge n={1} complete={step1Complete} active={!step1Complete} />
            <h3 className="text-[14px] font-semibold text-[var(--ink)]">Configure GitHub App</h3>
          </div>
          {step1Complete && (
            <button
              onClick={() => setStep1Open((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors px-2 py-1 rounded hover:bg-[var(--surface)]"
            >
              {step1Open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {step1Open ? "Collapse" : "Edit"}
            </button>
          )}
        </div>

        <StepProgress complete={step1Complete} />

        {/* Collapsed summary */}
        <AnimatePresence initial={false}>
          {step1Complete && !step1Open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
                <Check size={13} className="text-[var(--pos)] flex-shrink-0" />
                <span>Credentials saved</span>
                {config?.appName && (
                  <>
                    <span className="text-[var(--ink-4)]">·</span>
                    <span className="font-medium">App: {config.appName}</span>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <AnimatePresence initial={false}>
          {step1Open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-1">
                <p className="text-[12px] text-[var(--ink-4)] leading-relaxed">
                  Create a GitHub App in your organization settings, then paste the credentials
                  below. Copy the webhook and redirect URLs from Step 2 into your GitHub App config.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">
                      App Name (slug)
                    </label>
                    <input
                      type="text"
                      value={formAppName}
                      onChange={(e) => setFormAppName(e.target.value)}
                      placeholder="my-github-app"
                      disabled={!isAdmin}
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--ink-3)] transition-colors disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">
                      App ID
                    </label>
                    <input
                      type="text"
                      value={formAppId}
                      onChange={(e) => setFormAppId(e.target.value)}
                      placeholder="123456"
                      disabled={!isAdmin}
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--ink-3)] transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">
                    Webhook Secret
                  </label>
                  <input
                    type="password"
                    value={formWebhookSecret}
                    onChange={(e) => setFormWebhookSecret(e.target.value)}
                    placeholder="••••••••"
                    disabled={!isAdmin}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--ink-3)] transition-colors disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-4)] block mb-1">
                    Private Key (PEM)
                  </label>
                  <textarea
                    value={formPrivateKey}
                    onChange={(e) => setFormPrivateKey(e.target.value)}
                    placeholder={"-----BEGIN RSA PRIVATE KEY-----\n..."}
                    rows={4}
                    disabled={!isAdmin}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[12px] text-[var(--ink)] font-mono placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--ink-3)] transition-colors resize-none disabled:opacity-50"
                  />
                </div>

                {saveError && (
                  <div className="flex items-center gap-1.5 text-[12px] text-[var(--neg)]">
                    <AlertCircle size={12} />
                    {saveError}
                  </div>
                )}

                {isAdmin && (
                  <Button
                    size="sm"
                    onClick={saveCredentials}
                    disabled={
                      saving ||
                      !formAppName.trim() ||
                      !formAppId.trim() ||
                      !formPrivateKey.trim()
                    }
                  >
                    {saving ? (
                      <>
                        <Loader2 size={12} className="animate-spin mr-1.5" />
                        Saving…
                      </>
                    ) : (
                      "Save credentials"
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Step 2: Install ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.06 }}
        className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-2">
          <StepBadge n={2} complete={step2Complete} active={step1Complete && !step2Complete} />
          <h3 className="text-[14px] font-semibold text-[var(--ink)]">Install GitHub App</h3>
          {step2Complete && (
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--pos)]">
              Connected
            </span>
          )}
        </div>

        <StepProgress complete={step2Complete} />

        <div className="space-y-3">
          <p className="text-[12px] text-[var(--ink-4)] leading-relaxed">
            Paste these URLs into your GitHub App settings, then click Install to authorize the app
            on your repositories.
          </p>

          <CopyableUrl label="Webhook URL" value={webhookUrl} />
          <CopyableUrl label="Redirect URL" value={redirectUrl} />

          <div className="pt-1">
            {installUrl && step1Complete ? (
              <a
                href={installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium bg-[var(--ink)] text-[var(--bg)] hover:bg-[var(--ink-2)] transition-colors"
              >
                Install GitHub App
                <ExternalLink size={12} />
              </a>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium bg-[var(--border)] text-[var(--ink-4)] cursor-not-allowed opacity-60"
                title="Complete Step 1 first"
              >
                Install GitHub App
                <ExternalLink size={12} />
              </button>
            )}
            {!step1Complete && (
              <p className="text-[11px] text-[var(--ink-4)] mt-2">
                Save your credentials in Step 1 to enable installation.
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Step 3: Repositories ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.12 }}
        className="bg-[#f2ece5] border border-[var(--border)] rounded-[10px] p-6 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-2">
          <StepBadge n={3} complete={step3Complete} active={step2Complete && !step3Complete} />
          <h3 className="text-[14px] font-semibold text-[var(--ink)]">Connected Repositories</h3>
          {step3Complete && (
            <span className="ml-auto text-[11px] text-[var(--ink-4)]">
              {repos.filter((r) => r.isActive).length} of {repos.length} monitoring
            </span>
          )}
        </div>

        <StepProgress complete={step3Complete} />

        {!step2Complete ? (
          <p className="text-[13px] text-[var(--ink-4)]">
            Install the GitHub App in Step 2 to connect repositories.
          </p>
        ) : reposLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-[var(--surface)] rounded-md animate-pulse" />
            ))}
          </div>
        ) : repos.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-4)]">
            No repositories found. Make sure the GitHub App is installed on at least one repository.
          </p>
        ) : (
          <>
            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {repos.map((repo, i) => (
                  <motion.div
                    key={repo.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.18, delay: i * 0.05 }}
                    className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <GitBranch size={13} className="text-[var(--ink-3)] flex-shrink-0" />
                      <span className="text-[13px] text-[var(--ink-2)] font-medium">
                        {repo.fullName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "text-[11px]",
                          repo.isActive ? "text-[var(--ink-3)]" : "text-[var(--ink-4)]"
                        )}
                      >
                        {repo.isActive ? "Monitoring" : "Paused"}
                      </span>
                      <RepoToggle
                        active={repo.isActive}
                        disabled={togglingRepo === repo.id || !isAdmin}
                        onToggle={() => toggleRepo(repo.id, !repo.isActive)}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]">
              <a
                href={`https://github.com/apps/${config?.appName}/installations/new`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
              >
                <Plus size={12} />
                Add more repos
              </a>
              <a
                href={`https://github.com/apps/${config?.appName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
              >
                Manage on GitHub
                <ExternalLink size={12} />
              </a>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
