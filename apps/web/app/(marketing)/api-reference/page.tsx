"use client";

import { useState, useEffect } from "react";
import {
  BASE_URL,
  endpointGroups,
  type HttpMethod,
  type Endpoint,
} from "./endpoints";

const BG_PAGE = "#edede9";
const BG_SIDEBAR = "#e3d5ca";
const BG_CODE = "#1c1917";
const BORDER = "#c8b5a8";
const TEXT_PRIMARY = "#1c1917";
const TEXT_MUTED = "#6b5c54";
const TEXT_DIM = "#9e8d84";

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "#22c55e",
  POST: "#3b82f6",
  PATCH: "#f59e0b",
  WS: "#a855f7",
};

const AUTH_STRIP: Record<
  Endpoint["auth"],
  { bg: string; border: string; text: string; label: string }
> = {
  bearer: {
    bg: "rgba(217,119,6,0.1)",
    border: "rgba(217,119,6,0.35)",
    text: "#fbbf24",
    label:
      "🔐 Requires Bearer JWT in Authorization header + X-Org-Id header",
  },
  none: {
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.3)",
    text: "#4ade80",
    label: "✓ No authentication required",
  },
  signature: {
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.3)",
    text: "#f87171",
    label: "🔏 HMAC signature verification via webhook secret",
  },
  "ws-token": {
    bg: "rgba(168,85,247,0.08)",
    border: "rgba(168,85,247,0.3)",
    text: "#c084fc",
    label:
      "🔑 Requires short-lived JWT from GET /orgs/ws-token as ?token= query param",
  },
};

function colorizeJson(json: string): React.ReactNode {
  const lines = json.split("\n");
  return lines.map((line, i) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    // Match key-value pairs
    const kvMatch = remaining.match(/^(\s*)("(?:[^"\\]|\\.)*")\s*:\s*(.*)$/);
    if (kvMatch) {
      const [, indent, keyStr, rest] = kvMatch;
      parts.push(<span key={key++}>{indent}</span>);
      parts.push(
        <span key={key++} style={{ color: "#d97706" }}>
          {keyStr}
        </span>
      );
      parts.push(<span key={key++}>{": "}</span>);

      const strValMatch = rest.match(/^("(?:[^"\\]|\\.)*")(,?)(.*)$/);
      const numBoolMatch = rest.match(/^(true|false|null|-?\d+(?:\.\d+)?)(,?)(.*)$/);
      const braceMatch = rest.match(/^([{[\]}])(,?)(.*)$/);

      if (strValMatch) {
        const [, val, comma, trailing] = strValMatch;
        parts.push(
          <span key={key++} style={{ color: "#86efac" }}>
            {val}
          </span>
        );
        parts.push(
          <span key={key++} style={{ color: TEXT_MUTED }}>
            {comma}
          </span>
        );
        if (trailing) parts.push(<span key={key++}>{trailing}</span>);
      } else if (numBoolMatch) {
        const [, val, comma, trailing] = numBoolMatch;
        parts.push(
          <span key={key++} style={{ color: "#93c5fd" }}>
            {val}
          </span>
        );
        parts.push(
          <span key={key++} style={{ color: TEXT_MUTED }}>
            {comma}
          </span>
        );
        if (trailing) parts.push(<span key={key++}>{trailing}</span>);
      } else if (braceMatch) {
        const [, brace, comma] = braceMatch;
        parts.push(
          <span key={key++} style={{ color: TEXT_MUTED }}>
            {brace}
          </span>
        );
        if (comma)
          parts.push(
            <span key={key++} style={{ color: TEXT_MUTED }}>
              {comma}
            </span>
          );
      } else {
        parts.push(<span key={key++}>{rest}</span>);
      }
    } else {
      // Lines with only braces/brackets
      const trimmed = remaining.trim();
      if (/^[{[\]},]+$/.test(trimmed)) {
        parts.push(
          <span key={key++}>
            {remaining.slice(0, remaining.length - trimmed.length)}
          </span>
        );
        parts.push(
          <span key={key++} style={{ color: TEXT_MUTED }}>
            {trimmed}
          </span>
        );
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
      }
    }

    return (
      <div key={i} style={{ lineHeight: "1.6" }}>
        {parts}
      </div>
    );
  });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontFamily: "monospace",
        letterSpacing: "0.1em",
        color: TEXT_DIM,
        marginBottom: 10,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function CodeBlock({ content }: { content: string }) {
  return (
    <pre
      style={{
        background: BG_CODE,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: "16px 20px",
        fontSize: 12,
        fontFamily: "monospace",
        color: TEXT_PRIMARY,
        overflowX: "auto",
        margin: 0,
        lineHeight: 1.6,
      }}
    >
      {colorizeJson(content)}
    </pre>
  );
}

