import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/useAuth";
import { ChatSocketClient } from "../../services/chatSocket";
import {
  emitNewBookEvent,
  type NewBookNotificationPayload,
} from "../../services/bookRealtimeBus";

const BOOK_TOPIC_DESTINATION = "/topic/books";

const BookRealtimeNotifications: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const clientRef = useRef<ChatSocketClient | null>(null);
  const recentKeysRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    const client = new ChatSocketClient();
    clientRef.current = client;

    const isDuplicate = (key: string) => {
      const now = Date.now();
      const prev = recentKeysRef.current.get(key);
      recentKeysRef.current.set(key, now);

      recentKeysRef.current.forEach((value, mapKey) => {
        if (now - value > 15000) {
          recentKeysRef.current.delete(mapKey);
        }
      });

      return typeof prev === "number" && now - prev < 5000;
    };

    const start = async () => {
      try {
        await client.connect({
          token,
          onError: (error) => {
            if (!cancelled) {
              console.error("[BOOK_NOTIFICATION] socket error:", error);
            }
          },
        });

        if (cancelled) return;

        unsubscribe = client.subscribe(
          BOOK_TOPIC_DESTINATION,
          (payload: Record<string, unknown>) => {
            const data = payload as NewBookNotificationPayload;
            console.log("[BOOK_NOTIFICATION]", data);

            if (data.type !== "NEW_BOOK") return;

            const key = `${data.type}:${data.bookId ?? "n/a"}:${data.title ?? ""}`;
            if (isDuplicate(key)) return;

                        const bookId = typeof data.bookId === "number" ? data.bookId : null;
            const toastText = data.message
              ? `${data.message}: ${data.title ?? ""}`
              : `Yangi kitob qo'shildi: ${data.title ?? ""}`;
            toast.info(toastText, {
              toastId: key,
              position: "top-center",
              autoClose: 4500,
              closeOnClick: true,
              style: {
                marginTop: "72px",
                cursor: bookId != null ? "pointer" : "default",
              },
              onClick: () => {
                if (bookId != null) {
                  navigate(`/books/${bookId}`);
                }
              },
            });
            emitNewBookEvent(data);
          },
        );
      } catch (error) {
        if (!cancelled) {
          console.error("[BOOK_NOTIFICATION] connect failed:", error);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      unsubscribe?.();
      client.disconnect();
      clientRef.current = null;
    };
  }, [isAuthenticated, navigate]);

  return null;
};

export default BookRealtimeNotifications;


