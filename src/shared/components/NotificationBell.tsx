import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../services/api";
import { subscribeNewBookEvent } from "../../services/bookRealtimeBus";

type NotificationItem = {
  id?: number;
  type?: string;
  title?: string;
  message?: string;
};

type BookSearchItem = {
  id?: number;
  title?: string;
};

type BookSearchResponse = {
  content?: BookSearchItem[];
};

type NotificationPage = {
  content: NotificationItem[];
  number: number;
  totalPages: number;
  totalElements: number;
  last: boolean;
};

const DEFAULT_PAGE: NotificationPage = {
  content: [],
  number: 0,
  totalPages: 0,
  totalElements: 0,
  last: true,
};

const PAGE_SIZE = 10;

const normalizePage = (raw: unknown): NotificationPage => {
  if (Array.isArray(raw)) {
    return {
      content: raw as NotificationItem[],
      number: 0,
      totalPages: 1,
      totalElements: raw.length,
      last: true,
    };
  }

  const obj = raw as Partial<NotificationPage> | undefined;
  const content = Array.isArray(obj?.content) ? obj.content : [];
  const number = typeof obj?.number === "number" ? obj.number : 0;
  const totalPages = typeof obj?.totalPages === "number" ? obj.totalPages : 1;
  const totalElements =
    typeof obj?.totalElements === "number" ? obj.totalElements : content.length;
  const last = typeof obj?.last === "boolean" ? obj.last : number + 1 >= totalPages;

  return { content, number, totalPages, totalElements, last };
};

const resolveTitle = (item: NotificationItem) => item.title || item.message || "Bildirishnoma";

