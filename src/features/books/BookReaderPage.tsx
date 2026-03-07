import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { isAxiosError } from "axios";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

type ProgressResponse = {
  currentPage?: number;
  currentChapter?: number;
  progressPercentage?: number;
};

const UPDATE_DEBOUNCE_MS = 700;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.2;
const ZOOM_STEP = 0.1;
const MAX_PAGE_WIDTH = 1100;

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizePage = (value: number) => Math.max(1, Math.floor(value));

const useBookProgress = (bookId: number | null) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) {
      setLoading(false);
      setError("Kitob identifikatori noto'g'ri.");
      setCurrentPage(1);
      setCurrentChapter(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setCurrentPage(1);
    setCurrentChapter(0);

    api
      .get<ProgressResponse>(`/api/books/${bookId}/progress`)
      .then(({ data }) => {
        if (cancelled) return;
        const page = Number.isFinite(data?.currentPage)
          ? normalizePage(data?.currentPage ?? 1)
          : 1;
        const chapter = Number.isFinite(data?.currentChapter)
          ? Math.max(0, Math.floor(data?.currentChapter ?? 0))
          : 0;
        setCurrentPage(page);
        setCurrentChapter(chapter);
      })
      .catch((error) => {
        if (cancelled) return;
        if (isAxiosError(error) && error.response?.status === 404) {
          setCurrentPage(1);
          setCurrentChapter(0);
          return;
        }
        setCurrentPage(1);
        setCurrentChapter(0);
        setError("O'qish holatini yuklashda xatolik yuz berdi.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  return {
    currentPage,
    setCurrentPage,
    currentChapter,
    setCurrentChapter,
    loading,
    error,
    setError,
  };
};

const usePdfFile = (bookId: number | null) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bookId) {
      setLoading(false);
      setError("Kitob identifikatori noto'g'ri.");
      setPdfUrl(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfUrl(null);

    const fetchPdf = async () => {
      const endpoints = [
        `/api/books/${bookId}/pdf`,
        `/api/books/file/pdf/${bookId}`,
      ];

      for (let i = 0; i < endpoints.length; i += 1) {
        const endpoint = endpoints[i];
        try {
          const response = await api.get<Blob>(endpoint, {
            responseType: "blob",
          });
          if (cancelled) return;
          if (!response.data || response.data.size === 0) {
            setError("PDF fayl topilmadi.");
            return;
          }

          const objectUrl = URL.createObjectURL(response.data);
          if (pdfObjectUrlRef.current) {
            URL.revokeObjectURL(pdfObjectUrlRef.current);
          }
          pdfObjectUrlRef.current = objectUrl;
          setPdfUrl(objectUrl);
          return;
        } catch (error) {
          if (cancelled) return;
          const isNotFound =
            isAxiosError(error) && error.response?.status === 404;
          if (isNotFound && i < endpoints.length - 1) {
            continue;
          }
          setError("PDF faylni yuklashda xatolik yuz berdi.");
          return;
        }
      }
    };

    void fetchPdf().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    return () => {
      if (pdfObjectUrlRef.current) {
        URL.revokeObjectURL(pdfObjectUrlRef.current);
      }
    };
  }, []);

  return { pdfUrl, loading, error };
};

const BookReaderPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const parsedBookId = Number(bookId);
  const bookIdNumber =
    Number.isFinite(parsedBookId) && parsedBookId > 0 ? parsedBookId : null;

  const { pdfUrl, loading: pdfLoading, error: pdfError } = usePdfFile(bookIdNumber);
  const {
    currentPage,
    setCurrentPage,
    currentChapter,
    loading: progressLoading,
    error: progressError,
    setError: setProgressError,
  } = useBookProgress(bookIdNumber);

  const [numPages, setNumPages] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const progressDebounceRef = useRef<number | null>(null);
  const startReadingRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const sessionIdRef = useRef<number | null>(null);
  const currentPageRef = useRef(currentPage);

  const isBusy = pdfLoading || progressLoading;
  const fatalError = pdfError;

  const startSession = useCallback(
    async (force = false) => {
      if (!bookIdNumber || progressLoading) return;
      if (!force && sessionStartedRef.current) return;
      sessionStartedRef.current = true;
      try {
        const { data } = await api.post("/api/books/sessions/start", {
          bookId: bookIdNumber,
          currentPage: currentPageRef.current,
        });
        const sessionId = data?.sessionId;
        sessionIdRef.current =
          typeof sessionId === "number" ? sessionId : null;
      } catch {
        if (!force) {
          sessionStartedRef.current = false;
        }
      }
    },
    [bookIdNumber, progressLoading],
  );

  const endSession = useCallback(
    async (useBeacon: boolean) => {
      if (!bookIdNumber) return;
      const endPage = currentPageRef.current;
      const sessionId = sessionIdRef.current;
      const endpoint = sessionId
        ? "/api/books/sessions/end"
        : "/api/books/sessions/end-active";
      const payload = sessionId
        ? { sessionId, endPage }
        : { endPage };

      if (useBeacon) {
        const baseUrl = api.defaults.baseURL ?? "";
        const token = localStorage.getItem("accessToken");
        fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => undefined);
        return;
      }

      await api.post(endpoint, payload).catch(() => undefined);
    },
    [bookIdNumber],
  );

  useEffect(() => {
    if (!bookIdNumber || startReadingRef.current) return;
    startReadingRef.current = true;
    api.post(`/api/books/${bookIdNumber}/start`).catch(() => {
      startReadingRef.current = false;
    });
  }, [bookIdNumber]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    void startSession(false);
  }, [startSession]);

  useEffect(() => {
    if (!bookIdNumber) return;
    const handleBeforeUnload = () => {
      void endSession(true);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void endSession(false);
    };
  }, [bookIdNumber, endSession]);

  const handleCloseReader = useCallback(async () => {
    await endSession(false);
    navigate("/books");
  }, [endSession, navigate]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setContainerWidth(rect.width);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, [pdfUrl]);

  useEffect(() => {
    return () => {
      if (progressDebounceRef.current) {
        window.clearTimeout(progressDebounceRef.current);
      }
    };
  }, []);

  const pageWidth = useMemo(() => {
    if (!containerWidth) return undefined;
    return Math.min(containerWidth, MAX_PAGE_WIDTH);
  }, [containerWidth]);

  const resolvePage = useCallback(
    (page: number) => {
      const normalized = normalizePage(page);
      return numPages ? clampNumber(normalized, 1, numPages) : normalized;
    },
    [numPages],
  );

  const scheduleProgressUpdate = useCallback(
    (page: number) => {
      if (!bookIdNumber) return;
      setProgressError(null);

      if (progressDebounceRef.current) {
        window.clearTimeout(progressDebounceRef.current);
      }

      progressDebounceRef.current = window.setTimeout(() => {
        api
          .put(`/api/books/${bookIdNumber}/progress`, {
            currentPage: page,
            currentChapter,
          })
          .catch(() => {
            setProgressError("O'qish holatini saqlashda xatolik yuz berdi.");
          });
      }, UPDATE_DEBOUNCE_MS);
    },
    [bookIdNumber, currentChapter, setProgressError],
  );

  const goToPage = useCallback(
    (page: number) => {
      if (isBusy) return;
      const nextPage = resolvePage(page);
      setCurrentPage(nextPage);
      scheduleProgressUpdate(nextPage);
    },
    [isBusy, resolvePage, scheduleProgressUpdate, setCurrentPage],
  );

  const handleDocumentLoadSuccess = useCallback(
    ({ numPages: loadedPages }: { numPages: number }) => {
      setNumPages(loadedPages);
      setCurrentPage((page) =>
        clampNumber(normalizePage(page), 1, loadedPages),
      );
    },
    [setCurrentPage],
  );

  const zoomIn = useCallback(() => {
    setZoom((prev) =>
      clampNumber(Number((prev + ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM),
    );
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) =>
      clampNumber(Number((prev - ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM),
    );
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const pageLabel = numPages
    ? `Page ${currentPage} of ${numPages}`
    : `Page ${currentPage}`;

  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const canGoPrev = !isBusy && currentPage > 1;
  const canGoNext = !isBusy && numPages != null && currentPage < numPages;

  return (
    <section className="min-h-screen px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="glass sticky top-16 z-40 flex flex-col gap-3 rounded-2xl border border-[#E3DBCF] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={!canGoPrev}
              className="rounded-lg border border-[#E3DBCF] px-3 py-1.5 text-xs font-semibold text-[#6B4F3A] transition hover:bg-[#F5F1E8] disabled:opacity-60"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={!canGoNext}
              className="rounded-lg border border-[#E3DBCF] px-3 py-1.5 text-xs font-semibold text-[#6B4F3A] transition hover:bg-[#F5F1E8] disabled:opacity-60"
            >
              Next
            </button>
          </div>

          <div className="text-center text-sm font-semibold text-[#2B2B2B] sm:text-left">
            {pageLabel}
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => void startSession(true)}
              className="rounded-lg border border-[#E3DBCF] px-3 py-1.5 text-xs font-semibold text-[#6B6B6B] transition hover:bg-[#F5F1E8]"
            >
              Start reading
            </button>
            <button
              type="button"
              onClick={handleCloseReader}
              className="rounded-lg border border-[#E3DBCF] px-3 py-1.5 text-xs font-semibold text-[#6B6B6B] transition hover:bg-[#F5F1E8]"
            >
              Close reader
            </button>
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="rounded-lg border border-[#E3DBCF] px-3 py-1.5 text-xs font-semibold text-[#6B4F3A] transition hover:bg-[#F5F1E8] disabled:opacity-60"
            >
              -
            </button>
            <button
              type="button"
              onClick={resetZoom}
              className="rounded-lg border border-[#E3DBCF] px-3 py-1.5 text-xs font-semibold text-[#6B6B6B] transition hover:bg-[#F5F1E8]"
            >
              {zoomLabel}
            </button>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="rounded-lg border border-[#E3DBCF] px-3 py-1.5 text-xs font-semibold text-[#6B4F3A] transition hover:bg-[#F5F1E8] disabled:opacity-60"
            >
              +
            </button>
          </div>
        </div>

        {!fatalError && progressError && (
          <div className="glass rounded-2xl border border-[#E3DBCF] px-4 py-3 text-sm text-[#C97B63]">
            {progressError}
          </div>
        )}

        <div className="glass rounded-2xl border border-[#E3DBCF] p-4">
          {fatalError ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-[#C97B63]">
              {fatalError}
            </div>
          ) : isBusy || !pdfUrl ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-[#6B6B6B]">
              Yuklanmoqda...
            </div>
          ) : (
            <div ref={containerRef} className="w-full overflow-auto">
              <div className="flex justify-center py-2">
                <Document
                  file={pdfUrl}
                  onLoadSuccess={handleDocumentLoadSuccess}
                  loading={
                    <div className="py-10 text-sm text-[#6B6B6B]">
                      PDF yuklanmoqda...
                    </div>
                  }
                  error={
                    <div className="py-10 text-sm text-[#C97B63]">
                      PDF ochilmadi.
                    </div>
                  }
                >
                  <Page
                    pageNumber={currentPage}
                    width={pageWidth}
                    scale={zoom}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading={
                      <div className="py-10 text-sm text-[#6B6B6B]">
                        Sahifa yuklanmoqda...
                      </div>
                    }
                  />
                </Document>
              </div>
            </div>
          )}
        </div>

      </div>
    </section>
  );
};

export default BookReaderPage;
