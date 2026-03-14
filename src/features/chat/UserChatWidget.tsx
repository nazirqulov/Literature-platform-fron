import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { isSuperAdminRole } from "../../shared/utils/roleUtils";
import { ChatSocketClient } from "../../services/chatSocket";
import {
  buildChatMessageDedupeKey,
  type ChatConversationSummary,
  type ChatMessage,
  getChatConversation,
  getChatConversations,
  markChatConversationRead,
  normalizeChatMessage,
  normalizeConversationSummary,
  resolveOtherUserId,
  sortConversationsByDate,
} from "../../services/chatApi";

type UiMessage = ChatMessage & {
  mine: boolean;
};

const MESSAGE_DESTINATION = "/user/queue/messages";
const CONVERSATION_DESTINATION = "/user/queue/conversations";

const messageSortAsc = (a: UiMessage, b: UiMessage) => {
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
  return aTime - bTime;
};

const messageKey = (message: UiMessage) =>
  buildChatMessageDedupeKey(message);

const mergeMessages = (current: UiMessage[], incoming: UiMessage[]) => {
  const seen = new Set<string>();
  const merged: UiMessage[] = [];

  [...current, ...incoming].forEach((item) => {
    const key = messageKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });

  return merged.sort(messageSortAsc);
};

const upsertConversation = (
  current: ChatConversationSummary[],
  incoming: ChatConversationSummary,
) => {
  const idx = current.findIndex(
    (item) => item.otherUserId === incoming.otherUserId,
  );

  if (idx === -1) {
    return sortConversationsByDate([...current, incoming]);
  }

  const next = [...current];
  const previous = next[idx];
  next[idx] = {
    ...previous,
    ...incoming,
    otherUsername: incoming.otherUsername || previous.otherUsername,
    lastMessage: incoming.lastMessage || previous.lastMessage,
    lastMessageAt: incoming.lastMessageAt || previous.lastMessageAt,
  };

  return sortConversationsByDate(next);
};

