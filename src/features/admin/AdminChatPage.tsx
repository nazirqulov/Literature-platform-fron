import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, MessageSquareMore, Send, UserRound } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/useAuth";
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

type UiChatMessage = ChatMessage & {
  mine: boolean;
};

const MESSAGE_DESTINATION = "/user/queue/messages";
const CONVERSATION_DESTINATION = "/user/queue/conversations";

const formatMessageTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatMessageDateTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const messageSortAsc = (a: UiChatMessage, b: UiChatMessage) => {
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
  return aTime - bTime;
};

const messageKey = (message: UiChatMessage) =>
  buildChatMessageDedupeKey(message);

const mergeMessages = (current: UiChatMessage[], incoming: UiChatMessage[]) => {
  const seen = new Set<string>();
  const merged: UiChatMessage[] = [];

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

const AdminChatPage: React.FC = () => {
  const { user } = useAuth();
  const clientRef = useRef<ChatSocketClient | null>(null);
  const userIdRef = useRef<number | undefined>(user?.id);
  const usernameRef = useRef<string | undefined>(user?.username);
  const selectedUserRef = useRef<number | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>(
    [],
  );
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeMessages, setActiveMessages] = useState<UiChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
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
    selectedUserRef.current = selectedUserId;
  }, [selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) {
      setActiveMessages([]);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const loadConversations = async () => {
      setIsLoadingConversations(true);
      try {
        const list = await getChatConversations(user.id);
        if (cancelled) return;

        setConversations(list);
        if (!selectedUserRef.current && list.length > 0) {
          setSelectedUserId(list[0].otherUserId);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[CHAT][ADMIN] conversation list fetch error:", error);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConversations(false);
        }
      }
    };

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
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
            console.log("[CHAT][ADMIN] STOMP connected as:", usernameRef.current);
          },
          onError: (error) => {
            if (cancelled) return;
            setIsConnected(false);
            setIsConnecting(false);
            console.error("[CHAT][ADMIN] STOMP/WebSocket error:", error);
          },
          onClose: () => {
            if (cancelled) return;
            setIsConnected(false);
            console.warn("[CHAT][ADMIN] Connection closed");
          },
        });

        if (cancelled) return;

        const unsubscribeMessages = client.subscribe(
          MESSAGE_DESTINATION,
          (payload, meta) => {
            console.log("Message arrived", meta.rawBody);
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

            const message: UiChatMessage = { ...normalized, mine };
            const selectedId = selectedUserRef.current;
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
              const isOpened = selectedUserRef.current === otherUserId;
              const nextUnread = mine || isOpened ? 0 : (existing?.unreadCount ?? 0) + 1;

              return upsertConversation(prev, {
                otherUserId,
                otherUsername:
                  existing?.otherUsername ||
                  (mine
                    ? normalized.receiverUsername || `User #${otherUserId}`
                    : normalized.senderUsername || `User #${otherUserId}`),
                lastMessage: normalized.content,
                lastMessageAt: normalized.createdAt,
                unreadCount: nextUnread,
              });
            });

            if (!selectedUserRef.current) {
              setSelectedUserId(otherUserId);
            }

            if (!mine && selectedUserRef.current === otherUserId) {
              void markChatConversationRead(otherUserId)
                .then(() => {
                  setConversations((prev) =>
                    prev.map((item) =>
                      item.otherUserId === otherUserId
                        ? { ...item, unreadCount: 0 }
                        : item,
                    ),
                  );
                })
                .catch((error) => {
                  console.error("[CHAT][ADMIN] mark-read error:", error);
                });
            }
          },
        );

        const unsubscribeConversations = client.subscribe(
          CONVERSATION_DESTINATION,
          (payload, meta) => {
            console.log("[CHAT][ADMIN] Conversation event:", meta.rawBody);
            const summary = normalizeConversationSummary(
              payload,
              userIdRef.current,
            );
            if (!summary) return;

            const isOpened = selectedUserRef.current === summary.otherUserId;
            const nextSummary = {
              ...summary,
              unreadCount: isOpened ? 0 : summary.unreadCount,
            };

            setConversations((prev) => upsertConversation(prev, nextSummary));

            if (!selectedUserRef.current) {
              setSelectedUserId(summary.otherUserId);
            }
          },
        );

        unsubscribers.push(unsubscribeMessages, unsubscribeConversations);
        console.log("[CHAT][ADMIN] Subscribed:", MESSAGE_DESTINATION);
        console.log("[CHAT][ADMIN] Subscribed:", CONVERSATION_DESTINATION);
      } catch (error) {
        if (cancelled) return;
        setIsConnected(false);
        setIsConnecting(false);
        toast.error("Admin chat serveriga ulanib bo'lmadi.");
        console.error("[CHAT][ADMIN] Connect failed:", error);
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
      console.log("[CHAT][ADMIN] Unsubscribed all");
    };
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;

    let cancelled = false;
    setActiveMessages([]);

    const loadHistory = async () => {
      setIsLoadingMessages(true);
      try {
        const history = await getChatConversation(selectedUserId);
        if (cancelled) return;

        const myUserId = userIdRef.current;
        const myUsername = usernameRef.current;

        const normalizedHistory = history.map((item) => {
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

        setActiveMessages(mergeMessages([], normalizedHistory));

        await markChatConversationRead(selectedUserId);
        if (cancelled) return;

        setConversations((prev) =>
          prev.map((item) =>
            item.otherUserId === selectedUserId
              ? { ...item, unreadCount: 0 }
              : item,
          ),
        );
      } catch (error) {
        if (!cancelled) {
          console.error("[CHAT][ADMIN] conversation history fetch error:", error);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMessages(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.otherUserId === selectedUserId),
    [conversations, selectedUserId],
  );

  const selectedMessages = useMemo(
    () => activeMessages,
    [activeMessages],
  );

  const sendMessage = () => {
    console.log("[CHAT][ADMIN] SEND CALLED");

    const content = inputValue.trim();
    if (!content) return;
    if (!selectedUserId) {
      toast.error("Avval suhbatni tanlang.");
      return;
    }

    const dedupeKey = `${selectedUserId}:${content}`;
    const now = Date.now();
    if (sendLockRef.current) {
      console.warn("[CHAT][ADMIN] Send ignored: lock active");
      return;
    }
    if (
      lastSendRef.current &&
      lastSendRef.current.key === dedupeKey &&
      now - lastSendRef.current.at < 1200
    ) {
      console.warn("[CHAT][ADMIN] Send ignored: duplicate payload window");
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

    client.send("/app/chat.admin-to-user", {
      receiverUserId: selectedUserId,
      content,
    });
    setInputValue("");
    releaseSendLock();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    sendMessage();
  };

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[#E3DBCF] bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareMore className="text-[#6B4F3A]" size={20} />
            <h1 className="text-xl font-bold text-[#2B2B2B]">Admin chat</h1>
          </div>
          <p className="text-sm text-[#9A9A9A]">
            {isConnected
              ? "Ulangan"
              : isConnecting
                ? "Ulanmoqda..."
                : "Ulanish yo'q"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <section className="rounded-2xl border border-[#E3DBCF] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#2B2B2B]">
              Suhbatlar
            </h2>
            {isLoadingConversations && (
              <Loader2 size={14} className="animate-spin text-[#9A9A9A]" />
            )}
          </div>
          <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {conversations.length === 0 ? (
              <p className="text-sm text-[#9A9A9A]">Hozircha suhbatlar yo'q.</p>
            ) : (
              conversations.map((item) => {
                const selected = item.otherUserId === selectedUserId;
                return (
                  <button
                    key={item.otherUserId}
                    type="button"
                    onClick={() => setSelectedUserId(item.otherUserId)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      selected
                        ? "border-[#6B4F3A]/40 bg-[#F5F1E8]"
                        : "border-[#E3DBCF] bg-white hover:bg-[#F5F1E8]/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#2B2B2B]">
                          {item.otherUsername}
                        </p>
                        <p className="mt-1 truncate text-xs text-[#7A7A7A]">
                          {item.lastMessage || "Xabar yo'q"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[11px] text-[#9A9A9A]">
                          {formatMessageTime(item.lastMessageAt)}
                        </span>
                        {item.unreadCount > 0 && (
                          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#6B4F3A] px-1.5 py-0.5 text-[10px] font-semibold text-[#F5F1E8]">
                            {item.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E3DBCF] bg-white p-4">
          <div className="mb-3 flex items-center justify-between border-b border-[#E3DBCF] pb-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#2B2B2B]">
                {selectedConversation?.otherUsername || "Suhbat tanlanmagan"}
              </p>
              <p className="mt-0.5 text-xs text-[#9A9A9A]">
                {selectedConversation
                  ? `ID: ${selectedConversation.otherUserId}`
                  : "Chap paneldan foydalanuvchini tanlang"}
              </p>
            </div>
            <UserRound size={16} className="text-[#9A9A9A]" />
          </div>

          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {isLoadingMessages ? (
              <p className="text-sm text-[#9A9A9A]">Xabarlar yuklanmoqda...</p>
            ) : selectedMessages.length === 0 ? (
              <p className="text-sm text-[#9A9A9A]">
                Hozircha xabarlar yo'q.
              </p>
            ) : (
              selectedMessages.map((message) => (
                <div
                  key={messageKey(message)}
                  className={`max-w-[82%] rounded-xl px-3 py-2 text-sm ${
                    message.mine
                      ? "ml-auto bg-[#6B4F3A] text-[#F5F1E8]"
                      : "mr-auto bg-[#F5F1E8] text-[#2B2B2B]"
                  }`}
                >
                  <p className="break-words">{message.content}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      message.mine ? "text-[#E8D8C5]" : "text-[#8A8A8A]"
                    }`}
                  >
                    {message.mine ? "Siz" : message.senderUsername} ·{" "}
                    {formatMessageDateTime(message.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-3 flex items-center gap-2 border-t border-[#E3DBCF] pt-3"
          >
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={
                selectedConversation
                  ? "Xabar yozing..."
                  : "Avval chapdan suhbat tanlang"
              }
              disabled={!selectedConversation}
              className="flex-1 rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B] placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-[#6B4F3A]/20 disabled:cursor-not-allowed disabled:opacity-70"
            />
            <button
              type="submit"
              disabled={!selectedConversation || isSending}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#6B4F3A] text-[#F5F1E8] hover:bg-[#5A4030] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Xabar yuborish"
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      </div>
    </section>
  );
};

export default AdminChatPage;
