// Chat.tsx — WhatsApp-style chat between coach and client
// Photos compressed to ~150-200 KB, expire + get purged from storage after 7 days
// Realtime via Supabase channel subscriptions

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  sender_type: "coach" | "client";
  message: string | null;
  photo_url: string | null;
  photo_expires_at: string | null;
  created_at: string;
}

interface ChatProps {
  clientId: string;
  coachId: string;
  senderType: "coach" | "client";
  peerName: string; // the other person's name
  onClose: () => void;
}

// ── Image compression ──────────────────────────────────────────────────────────
function compressImage(file: File, maxDim = 900, quality = 0.7): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          blob ? resolve(blob) : reject(new Error("Compression failed"));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateSeparatorLabel(dateStr: string): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const d = new Date(dateStr);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getDateKey(dateStr: string): string {
  return new Date(dateStr).toDateString();
}

function daysUntil(dateStr: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  );
}

// Download blob helper
async function downloadBlob(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank");
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Chat({
  clientId,
  coachId,
  senderType,
  peerName,
  onClose,
}: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    purgeExpiredPhotos().then(() => loadMessages());
    subscribeRealtime();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [clientId, coachId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Purge expired photos from storage + null out URLs ─────────────────────
  async function purgeExpiredPhotos() {
    const { data: expired } = await supabase
      .from("chat_messages")
      .select("id, photo_url")
      .eq("client_id", clientId)
      .eq("coach_id", coachId)
      .not("photo_url", "is", null)
      .lt("photo_expires_at", new Date().toISOString());

    if (!expired?.length) return;

    const storagePaths = expired
      .map((m: any) => {
        const url: string = m.photo_url;
        const after = url.split("/chat-photos/")[1];
        return after ? decodeURIComponent(after.split("?")[0]) : null;
      })
      .filter(Boolean) as string[];

    if (storagePaths.length) {
      await supabase.storage.from("chat-photos").remove(storagePaths);
    }

    await supabase
      .from("chat_messages")
      .update({ photo_url: null })
      .in(
        "id",
        expired.map((m: any) => m.id)
      );
  }

  // ── Load messages ─────────────────────────────────────────────────────────
  async function loadMessages() {
    setLoading(true);
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("client_id", clientId)
      .eq("coach_id", coachId)
      .order("created_at", { ascending: true })
      .limit(120);
    setMessages(data || []);
    setLoading(false);
  }

  // ── Realtime subscription ─────────────────────────────────────────────────
  function subscribeRealtime() {
    const ch = supabase
      .channel(`chat-${clientId}-${coachId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
        }
      )
      .subscribe();
    channelRef.current = ch;
  }

  // ── Send text ─────────────────────────────────────────────────────────────
  async function sendText() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await supabase.from("chat_messages").insert({
      client_id: clientId,
      coach_id: coachId,
      sender_type: senderType,
      message: trimmed,
      photo_url: null,
      photo_expires_at: null,
    });
    setSending(false);
  }

  // ── Send photo ────────────────────────────────────────────────────────────
  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file, 900, 0.7);
      const path = `${clientId}/${coachId}-${Date.now()}.jpg`;

      const { error: upErr } = await supabase.storage
        .from("chat-photos")
        .upload(path, compressed, { contentType: "image/jpeg", upsert: false });

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("chat-photos")
        .getPublicUrl(path);

      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      await supabase.from("chat_messages").insert({
        client_id: clientId,
        coach_id: coachId,
        sender_type: senderType,
        message: null,
        photo_url: urlData.publicUrl,
        photo_expires_at: expiresAt,
      });
    } catch (err) {
      console.error("Photo upload failed:", err);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  // ── Build date-grouped messages ───────────────────────────────────────────
  const grouped: { dateKey: string; label: string; msgs: ChatMessage[] }[] = [];
  messages.forEach((msg) => {
    const key = getDateKey(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (!last || last.dateKey !== key) {
      grouped.push({
        dateKey: key,
        label: dateSeparatorLabel(msg.created_at),
        msgs: [msg],
      });
    } else {
      last.msgs.push(msg);
    }
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg, #0d0d18)",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          background: "var(--surface2)",
          borderBottom: "1px solid var(--border)",
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.85rem",
          flexShrink: 0,
          boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--accent)",
            fontSize: 22,
            lineHeight: 1,
            padding: "4px 6px",
          }}
        >
          ←
        </button>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, var(--accent) 0%, #a855f7 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(124,106,247,0.35)",
          }}
        >
          {senderType === "coach" ? "💪" : "🏋️"}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              fontSize: "1rem",
              lineHeight: 1.2,
            }}
          >
            {peerName}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
            {senderType === "coach" ? "Client" : "Coach"}
            {" · "}
            <span style={{ color: "var(--accent)" }}>
              Photos expire in 7 days
            </span>
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem 0.85rem",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {loading && (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "var(--muted)",
              marginTop: "4rem",
              fontSize: 14,
            }}
          >
            <div style={{ fontSize: 42, marginBottom: "0.75rem" }}>💬</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              No messages yet
            </div>
            <div style={{ fontSize: 13 }}>Say hello to {peerName}! 👋</div>
          </div>
        )}

        {grouped.map((group) => (
          <div key={group.dateKey}>
            {/* Date separator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                margin: "1rem 0 0.75rem",
              }}
            >
              <div
                style={{ flex: 1, height: 1, background: "var(--border)" }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  background: "var(--surface2)",
                  padding: "2px 10px",
                  borderRadius: 20,
                  whiteSpace: "nowrap",
                }}
              >
                {group.label}
              </span>
              <div
                style={{ flex: 1, height: 1, background: "var(--border)" }}
              />
            </div>

            {group.msgs.map((msg, idx) => {
              const mine = msg.sender_type === senderType;
              const isPhotoExpired = !msg.photo_url && !!msg.photo_expires_at;
              const hasPhoto = !!msg.photo_url;
              const showAvatar =
                !mine &&
                (idx === group.msgs.length - 1 ||
                  group.msgs[idx + 1]?.sender_type !== msg.sender_type);

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: mine ? "flex-end" : "flex-start",
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      maxWidth: "78%",
                      background: mine ? "var(--accent)" : "var(--surface2)",
                      color: mine ? "#fff" : "inherit",
                      borderRadius: mine
                        ? "18px 18px 4px 18px"
                        : "4px 18px 18px 18px",
                      overflow: "hidden",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                    }}
                  >
                    {/* Photo */}
                    {hasPhoto && (
                      <div style={{ position: "relative" }}>
                        <img
                          src={msg.photo_url!}
                          alt="Photo"
                          loading="lazy"
                          onClick={() => setLightboxUrl(msg.photo_url)}
                          style={{
                            display: "block",
                            maxWidth: "100%",
                            maxHeight: 300,
                            width: "100%",
                            objectFit: "cover",
                            cursor: "pointer",
                          }}
                        />
                        {msg.photo_expires_at && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: 6,
                              right: 8,
                              fontSize: 10,
                              color: "rgba(255,255,255,0.85)",
                              background: "rgba(0,0,0,0.45)",
                              padding: "2px 6px",
                              borderRadius: 8,
                              backdropFilter: "blur(4px)",
                            }}
                          >
                            📷 {daysUntil(msg.photo_expires_at)}d left
                          </div>
                        )}
                        {/* Download button on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadBlob(
                              msg.photo_url!,
                              `chat-photo-${msg.id}.jpg`
                            );
                          }}
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 8,
                            background: "rgba(0,0,0,0.45)",
                            border: "none",
                            borderRadius: 8,
                            padding: "3px 7px",
                            color: "#fff",
                            fontSize: 12,
                            cursor: "pointer",
                            backdropFilter: "blur(4px)",
                          }}
                        >
                          ↓
                        </button>
                      </div>
                    )}

                    {/* Expired photo placeholder */}
                    {isPhotoExpired && (
                      <div
                        style={{
                          padding: "0.6rem 0.9rem",
                          fontSize: 13,
                          fontStyle: "italic",
                          color: mine
                            ? "rgba(255,255,255,0.55)"
                            : "var(--muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <span>🕐</span>
                        <span>Photo expired</span>
                      </div>
                    )}

                    {/* Text */}
                    {msg.message && (
                      <div
                        style={{
                          padding: "0.6rem 0.9rem",
                          fontSize: "0.95rem",
                          lineHeight: 1.45,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {msg.message}
                      </div>
                    )}

                    {/* Timestamp (inside bubble for text-only) */}
                    {msg.message && !hasPhoto && (
                      <div
                        style={{
                          padding: "0 0.9rem 0.4rem",
                          fontSize: 10,
                          textAlign: "right",
                          color: mine
                            ? "rgba(255,255,255,0.55)"
                            : "var(--muted)",
                        }}
                      >
                        {formatTime(msg.created_at)}
                      </div>
                    )}
                  </div>

                  {/* Timestamp below photo bubbles */}
                  {hasPhoto && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--muted)",
                        marginTop: 3,
                        padding: "0 4px",
                      }}
                    >
                      {formatTime(msg.created_at)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Input row ── */}
      <div
        style={{
          background: "var(--surface2)",
          borderTop: "1px solid var(--border)",
          padding: "0.65rem 0.85rem",
          display: "flex",
          gap: "0.6rem",
          alignItems: "flex-end",
          flexShrink: 0,
        }}
      >
        {/* Photo button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Send photo"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: uploading ? "var(--border)" : "rgba(124,106,247,0.15)",
            border: "none",
            cursor: uploading ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
            color: "var(--accent)",
            transition: "background 0.15s",
          }}
        >
          {uploading ? (
            <div
              style={{
                width: 18,
                height: 18,
                border: "2px solid var(--accent)",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
          ) : (
            "📷"
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handlePhotoSelect}
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendText();
            }
          }}
          placeholder="Message…"
          rows={1}
          style={{
            flex: 1,
            background: "var(--bg, #0d0d18)",
            border: "1px solid var(--border)",
            borderRadius: 22,
            padding: "0.65rem 1rem",
            color: "inherit",
            fontSize: "0.95rem",
            resize: "none",
            maxHeight: 120,
            overflowY: "auto",
            fontFamily: "inherit",
            outline: "none",
            lineHeight: 1.4,
          }}
        />

        {/* Send button */}
        <button
          onClick={sendText}
          disabled={!text.trim() || sending}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: text.trim() ? "var(--accent)" : "var(--border)",
            border: "none",
            cursor: text.trim() ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
            color: "#fff",
            transition: "background 0.15s",
          }}
        >
          ➤
        </button>
      </div>

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 500,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            style={{
              maxWidth: "95vw",
              maxHeight: "85vh",
              borderRadius: 10,
              objectFit: "contain",
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() =>
                downloadBlob(lightboxUrl, `chat-photo-${Date.now()}.jpg`)
              }
              style={{
                background: "var(--accent)",
                border: "none",
                borderRadius: 10,
                padding: "0.55rem 1.2rem",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              ↓ Download
            </button>
            <button
              onClick={() => setLightboxUrl(null)}
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "none",
                borderRadius: 10,
                padding: "0.55rem 1.2rem",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