const resolveMessage = (item: NotificationItem) => {
  const fallback = item.message || "";
  if (!item.title) return "";
  return fallback;
};

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"unread" | "read">("unread");
  const [unreadPage, setUnreadPage] = useState<NotificationPage>(DEFAULT_PAGE);
  const [readPage, setReadPage] = useState<NotificationPage>(DEFAULT_PAGE);
  const [loadingUnread, setLoadingUnread] = useState(false);
  const [loadingRead, setLoadingRead] = useState(false);
  const [latestBookId, setLatestBookId] = useState<number | null>(null);
  const [showRealtimeDot, setShowRealtimeDot] = useState(false);

  const fetchPage = useCallback(
    async (kind: "unread" | "read", page = 0) => {
      const endpoint =
        kind === "unread" ? "/api/notifications/unread" : "/api/notifications/read";

      if (kind === "unread") setLoadingUnread(true);
      else setLoadingRead(true);

      try {
        const { data } = await api.get(endpoint, { params: { page, size: PAGE_SIZE } });
        const normalized = normalizePage(data);
        if (kind === "unread") setUnreadPage(normalized);
        else setReadPage(normalized);
      } catch {
        toast.error("Bildirishnomalarni yuklashda xatolik yuz berdi.");
      } finally {
        if (kind === "unread") setLoadingUnread(false);
        else setLoadingRead(false);
      }
    },
    [],
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchPage("unread", 0), fetchPage("read", 0)]);
  }, [fetchPage]);

  useEffect(() => {
    void fetchPage("unread", 0);
  }, [fetchPage]);

  useEffect(() => {
    if (!open) return;
    void refreshAll();
    setShowRealtimeDot(false);
  }, [open, refreshAll]);

  useEffect(() => {
    const unsubscribe = subscribeNewBookEvent((payload) => {
      if (payload.type !== "NEW_BOOK") return;
      if (typeof payload.bookId === "number") {
        setLatestBookId(payload.bookId);
      }
      setShowRealtimeDot(true);
      void fetchPage("unread", 0);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchPage]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!open) return;
      const target = event.target as Node | null;
      if (wrapperRef.current && target && !wrapperRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
    };
  }, [open]);

  const totalUnread = unreadPage.totalElements;
  const hasBadge = totalUnread > 0 || showRealtimeDot;
  const activePage = activeTab === "unread" ? unreadPage : readPage;
  const activeLoading = activeTab === "unread" ? loadingUnread : loadingRead;

  const paginationText = useMemo(() => {
    if (activePage.totalElements === 0) return "0 / 0";
    const from = activePage.number * PAGE_SIZE + 1;
    const to = Math.min((activePage.number + 1) * PAGE_SIZE, activePage.totalElements);
    return `${from}-${to} / ${activePage.totalElements}`;
  }, [activePage.number, activePage.totalElements]);

  const handleOpenLatestBook = () => {
    if (!latestBookId) return;
    setOpen(false);
    setShowRealtimeDot(false);
    navigate(`/books/${latestBookId}`);
  };

  const handleOpenNotification = async (item: NotificationItem) => {
    const title = (item.title ?? "").trim();
    if (!title) {
      if (item.type === "NEW_BOOK" && latestBookId) {
        setOpen(false);
        navigate(`/books/${latestBookId}`);
        return;
      }
      toast.info("Bu bildirishnoma uchun kitob topilmadi.");
      return;
    }

    try {
      const { data } = await api.get<BookSearchResponse>("/api/books/search", {
        params: { keyword: title, page: 0, size: 20 },
      });
      const list = Array.isArray(data?.content) ? data.content : [];
      const exact = list.find(
        (book) =>
          typeof book.id === "number" &&
          (book.title ?? "").trim().toLowerCase() === title.toLowerCase(),
      );
      const first = exact ?? list.find((book) => typeof book.id === "number");
      const bookId = first?.id;

      if (typeof bookId === "number") {
        setOpen(false);
        navigate(`/books/${bookId}`);
        return;
      }

      if (item.type === "NEW_BOOK" && latestBookId) {
        setOpen(false);
        navigate(`/books/${latestBookId}`);
        return;
      }

      toast.info("Bu bildirishnoma uchun kitob topilmadi.");
    } catch {
      toast.error("Kitobni ochishda xatolik yuz berdi.");
    }
  };

  const changePage = (direction: "prev" | "next") => {
    const current = activeTab === "unread" ? unreadPage : readPage;
    const nextPage =
      direction === "prev" ? Math.max(0, current.number - 1) : current.number + 1;
    if (direction === "next" && current.last) return;
    void fetchPage(activeTab, nextPage);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3DBCF] bg-white text-[#6B6B6B] transition hover:text-[#2B2B2B]"
        title="Bildirishnomalar"
        aria-label="Bildirishnomalar"
      >
        <Bell size={16} />
        {hasBadge ? (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500" />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[360px] rounded-2xl border border-[#E3DBCF] bg-white p-3 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#2B2B2B]">Bildirishnomalar</p>
            {latestBookId ? (
              <button
                type="button"
                onClick={handleOpenLatestBook}
                className="rounded-lg border border-[#6B4F3A]/30 px-2 py-1 text-xs font-medium text-[#6B4F3A] hover:bg-[#6B4F3A]/10"
              >
                So'nggi kitobni ochish
              </button>
            ) : null}
          </div>

          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("unread")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeTab === "unread"
                  ? "bg-[#6B4F3A] text-[#F5F1E8]"
                  : "border border-[#E3DBCF] text-[#6B6B6B]"
              }`}
            >
              O'qilmagan ({unreadPage.totalElements})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("read")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeTab === "read"
                  ? "bg-[#6B4F3A] text-[#F5F1E8]"
                  : "border border-[#E3DBCF] text-[#6B6B6B]"
              }`}
            >
              O'qilgan ({readPage.totalElements})
            </button>
          </div>

          <div className="no-scrollbar max-h-80 space-y-2 overflow-auto pr-1">
            {activeLoading ? (
              <p className="rounded-xl border border-[#E3DBCF] p-3 text-xs text-[#6B6B6B]">
                Yuklanmoqda...
              </p>
            ) : activePage.content.length === 0 ? (
              <p className="rounded-xl border border-[#E3DBCF] p-3 text-xs text-[#6B6B6B]">
                Bildirishnoma topilmadi.
              </p>
            ) : (
              activePage.content.map((item, index) => {
                const key = item.id ?? `notification-${index}`;
                const title = resolveTitle(item);
                const message = resolveMessage(item);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void handleOpenNotification(item)}
                    className="w-full rounded-xl border border-[#E3DBCF] bg-[#F5F1E8]/40 p-3 text-left transition hover:border-[#6B4F3A]/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[#2B2B2B]">{title}</p>
                      {activeTab === "unread" ? (
                        <span className="mt-1 h-2 w-2 rounded-full bg-[#6B4F3A]" />
                      ) : null}
                    </div>
                    {message ? (
                      <p className="mt-1 line-clamp-2 text-xs text-[#6B6B6B]">{message}</p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[11px] uppercase text-[#9A9A9A]">
                        {item.type ?? "INFO"}
                      </p>
                      <p className="text-[11px] font-semibold text-[#6B4F3A]">Ochish</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[#E3DBCF] pt-2 text-xs">
            <span className="text-[#6B6B6B]">{paginationText}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => changePage("prev")}
                disabled={activePage.number === 0}
                className="rounded border border-[#E3DBCF] px-2 py-1 text-[#6B6B6B] disabled:opacity-50"
              >
                Oldingi
              </button>
              <button
                type="button"
                onClick={() => changePage("next")}
                disabled={activePage.last}
                className="rounded border border-[#E3DBCF] px-2 py-1 text-[#6B6B6B] disabled:opacity-50"
              >
                Keyingi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationBell;