function TableSection({
  title,
  rows,
}: {
  title: string;
  rows: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <SectionLabel>{title}</SectionLabel>
      <div
        style={{
          background: BG_CODE,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {rows}
      </div>
    </div>
  );
}

function TableRow({ cells }: { cells: React.ReactNode[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cells.map(() => "1fr").join(" "),
        borderBottom: `1px solid ${BORDER}`,
        padding: "10px 16px",
        gap: 12,
        alignItems: "center",
      }}
    >
      {cells.map((cell, i) => (
        <div key={i}>{cell}</div>
      ))}
    </div>
  );
}

const allEndpoints = endpointGroups.flatMap((g) => g.endpoints);

export default function ApiReferencePage() {
  const [selectedId, setSelectedId] = useState(
    endpointGroups[0].endpoints[0].id
  );
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const selected = allEndpoints.find((e) => e.id === selectedId) ?? allEndpoints[0];
  const authStrip = AUTH_STRIP[selected.auth];
  const statusColor = selected.statusCode < 300 ? "#22c55e" : "#f87171";

  function handleSelect(id: string) {
    setVisible(false);
    setSelectedId(id);
    setTimeout(() => setVisible(true), 80);
  }

  function handleCopy() {
    void navigator.clipboard.writeText(`${BASE_URL}${selected.path}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ background: BG_PAGE, minHeight: "100vh", display: "flex" }}>
      {/* Sidebar — desktop */}
      <aside
        className="hidden lg:block"
        style={{
          width: 280,
          background: BG_SIDEBAR,
          borderRight: `1px solid ${BORDER}`,
          position: "sticky",
          top: 60,
          height: "calc(100vh - 60px)",
          overflowY: "auto",
          flexShrink: 0,
        }}
      >
        {/* Sidebar header */}
        <div
          style={{
            padding: "20px 16px 16px",
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: "var(--font-playfair), Georgia, serif",
              color: TEXT_PRIMARY,
              marginBottom: 8,
            }}
          >
            API Reference
          </div>
          <div
            style={{
              display: "inline-block",
              background: "#d6ccc2",
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: "3px 8px",
              fontSize: 11,
              fontFamily: "monospace",
              color: TEXT_DIM,
            }}
          >
            {BASE_URL}
          </div>
        </div>

        {/* Endpoint groups */}
        <div style={{ paddingTop: 8, paddingBottom: 16 }}>
          {endpointGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 16px 4px",
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: group.dotColor,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    color: TEXT_DIM,
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {group.label}
                </span>
              </div>
              {group.endpoints.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => handleSelect(ep.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 16px",
                    textAlign: "left",
                    background:
                      ep.id === selectedId ? "#d6ccc2" : "transparent",
                    borderLeft:
                      ep.id === selectedId
                        ? "2px solid #d97706"
                        : "2px solid transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      color: METHOD_COLORS[ep.method],
                      fontFamily: "monospace",
                      fontSize: 11,
                      width: 40,
                      flexShrink: 0,
                    }}
                  >
                    {ep.method}
                  </span>
                  <span
                    style={{
                      color: ep.id === selectedId ? TEXT_PRIMARY : TEXT_MUTED,
                      fontSize: 12,
                      fontFamily: "monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ep.path}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Mobile dropdown */}
      <div
        className="lg:hidden"
        style={{
          position: "fixed",
          top: 60,
          left: 0,
          right: 0,
          zIndex: 40,
          background: BG_SIDEBAR,
          borderBottom: `1px solid ${BORDER}`,
          padding: "12px 16px",
        }}
      >
        <select
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          style={{
            width: "100%",
            background: BG_PAGE,
            color: TEXT_PRIMARY,
            border: `1px solid ${BORDER}`,
            padding: "8px 12px",
            borderRadius: 6,
            fontFamily: "monospace",
            fontSize: 13,
          }}
        >
          {endpointGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.endpoints.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.method} {ep.path}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Detail panel */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 48px",
          transition: "opacity 0.15s",
          opacity: visible ? 1 : 0,
        }}
        className="lg:pt-8 pt-24"
      >
        {/* 1. Header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              background: METHOD_COLORS[selected.method] + "22",
              color: METHOD_COLORS[selected.method],
              border: `1px solid ${METHOD_COLORS[selected.method]}55`,
              borderRadius: 6,
              padding: "4px 12px",
              fontSize: 13,
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            {selected.method}
          </span>

          <span
            style={{
              fontFamily: "monospace",
              fontSize: 18,
              color: TEXT_PRIMARY,
              fontWeight: 500,
            }}
          >
            {selected.path}
          </span>

          <button
            onClick={handleCopy}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              padding: "5px 12px",
              color: copied ? "#4ade80" : TEXT_MUTED,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "monospace",
              transition: "color 0.15s",
            }}
          >
            {copied ? "Copied!" : "Copy URL"}
          </button>

          <span
            style={{
              background: statusColor + "18",
              color: statusColor,
              border: `1px solid ${statusColor}40`,
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 12,
              fontFamily: "monospace",
            }}
          >
            {selected.statusCode}
          </span>
        </div>

        {/* 2. Auth callout strip */}
        <div
          style={{
            background: authStrip.bg,
            border: `1px solid ${authStrip.border}`,
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 24,
            fontSize: 13,
            color: authStrip.text,
          }}
        >
          {authStrip.label}
        </div>

        {/* 3. Description */}
        <p
          style={{
            color: TEXT_MUTED,
            fontSize: 14,
            lineHeight: 1.7,
            marginBottom: 28,
            margin: "0 0 28px",
          }}
        >
          {selected.description}
        </p>

        {/* 4. Headers */}
        {selected.headers && selected.headers.length > 0 && (
          <TableSection
            title="HEADERS"
            rows={
              <>
                <TableRow
                  cells={[
                    <span
                      key="h"
                      style={{ color: TEXT_DIM, fontSize: 11, fontWeight: 600 }}
                    >
                      Header Name
                    </span>,
                    <span
                      key="v"
                      style={{ color: TEXT_DIM, fontSize: 11, fontWeight: 600 }}
                    >
                      Value
                    </span>,
                    <span
                      key="r"
                      style={{ color: TEXT_DIM, fontSize: 11, fontWeight: 600 }}
                    >
                      Required
                    </span>,
                  ]}
                />
                {selected.headers.map((h) => (
                  <TableRow
                    key={h.name}
                    cells={[
                      <span
                        key="n"
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          color: "#d97706",
                        }}
                      >
                        {h.name}
                      </span>,
                      <span
                        key="v"
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          color: TEXT_MUTED,
                        }}
                      >
                        {h.value}
                      </span>,
                      <span
                        key="r"
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: h.required
                            ? "rgba(34,197,94,0.12)"
                            : "rgba(160,144,136,0.12)",
                          color: h.required ? "#4ade80" : TEXT_DIM,
                        }}
                      >
                        {h.required ? "required" : "optional"}
                      </span>,
                    ]}
                  />
                ))}
              </>
            }
          />
        )}

        {/* 5. Query Params */}
        {selected.queryParams && selected.queryParams.length > 0 && (
          <TableSection
            title="QUERY PARAMETERS"
            rows={
              <>
                <TableRow
                  cells={[
                    <span
                      key="n"
                      style={{ color: TEXT_DIM, fontSize: 11, fontWeight: 600 }}
                    >
                      Name
                    </span>,
                    <span
                      key="t"
                      style={{ color: TEXT_DIM, fontSize: 11, fontWeight: 600 }}
                    >
                      Type
                    </span>,
                    <span
                      key="d"
                      style={{ color: TEXT_DIM, fontSize: 11, fontWeight: 600 }}
                    >
                      Description
                    </span>,
                    <span
                      key="r"
                      style={{ color: TEXT_DIM, fontSize: 11, fontWeight: 600 }}
                    >
                      Required
                    </span>,
                  ]}
                />
                {selected.queryParams.map((qp) => (
                  <TableRow
                    key={qp.name}
                    cells={[
                      <span
                        key="n"
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          color: "#d97706",
                        }}
                      >
                        {qp.name}
                      </span>,
                      <span
                        key="t"
                        style={{
                          fontFamily: "monospace",
                          fontSize: 11,
                          color: "#93c5fd",
                        }}
                      >
                        {qp.type}
                      </span>,
                      <span
                        key="d"
                        style={{ fontSize: 12, color: TEXT_MUTED }}
                      >
                        {qp.description}
                      </span>,
                      <span
                        key="r"
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: qp.required
                            ? "rgba(34,197,94,0.12)"
                            : "rgba(160,144,136,0.12)",
                          color: qp.required ? "#4ade80" : TEXT_DIM,
                        }}
                      >
                        {qp.required ? "required" : "optional"}
                      </span>,
                    ]}
                  />
                ))}
              </>
            }
          />
        )}

        {/* 6. Request Body */}
        {selected.requestBody && (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>REQUEST BODY</SectionLabel>
            <CodeBlock content={selected.requestBody} />
          </div>
        )}

        {/* 7. Response */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <SectionLabel>RESPONSE</SectionLabel>
            <span
              style={{
                fontSize: 11,
                padding: "1px 8px",
                borderRadius: 4,
                background: statusColor + "18",
                color: statusColor,
                fontFamily: "monospace",
                marginBottom: 10,
              }}
            >
              {selected.statusCode}
            </span>
          </div>
          <CodeBlock content={selected.response} />
        </div>

        {/* 8. WebSocket special section */}
        {selected.method === "WS" && (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>CONNECTION EXAMPLE</SectionLabel>
            <pre
              style={{
                background: BG_CODE,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: "16px 20px",
                fontSize: 12,
                fontFamily: "monospace",
                color: "#86efac",
                overflowX: "auto",
                margin: "0 0 20px",
              }}
            >
              {`const ws = new WebSocket(\n  "wss://api.devsentinel.app${selected.path}?token=<jwt>"\n);`}
            </pre>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: TEXT_DIM,
                    letterSpacing: "0.08em",
                    marginBottom: 8,
                    textTransform: "uppercase",
                  }}
                >
                  Client → Server
                </div>
                <pre
                  style={{
                    background: BG_CODE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 8,
                    padding: "14px 16px",
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: TEXT_MUTED,
                    overflowX: "auto",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {`// Send a message\n{ "type": "message.send",\n  "payload": { "body": "..." } }\n\n// Resolve incident\n{ "type": "incident.resolve",\n  "payload": {\n    "root_cause": "...",\n    "suggested_fix": "..."\n  }\n}`}
                </pre>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: TEXT_DIM,
                    letterSpacing: "0.08em",
                    marginBottom: 8,
                    textTransform: "uppercase",
                  }}
                >
                  Server → Client
                </div>
                <pre
                  style={{
                    background: BG_CODE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 8,
                    padding: "14px 16px",
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: TEXT_MUTED,
                    overflowX: "auto",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {`// New message\n{ "type": "message.new",\n  "payload": { ... } }\n\n// Resolved\n{ "type": "incident.resolved",\n  "payload": { "mttr": 47 } }\n\n// New incident\n{ "type": "incident.new",\n  "payload": { ... } }`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
