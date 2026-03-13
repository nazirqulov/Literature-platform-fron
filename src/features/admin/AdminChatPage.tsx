import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { MessageSquareMore, Send } from "lucide-react";
import { toast } from "react-toastify";
import { ChatSocketClient } from "../../services/chatSocket";
import { useAuth } from "../../context/useAuth";
import api from "../../services/api";

type AdminUiChatMessage = {
  id: string;
  content: string;
  sender: string;
  senderUserId?: number;
  receiverUserId?: number;
  mine: boolean;
  createdAt: string;
};

const ADMIN_MESSAGES_DESTINATION = "/user/queue/messages";

const buildMessageId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const pickString = (payload: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const pickNumber = (payload: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const pickNestedValue = (
  payload: Record<string, unknown>,
  containerKeys: string[],
  valueKey: "id" | "username" | "name",
) => {
  for (const containerKey of containerKeys) {
    const candidate = payload[containerKey];
    if (!candidate || typeof candidate !== "object") continue;
    const value = (candidate as Record<string, unknown>)[valueKey];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
};

const normalizeIncomingAdminMessage = (
  payload: Record<string, unknown>,
  currentUser: { id?: number; username?: string } = {},
): AdminUiChatMessage | null => {
  const content = pickString(payload, ["content", "message", "text", "body"]);
  if (!content) return null;

  const senderUserId =
    pickNumber(payload, ["senderUserId", "fromUserId", "userId"]) ??
    (pickNestedValue(payload, ["sender", "from", "user"], "id") as
      | number
      | undefined);

  const sender =
    pickString(payload, ["senderUsername", "sender", "from", "username"]) ||
    (pickNestedValue(payload, ["sender", "from", "user"], "username") as
      | string
      | undefined) ||
    (pickNestedValue(payload, ["sender", "from", "user"], "name") as
      | string
      | undefined) ||
    "User";

  const receiverUserId =
    pickNumber(payload, ["receiverUserId", "toUserId"]) ??
    (pickNestedValue(payload, ["receiver", "to"], "id") as number | undefined);

  const mine =
    (typeof currentUser.id === "number" &&
      typeof senderUserId === "number" &&
      currentUser.id === senderUserId) ||
    (!!currentUser.username &&
      sender.trim().toLowerCase() === currentUser.username.trim().toLowerCase());

  return {
    id: pickString(payload, ["id", "messageId"]) || buildMessageId(),
    content,
    sender,
    senderUserId,
    receiverUserId,
    mine,
    createdAt:
      pickString(payload, ["createdAt", "sentAt", "timestamp"]) ||
      new Date().toISOString(),
  };
};

const extractConversationList = (data: unknown): Record<string, unknown>[] => {
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object",
    );
  }

  if (data && typeof data === "object" && "content" in data) {
    const pageContent = (data as { content?: unknown }).content;
    if (Array.isArray(pageContent)) {
      return pageContent.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object",
      );
    }
  }

  return [];
};

const sortByCreatedAtAsc = (items: AdminUiChatMessage[]) =>
  [...items].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
    return aTime - bTime;
  });

const uniqueMessageKey = (message: AdminUiChatMessage) =>
  [
    message.senderUserId ?? "",
    message.receiverUserId ?? "",
    message.sender.trim().toLowerCase(),
    message.content.trim(),
    message.createdAt,
  ].join("|");

const mergeUniqueMessages = (
  current: AdminUiChatMessage[],
  incoming: AdminUiChatMessage[],
) => {
  const seen = new Set<string>();
  const merged: AdminUiChatMessage[] = [];

  [...current, ...incoming].forEach((message) => {
    const key = uniqueMessageKey(message);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(message);
  });

  return sortByCreatedAtAsc(merged);
};

const resolveOtherUserId = (
  message: AdminUiChatMessage,
  currentUserId?: number,
) => {
  if (typeof currentUserId === "number") {
    if (message.senderUserId === currentUserId) return message.receiverUserId;
    if (message.receiverUserId === currentUserId) return message.senderUserId;
  }
  return message.mine ? message.receiverUserId : message.senderUserId;
};

