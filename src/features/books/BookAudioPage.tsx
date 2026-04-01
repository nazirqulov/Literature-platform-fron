import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  FastForward,
  Pause,
  Play,
  Rewind,
} from "lucide-react";
import { isAxiosError } from "axios";
import api from "../../services/api";
import BookCover from "../../shared/components/ui/BookCover";

interface AuthorResponse {
  id?: number;
  name?: string;
}

interface BookDetail {
  id?: number;
  title?: string;
  description?: string | null;
  author?: AuthorResponse | null;
  coverImage?: string | null;
}

type AudioProgressResponse = {
  second?: number;
  seconds?: number;
  currentSecond?: number;
  position?: number;
  currentTime?: number;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const secs = String(safe % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
};

const resolveCoverUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  const baseUrl = api.defaults.baseURL ?? "http://localhost:8080";
  return new URL(value.replace(/^\/+/, ""), `${baseUrl}/`).toString();
};

const extractBookPayload = (data: unknown): BookDetail | null => {
  if (!data || typeof data !== "object") return null;
  const typed = data as Record<string, unknown>;
  const content = typed.content;
  const possible =
    (typed.book as BookDetail | undefined) ??
    (typed.data as BookDetail | undefined) ??
    (!Array.isArray(content) ? (content as BookDetail | undefined) : undefined) ??
    (data as BookDetail);
  return possible ?? null;
};

const resolveAudioSeconds = (data: unknown) => {
  if (typeof data === "number" && Number.isFinite(data)) {
    return Math.max(0, data);
  }

  if (data && typeof data === "object") {
    const typed = data as AudioProgressResponse;
    const candidates = [
      typed.second,
      typed.seconds,
      typed.currentSecond,
      typed.position,
      typed.currentTime,
    ];
    for (const item of candidates) {
      if (typeof item === "number" && Number.isFinite(item)) {
        return Math.max(0, item);
      }
    }
  }

  return null;
};

const useAudioFile = (bookId: number | null) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bookId) {
      setLoading(false);
      setError("Kitob identifikatori noto'g'ri.");
      setAudioUrl(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setAudioUrl(null);

    const fetchAudio = async () => {
      const endpoint = `/api/books/${bookId}/audio`;
      try {
        const response = await api.get<Blob>(endpoint, {
          responseType: "blob",
        });
        if (cancelled) return;
        if (!response.data || response.data.size === 0) {
          setError("Audio fayl topilmadi.");
          return;
        }

        const objectUrl = URL.createObjectURL(response.data);
        if (audioObjectUrlRef.current) {
          URL.revokeObjectURL(audioObjectUrlRef.current);
        }
        audioObjectUrlRef.current = objectUrl;
        setAudioUrl(objectUrl);
      } catch (error) {
        if (cancelled) return;
        const isNotFound =
          isAxiosError(error) && error.response?.status === 404;
        setError(
          isNotFound
            ? "Audio fayl topilmadi."
            : "Audio faylni yuklashda xatolik yuz berdi.",
        );
      }
    };

    void fetchAudio().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    return () => {
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
      }
    };
  }, []);

  return { audioUrl, loading, error };
};

const BookAudioPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const parsedBookId = Number(bookId);
  const bookIdNumber =
    Number.isFinite(parsedBookId) && parsedBookId > 0 ? parsedBookId : null;

  const [book, setBook] = useState<BookDetail | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const coverObjectUrlRef = useRef<string | null>(null);

  const { audioUrl, loading: audioLoading, error: audioError } =
    useAudioFile(bookIdNumber);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioResumeSeconds, setAudioResumeSeconds] = useState<number | null>(null);
  const [audioResumeError, setAudioResumeError] = useState<string | null>(null);
  const audioResumeAppliedRef = useRef(false);
  const lastSavedAudioSecondRef = useRef<number | null>(null);

  useEffect(() => {
    if (!bookIdNumber) {
      setBookError("Kitob identifikatori noto'g'ri.");
      return;
    }

    let cancelled = false;
    setBookError(null);

    const fetchDetail = async () => {
      const endpoints = [
        `/api/books/${bookIdNumber}`,
        `/api/books/get/${bookIdNumber}`,
        `/api/books/get-by-id/${bookIdNumber}`,
      ];

      for (let i = 0; i < endpoints.length; i += 1) {
        const endpoint = endpoints[i];
        try {
          const { data } = await api.get(endpoint);
          if (cancelled) return;
          const resolved = extractBookPayload(data);
          if (resolved) {
            setBook(resolved);
            return;
          }
        } catch {
          if (cancelled) return;
          if (i < endpoints.length - 1) continue;
          setBookError("Kitob ma'lumotlarini yuklashda xatolik yuz berdi.");
        }
      }
    };

    void fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [bookIdNumber]);

  useEffect(() => {
    if (!bookIdNumber) return;
    let cancelled = false;
    const fallbackCover = () => setCoverUrl(resolveCoverUrl(book?.coverImage));

    const fetchCover = async () => {
      if (book?.coverImage) {
        fallbackCover();
        return;
      }

      try {
        const response = await api.get<Blob>(
          `/api/books/book-image/${bookIdNumber}`,
          { responseType: "blob" },
        );
        if (cancelled) return;
        if (!response.data || response.data.size === 0) {
          fallbackCover();
          return;
        }
        if (
          typeof response.data.type === "string" &&
          response.data.type.length > 0 &&
          !response.data.type.startsWith("image/")
        ) {
          fallbackCover();
          return;
        }

        const objectUrl = URL.createObjectURL(response.data);
        if (coverObjectUrlRef.current) {
          URL.revokeObjectURL(coverObjectUrlRef.current);
        }
        coverObjectUrlRef.current = objectUrl;
        setCoverUrl(objectUrl);
      } catch {
        if (!cancelled) {
          fallbackCover();
        }
      }
    };

    void fetchCover();

    return () => {
      cancelled = true;
    };
  }, [bookIdNumber, book?.coverImage]);

  useEffect(() => {
    return () => {
      if (coverObjectUrlRef.current) {
        URL.revokeObjectURL(coverObjectUrlRef.current);
        coverObjectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!bookIdNumber) {
      setAudioResumeSeconds(null);
      setAudioResumeError(null);
      return;
    }

    let cancelled = false;
    setAudioResumeError(null);

    api
      .get<number | AudioProgressResponse>(`/api/me/books/${bookIdNumber}/audio`)
      .then(({ data }) => {
        if (cancelled) return;
        const seconds = resolveAudioSeconds(data);
        setAudioResumeSeconds(seconds);
      })
      .catch((error) => {
        if (cancelled) return;
        if (isAxiosError(error) && error.response?.status === 404) {
          setAudioResumeSeconds(null);
          return;
        }
        setAudioResumeError("Audio holatini yuklashda xatolik yuz berdi.");
      });

    return () => {
      cancelled = true;
    };
  }, [bookIdNumber]);

  useEffect(() => {
    audioResumeAppliedRef.current = false;
  }, [audioUrl]);

  const applyAudioResume = useCallback(() => {
    if (!audioRef.current || audioResumeAppliedRef.current) return;
    if (audioResumeSeconds == null) return;
    const audioEl = audioRef.current;
    const safeSeconds = Math.max(0, audioResumeSeconds);
    if (Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
      audioEl.currentTime = Math.min(
        safeSeconds,
        Math.max(0, audioEl.duration - 0.2),
      );
    } else {
      audioEl.currentTime = safeSeconds;
    }
    audioResumeAppliedRef.current = true;
  }, [audioResumeSeconds]);

  useEffect(() => {
    if (!audioRef.current || audioResumeSeconds == null) return;
    if (audioRef.current.readyState >= 1) {
      applyAudioResume();
    }
  }, [applyAudioResume, audioResumeSeconds, audioUrl]);

  const saveAudioProgress = useCallback(
    async (second: number, useBeacon = false) => {
      if (!bookIdNumber || !Number.isFinite(second)) return;
      const normalized = Math.max(0, Math.floor(second));
      if (lastSavedAudioSecondRef.current === normalized) return;
      lastSavedAudioSecondRef.current = normalized;

      const endpoint = `/api/me/books/${bookIdNumber}/audio/save`;
      const query = `duration=${encodeURIComponent(String(normalized))}`;

      if (useBeacon) {
        const baseUrl = api.defaults.baseURL ?? "";
        const token = localStorage.getItem("accessToken");
        fetch(`${baseUrl}${endpoint}?${query}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          keepalive: true,
        }).catch(() => undefined);
        return;
      }

      await api
        .post(endpoint, null, { params: { duration: normalized } })
        .catch(() => undefined);
    },
    [bookIdNumber],
  );

  const handleAudioPause = useCallback(() => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    void saveAudioProgress(current);
    if (Number.isFinite(current)) {
      setAudioResumeSeconds(Math.max(0, current));
    }
  }, [saveAudioProgress]);

  const handleAudioEnded = useCallback(() => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    void saveAudioProgress(current);
    if (Number.isFinite(current)) {
      setAudioResumeSeconds(Math.max(0, current));
    }
  }, [saveAudioProgress]);

  useEffect(() => {
    const handlePageHide = () => {
      if (!audioRef.current) return;
      void saveAudioProgress(audioRef.current.currentTime, true);
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [saveAudioProgress]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const handlePlayPause = useCallback(async () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      try {
        await audioRef.current.play();
      } catch {
        // ignore autoplay errors
      }
    } else {
      audioRef.current.pause();
    }
  }, []);

  const handleSkip = useCallback(
    (delta: number) => {
      if (!audioRef.current) return;
      const next = clampNumber(
        audioRef.current.currentTime + delta,
        0,
        Number.isFinite(duration) && duration > 0
          ? duration
          : audioRef.current.duration || 0,
      );
      audioRef.current.currentTime = next;
      setCurrentTime(next);
    },
    [duration],
  );

  const handleSeek = (value: number) => {
    if (!audioRef.current) return;
    const next = clampNumber(value, 0, duration || 0);
    audioRef.current.currentTime = next;
    setCurrentTime(next);
  };

  const speedOptions = useMemo(() => [0.75, 1, 1.25, 1.5, 2], []);

  if (!bookIdNumber) {
    return (
      <section className="max-w-5xl mx-auto px-4 py-10">
        <div className="glass rounded-2xl p-6 text-sm text-[#C97B63]">
          Kitob identifikatori noto'g'ri.
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B4F3A] hover:text-[#5A4030]"
      >
        <ArrowLeft size={16} />
        Orqaga
      </button>

      <div className="glass rounded-3xl border border-[#E3DBCF] p-5 md:p-6 lg:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(240px,280px),minmax(0,1fr)] lg:items-start">
          <figure className="mx-auto w-full max-w-[280px] rounded-3xl border border-[#E3DBCF] bg-gradient-to-b from-white to-[#F6F1E9] p-3">
            <BookCover
              title={book?.title ?? "Muqova"}
              src={coverUrl}
              loading={!coverUrl}
              ratioClassName="aspect-[2/3]"
              fit="contain"
              className="w-full"
            />
          </figure>

          <header className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#2B2B2B] md:text-3xl">
              {book?.title ?? "Kitob nomi ko'rsatilmagan"}
            </h1>
            <p className="text-base text-[#6B6B6B] md:text-lg">
              Muallif:{" "}
              <span className="font-medium text-[#2B2B2B]">
                {book?.author?.name ?? "Muallif ko'rsatilmagan"}
              </span>
            </p>
            {book?.description ? (
              <p className="max-w-3xl text-sm leading-7 text-[#6B6B6B]">
                {book.description}
              </p>
            ) : null}
            {bookError ? (
              <p className="text-xs text-[#C97B63]">{bookError}</p>
            ) : null}
          </header>
        </div>

        <div className="mt-6 border-t border-[#E3DBCF] pt-6">
          {audioLoading ? (
            <div className="text-sm text-[#6B6B6B]">Audio yuklanmoqda...</div>
          ) : audioUrl ? (
            <>
              <audio
                ref={audioRef}
                src={audioUrl}
                preload="metadata"
                onLoadedMetadata={() => {
                  if (!audioRef.current) return;
                  setDuration(audioRef.current.duration || 0);
                  applyAudioResume();
                }}
                onTimeUpdate={() => {
                  if (!audioRef.current) return;
                  setCurrentTime(audioRef.current.currentTime);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => {
                  setIsPlaying(false);
                  handleAudioPause();
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  handleAudioEnded();
                }}
              />

              <div className="mx-auto max-w-3xl space-y-4">
                <div className="flex items-center justify-center gap-4 md:gap-5">
                  <button
                    type="button"
                    onClick={() => handleSkip(-10)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E3DBCF] bg-white text-[#6B4F3A] transition hover:bg-[#F5F1E8]"
                    aria-label="10 soniya orqaga"
                  >
                    <Rewind size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={handlePlayPause}
                    className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#6B4F3A] text-[#F5F1E8] transition hover:bg-[#5A4030]"
                    aria-label={isPlaying ? "Pauza" : "Boshlash"}
                  >
                    {isPlaying ? <Pause size={22} /> : <Play size={22} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSkip(10)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E3DBCF] bg-white text-[#6B4F3A] transition hover:bg-[#F5F1E8]"
                    aria-label="10 soniya oldinga"
                  >
                    <FastForward size={18} />
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={1}
                    value={currentTime}
                    onChange={(event) => handleSeek(Number(event.target.value))}
                    className="w-full accent-[#6B4F3A]"
                  />
                  <div className="flex items-center justify-between text-xs text-[#6B6B6B]">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#6B6B6B]">
                  {speedOptions.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setPlaybackRate(speed)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        playbackRate === speed
                          ? "border-[#6B4F3A] bg-[#6B4F3A] text-[#F5F1E8]"
                          : "border-[#E3DBCF] bg-white text-[#6B6B6B] hover:bg-[#F5F1E8]"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-[#9A9A9A]">Audio fayl mavjud emas.</div>
          )}

          {audioError || audioResumeError ? (
            <div className="mt-3 text-xs text-[#C97B63]">
              {audioError ?? audioResumeError}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default BookAudioPage;
