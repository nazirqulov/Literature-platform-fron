import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { isSuperAdminRole } from "../../shared/utils/roleUtils";
import { ChatSocketClient } from "../../services/chatSocket";

type UiChatMessage = {
  id: string;
  content: string;
  sender: string;
  createdAt: string;
  mine: boolean;
};

const USER_MESSAGES_DESTINATION = "/user/queue/messages";

const buildMessageId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const pickString = (payload: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const normalizeIncomingMessage = (
  payload: Record<string, unknown>,
  username?: string,
): UiChatMessage | null => {
  const content = pickString(payload, ["content", "message", "text", "body"]);
  if (!content) return null;

  const sender = pickString(payload, [
    "senderUsername",
    "sender",
    "from",
    "username",
  ]) || "Admin";

  const createdAt =
    pickString(payload, ["createdAt", "sentAt", "timestamp"]) ||
    new Date().toISOString();

  const mine =
    !!username &&
    sender.trim().toLowerCase() === username.trim().toLowerCase();

  return {
    id: pickString(payload, ["id", "messageId"]) || buildMessageId(),
    content,
    sender,
    createdAt,
    mine,
  };
};

const UserChatWidget: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const clientRef = useRef<ChatSocketClient | null>(null);
  const usernameRef = useRef<string | undefined>(user?.username);
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<UiChatMessage[]>([]);

  useEffect(() => {
    usernameRef.current = user?.username;
  }, [user?.username]);

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
    if (!shouldRender) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    let cancelled = false;
    const client = new ChatSocketClient();
    clientRef.current = client;
    setIsConnecting(true);

    const handleIncoming = (payload: Record<string, unknown>) => {
      const normalized = normalizeIncomingMessage(payload, usernameRef.current);
      if (!normalized) return;
      setMessages((prev) => [...prev, normalized]);
    };

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
            console.log("[CHAT][USER] STOMP connected as:", usernameRef.current);
          },
          onError: (error) => {
            if (!cancelled) {
              setIsConnected(false);
              setIsConnecting(false);
            }
            console.error("[CHAT][USER] STOMP/WebSocket error:", error);
          },
          onClose: () => {
            if (!cancelled) {
              setIsConnected(false);
            }
            console.warn("[CHAT][USER] Connection closed");
          },
        });

        if (cancelled) return;

        unsubscribe = client.subscribe(USER_MESSAGES_DESTINATION, (payload, meta) => {
          console.log("[CHAT][USER] Message arrived:", {
            destination: meta.destination,
            raw: meta.rawBody,
            parsed: payload,
          });
          handleIncoming(payload);
        });
        console.log("[CHAT][USER] Subscribed:", USER_MESSAGES_DESTINATION);
      } catch (error) {
        if (!cancelled) {
          setIsConnected(false);
          setIsConnecting(false);
        }
        console.error("[CHAT][USER] Connect failed:", error);
      }
    };

    void start();

    return () => {
      cancelled = true;
      unsubscribe?.();
      console.log("[CHAT][USER] Unsubscribed:", USER_MESSAGES_DESTINATION);
      client.disconnect();
      clientRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
    };
  }, [shouldRender]);

  const sendMessage = () => {
    console.log("SEND CALLED");
    const content = inputValue.trim();
    if (!content) return;

    const client = clientRef.current;
    if (!client || !client.isConnected()) {
      toast.error("Chat server bilan ulanish yo'q.");
      return;
    }

    client.send("/app/chat.user-to-admin", { content });
    // Optimistic update removed to avoid duplicate render when server echoes
    // the same message via /user/queue/messages.
    setInputValue("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMessage();
  };

  if (!shouldRender) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {isOpen ? (
        <div className="w-[min(92vw,360px)] rounded-2xl border border-[#E3DBCF] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#E3DBCF] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#2B2B2B]">
                Admin bilan chat
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
            {messages.length === 0 ? (
              <p className="text-xs text-[#9A9A9A]">
                Savolingizni yozing, admin tez orada javob beradi.
              </p>
            ) : (
              messages.map((msg) => (
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#6B4F3A] text-[#F5F1E8] hover:bg-[#5A4030]"
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
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#6B4F3A] text-[#F5F1E8] shadow-lg transition hover:bg-[#5A4030]"
          aria-label="Admin chatni ochish"
        >
          <MessageCircle size={20} />
        </button>
      )}
    </div>
  );
};

export default UserChatWidget;