const UserChatWidget: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const clientRef = useRef<ChatSocketClient | null>(null);
  const userIdRef = useRef<number | undefined>(user?.id);
  const usernameRef = useRef<string | undefined>(user?.username);
  const activeUserIdRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [conversations, setConversations] = useState<ChatConversationSummary[]>(
    [],
  );
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [activeMessages, setActiveMessages] = useState<UiMessage[]>([]);
  const sendLockRef = useRef(false);
  const lastSendRef = useRef<{ key: string; at: number } | null>(null);
  const sendUnlockTimerRef = useRef<number | null>(null);

  const releaseSendLock = () => {
    if (sendUnlockTimerRef.current != null) {
      window.clearTimeout(sendUnlockTimerRef.current);
    }
    sendUnlockTimerRef.current = window.setTimeout(() => {
      sendLockRef.current = false;
      setIsSending(false);
      sendUnlockTimerRef.current = null;
    }, 350);
  };

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    usernameRef.current = user?.username;
  }, [user?.username]);

  useEffect(() => {
    activeUserIdRef.current = activeUserId;
  }, [activeUserId]);

  useEffect(() => {
    if (!activeUserId) {
      setActiveMessages([]);
    }
  }, [activeUserId]);

  const shouldRender = useMemo(() => {
    if (!isAuthenticated) return false;
    if (isSuperAdminRole(user?.role)) return false;
    if (location.pathname.startsWith("/admin")) return false;
    if (location.pathname === "/login") return false;
    if (location.pathname === "/register") return false;
    if (location.pathname === "/verify-email") return false;
    return true;
  }, [isAuthenticated, location.pathname, user?.role]);

  useEffect(() => {
    if (!shouldRender || !user?.id) return;

    let cancelled = false;

    const loadConversations = async () => {
      setIsLoading(true);
      try {
        const list = await getChatConversations(user.id);
        if (cancelled) return;

        setConversations(list);
        if (!activeUserIdRef.current && list.length > 0) {
          setActiveUserId(list[0].otherUserId);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[CHAT][USER] conversation list fetch error:", error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, [shouldRender, user?.id]);

  useEffect(() => {
    if (!shouldRender) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    let cancelled = false;
    const client = new ChatSocketClient();
    clientRef.current = client;
    setIsConnecting(true);

    const unsubscribers: Array<() => void> = [];

    const start = async () => {
      try {
        await client.connect({
          token,
          onConnect: () => {
            if (cancelled) return;
            setIsConnected(true);
            setIsConnecting(false);
            console.log("[CHAT][USER] STOMP connected as:", usernameRef.current);
          },
          onError: (error) => {
            if (cancelled) return;
            setIsConnected(false);
            setIsConnecting(false);
            console.error("[CHAT][USER] STOMP/WebSocket error:", error);
          },
          onClose: () => {
            if (cancelled) return;
            setIsConnected(false);
            console.warn("[CHAT][USER] Connection closed");
          },
        });

        if (cancelled) return;

        const unsubscribeMessages = client.subscribe(
          MESSAGE_DESTINATION,
          (payload, meta) => {
            console.log("[CHAT][USER] Message arrived:", meta.rawBody);
            const normalized = normalizeChatMessage(payload);
            if (!normalized) return;

            const myUserId = userIdRef.current;
            const myUsername = usernameRef.current;
            const mine =
              (typeof myUserId === "number" &&
                normalized.senderUserId === myUserId) ||
              (typeof myUserId === "number" &&
                normalized.senderUserId == null &&
                typeof normalized.receiverUserId === "number" &&
                normalized.receiverUserId !== myUserId) ||
              (!!myUsername &&
                normalized.senderUsername.toLowerCase() ===
                  myUsername.toLowerCase());

            const otherUserId = resolveOtherUserId(normalized, myUserId);
            if (!otherUserId) return;

            const message: UiMessage = { ...normalized, mine };
            const selectedId = activeUserIdRef.current;
            const isActiveConversationMessage =
              typeof selectedId === "number" &&
              typeof myUserId === "number" &&
              typeof normalized.senderUserId === "number" &&
              typeof normalized.receiverUserId === "number" &&
              ((normalized.senderUserId === selectedId &&
                normalized.receiverUserId === myUserId) ||
                (normalized.senderUserId === myUserId &&
                  normalized.receiverUserId === selectedId));

            if (isActiveConversationMessage) {
              setActiveMessages((prev) => mergeMessages(prev, [message]));
            }

            setConversations((prev) => {
              const existing = prev.find(
                (item) => item.otherUserId === otherUserId,
              );
              const opened = activeUserIdRef.current === otherUserId;
              const nextUnread = mine || opened ? 0 : (existing?.unreadCount ?? 0) + 1;
              return upsertConversation(prev, {
                otherUserId,
                otherUsername:
                  existing?.otherUsername ||
                  (mine
                    ? normalized.receiverUsername || `Admin #${otherUserId}`
                    : normalized.senderUsername || `Admin #${otherUserId}`),
                lastMessage: normalized.content,
                lastMessageAt: normalized.createdAt,
                unreadCount: nextUnread,
              });
            });

            if (!activeUserIdRef.current) {
              setActiveUserId(otherUserId);
            }
          },
        );

        const unsubscribeConversations = client.subscribe(
          CONVERSATION_DESTINATION,
          (payload, meta) => {
            console.log("[CHAT][USER] Conversation event:", meta.rawBody);
            const summary = normalizeConversationSummary(
              payload,
              userIdRef.current,
            );
            if (!summary) return;

            setConversations((prev) =>
              upsertConversation(prev, {
                ...summary,
                unreadCount:
                  activeUserIdRef.current === summary.otherUserId
                    ? 0
                    : summary.unreadCount,
              }),
            );

            if (!activeUserIdRef.current) {
              setActiveUserId(summary.otherUserId);
            }
          },
        );

        unsubscribers.push(unsubscribeMessages, unsubscribeConversations);
        console.log("[CHAT][USER] Subscribed:", MESSAGE_DESTINATION);
        console.log("[CHAT][USER] Subscribed:", CONVERSATION_DESTINATION);
      } catch (error) {
        if (cancelled) return;
        setIsConnected(false);
        setIsConnecting(false);
        console.error("[CHAT][USER] Connect failed:", error);
      }
    };

    void start();

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      client.disconnect();
      clientRef.current = null;
      if (sendUnlockTimerRef.current != null) {
        window.clearTimeout(sendUnlockTimerRef.current);
        sendUnlockTimerRef.current = null;
      }
      setIsConnected(false);
      setIsConnecting(false);
      console.log("[CHAT][USER] Unsubscribed all");
    };
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender || !activeUserId) return;

    let cancelled = false;
    setActiveMessages([]);

    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const history = await getChatConversation(activeUserId);
        if (cancelled) return;

        const myUserId = userIdRef.current;
        const myUsername = usernameRef.current;
        const normalized = history.map((item) => {
          const mine =
            (typeof myUserId === "number" && item.senderUserId === myUserId) ||
            (typeof myUserId === "number" &&
              item.senderUserId == null &&
              typeof item.receiverUserId === "number" &&
              item.receiverUserId !== myUserId) ||
            (!!myUsername &&
              item.senderUsername.toLowerCase() === myUsername.toLowerCase());
          return { ...item, mine };
        });

        setActiveMessages(mergeMessages([], normalized));

        if (isOpen) {
          await markChatConversationRead(activeUserId);
          if (cancelled) return;

          setConversations((prev) =>
            prev.map((item) =>
              item.otherUserId === activeUserId
                ? { ...item, unreadCount: 0 }
                : item,
            ),
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[CHAT][USER] history fetch error:", error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [activeUserId, isOpen, shouldRender]);

  useEffect(() => {
    if (!shouldRender || !isOpen || !activeUserId) return;

    void markChatConversationRead(activeUserId)
      .then(() => {
        setConversations((prev) =>
          prev.map((item) =>
            item.otherUserId === activeUserId
              ? { ...item, unreadCount: 0 }
              : item,
          ),
        );
      })
      .catch((error) => {
        console.error("[CHAT][USER] mark-read error:", error);
      });
  }, [activeUserId, isOpen, shouldRender]);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.otherUserId === activeUserId),
    [conversations, activeUserId],
  );

  const messages = useMemo(() => {
    return activeMessages;
  }, [activeMessages]);

  const sendMessage = () => {
    console.log("[CHAT][USER] SEND CALLED");
    const content = inputValue.trim();
    if (!content) return;

    const dedupeTarget = activeUserId ?? "admin";
    const dedupeKey = `${dedupeTarget}:${content}`;
    const now = Date.now();
    if (sendLockRef.current) {
      console.warn("[CHAT][USER] Send ignored: lock active");
      return;
    }
    if (
      lastSendRef.current &&
      lastSendRef.current.key === dedupeKey &&
      now - lastSendRef.current.at < 1200
    ) {
      console.warn("[CHAT][USER] Send ignored: duplicate payload window");
      return;
    }

    const client = clientRef.current;
    if (!client || !client.isConnected()) {
      toast.error("Chat server bilan ulanish yo'q.");
      return;
    }

    sendLockRef.current = true;
    setIsSending(true);
    lastSendRef.current = { key: dedupeKey, at: now };

    client.send("/app/chat.user-to-admin", { content });
    setInputValue("");
    releaseSendLock();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    sendMessage();
  };

  if (!shouldRender) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {isOpen ? (
        <div className="w-[min(92vw,380px)] rounded-2xl border border-[#E3DBCF] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#E3DBCF] px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#2B2B2B]">
                {activeConversation?.otherUsername || "Admin bilan chat"}
              </p>
              <p className="text-xs text-[#9A9A9A]">
                {isConnected
                  ? "Ulangan"
                  : isConnecting
                    ? "Ulanmoqda..."
                    : "Ulanish yo'q"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-[#6B6B6B] hover:bg-[#F5F1E8]"
              aria-label="Chatni yopish"
            >
              <X size={18} />
            </button>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto px-3 py-3">
            {isLoading ? (
              <p className="text-xs text-[#9A9A9A]">Xabarlar yuklanmoqda...</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-[#9A9A9A]">
                Savolingizni yozing, admin tez orada javob beradi.
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={messageKey(msg)}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    msg.mine
                      ? "ml-8 bg-[#6B4F3A] text-[#F5F1E8]"
                      : "mr-8 bg-[#F5F1E8] text-[#2B2B2B]"
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      msg.mine ? "text-[#E8D8C5]" : "text-[#9A9A9A]"
                    }`}
                  >
                    {msg.mine ? "Siz" : msg.senderUsername}
                  </p>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-[#E3DBCF] px-3 py-3"
          >
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Xabar yozing..."
              className="flex-1 rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B] placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-[#6B4F3A]/20"
            />
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#6B4F3A] text-[#F5F1E8] hover:bg-[#5A4030] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Xabar yuborish"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#6B4F3A] text-[#F5F1E8] shadow-lg transition hover:bg-[#5A4030]"
          aria-label="Admin chatni ochish"
        >
          {conversations.some((item) => item.unreadCount > 0) && (
            <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#D96A52] px-1 text-[10px] font-semibold text-white">
              {conversations.reduce((sum, item) => sum + item.unreadCount, 0)}
            </span>
          )}
          <MessageCircle size={20} />
        </button>
      )}
    </div>
  );
};

export default UserChatWidget;