const AdminChatPage: React.FC = () => {
  const { user } = useAuth();
  const clientRef = useRef<ChatSocketClient | null>(null);
  const usernameRef = useRef<string | undefined>(user?.username);
  const userIdRef = useRef<number | undefined>(user?.id);
  const selectedUserIdRef = useRef<string>("");
  const [receiverUserId, setReceiverUserId] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<AdminUiChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConversationLoading, setIsConversationLoading] = useState(false);

  useEffect(() => {
    usernameRef.current = user?.username;
  }, [user?.username]);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    selectedUserIdRef.current = receiverUserId;
  }, [receiverUserId]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    let cancelled = false;
    const client = new ChatSocketClient();
    clientRef.current = client;
    setIsConnecting(true);
    let unsubscribe: (() => void) | null = null;

    const start = async () => {
      try {
        await client.connect({
          token,
          onConnect: () => {
            if (!cancelled) {
              setIsConnected(true);
              setIsConnecting(false);
            }
            console.log("[CHAT][ADMIN] STOMP connected as:", usernameRef.current);
          },
          onError: (error) => {
            if (!cancelled) {
              setIsConnected(false);
              setIsConnecting(false);
            }
            console.error("[CHAT][ADMIN] STOMP/WebSocket error:", error);
          },
          onClose: () => {
            if (!cancelled) {
              setIsConnected(false);
            }
            console.warn("[CHAT][ADMIN] Connection closed");
          },
        });

        unsubscribe = client.subscribe(ADMIN_MESSAGES_DESTINATION, (payload, meta) => {
          console.log("Message arrived", meta.rawBody);
          console.log("[CHAT][ADMIN] Message meta:", {
            destination: meta.destination,
            parsed: payload,
          });
          const normalized = normalizeIncomingAdminMessage(payload, {
            id: userIdRef.current,
            username: usernameRef.current,
          });
          if (!normalized) return;

          setMessages((prev) => {
            const next = mergeUniqueMessages(prev, [normalized]);
            console.log("[CHAT][ADMIN] messages state updated:", next.length);
            return next;
          });

          const otherUserId = resolveOtherUserId(normalized, userIdRef.current);
          if (
            !selectedUserIdRef.current &&
            typeof otherUserId === "number" &&
            otherUserId > 0
          ) {
            setReceiverUserId(String(otherUserId));
            console.log("[CHAT][ADMIN] Auto-selected conversation user:", otherUserId);
          }
        });
      } catch (error) {
        if (!cancelled) {
          setIsConnected(false);
          setIsConnecting(false);
          toast.error("Admin chat serveriga ulanib bo'lmadi.");
        }
        console.error("[CHAT][ADMIN] Connect failed:", error);
      }
    };

    void start();

    return () => {
      cancelled = true;
      unsubscribe?.();
      client.disconnect();
      clientRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
    };
  }, []);

  useEffect(() => {
    const selectedId = Number(receiverUserId);
    if (!Number.isFinite(selectedId) || selectedId <= 0) return;

    let cancelled = false;

    const loadConversation = async () => {
      setIsConversationLoading(true);
      try {
        const { data } = await api.get<unknown>(`/conversation/${selectedId}`);
        console.log("[CHAT][ADMIN] Conversation loaded:", data);

        if (cancelled) return;

        const history = extractConversationList(data)
          .map((item) => {
            const normalized = normalizeIncomingAdminMessage(item, {
              id: userIdRef.current,
              username: usernameRef.current,
            });
            if (!normalized) return null;

            // Some backends omit one side userId in history payload.
            // Infer by selected user so both chat directions remain visible.
            if (normalized.mine && normalized.receiverUserId == null) {
              return { ...normalized, receiverUserId: selectedId };
            }
            if (!normalized.mine && normalized.senderUserId == null) {
              return { ...normalized, senderUserId: selectedId };
            }
            return normalized;
          })
          .filter((item): item is AdminUiChatMessage => item !== null);

        setMessages((prev) => mergeUniqueMessages(prev, history));
      } catch (error) {
        if (!cancelled) {
          console.error("[CHAT][ADMIN] Conversation fetch error:", error);
        }
      } finally {
        if (!cancelled) {
          setIsConversationLoading(false);
        }
      }
    };

    void loadConversation();

    return () => {
      cancelled = true;
    };
  }, [receiverUserId]);

  const filteredMessages = useMemo(() => {
    const selectedId = Number(receiverUserId);
    if (!Number.isFinite(selectedId) || selectedId <= 0) return messages;
    return messages.filter((msg) => {
      return msg.senderUserId === selectedId || msg.receiverUserId === selectedId;
    });
  }, [messages, receiverUserId]);

  const sendMessage = () => {
    const content = inputValue.trim();
    const receiverId = Number(receiverUserId);

    if (!content) return;
    if (!Number.isFinite(receiverId) || receiverId <= 0) {
      toast.error("User ID ni to'g'ri kiriting.");
      return;
    }

    const client = clientRef.current;
    if (!client || !client.isConnected()) {
      toast.error("Chat server bilan ulanish yo'q.");
      return;
    }

    client.send("/app/chat.admin-to-user", {
      receiverUserId: receiverId,
      content,
    });

    setMessages((prev) =>
      mergeUniqueMessages(prev, [
        {
          id: buildMessageId(),
          content,
          sender: user?.username ?? "Admin",
          receiverUserId: receiverId,
          mine: true,
          createdAt: new Date().toISOString(),
        },
      ]),
    );
    setInputValue("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

      <div className="rounded-2xl border border-[#E3DBCF] bg-white p-5">
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 sm:grid-cols-[220px,1fr,auto]"
        >
          <input
            value={receiverUserId}
            onChange={(event) => setReceiverUserId(event.target.value)}
            placeholder="Receiver User ID"
            className="rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B] placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-[#6B4F3A]/20"
          />
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Xabar yozing..."
            className="rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-2 text-sm text-[#2B2B2B] placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-[#6B4F3A]/20"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6B4F3A] px-4 py-2 text-sm font-semibold text-[#F5F1E8] hover:bg-[#5A4030]"
          >
            <Send size={16} />
            Yuborish
          </button>
        </form>
        <p className="mt-2 text-xs text-[#9A9A9A]">
          User ID bo'sh bo'lsa barcha realtime xabarlar ko'rinadi. Yangi xabar
          kelganda suhbat avtomatik tanlanadi.
        </p>
      </div>

      <div className="rounded-2xl border border-[#E3DBCF] bg-white p-5">
        {isConversationLoading && (
          <p className="mb-3 text-sm text-[#9A9A9A]">
            Suhbat tarixi yuklanmoqda...
          </p>
        )}
        <div className="max-h-[520px] space-y-2 overflow-y-auto">
          {filteredMessages.length === 0 ? (
            <p className="text-sm text-[#9A9A9A]">
              Hozircha xabarlar yo'q.
            </p>
          ) : (
            filteredMessages.map((msg) => (
              <div
                key={msg.id}
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
                  {msg.sender}
                  {msg.senderUserId ? ` (ID: ${msg.senderUserId})` : ""}
                  {msg.receiverUserId ? ` -> ${msg.receiverUserId}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default AdminChatPage;
