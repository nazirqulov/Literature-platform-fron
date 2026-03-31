import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Award, BookOpen, Clock } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import api from "../../services/api";
import AuthorsSection from "../authors/AuthorsSection";
import NewBooksSection from "../books/NewBooksSection";
import SizUchunSection from "../books/SizUchunSection";
import TopKitoblarSection from "../books/TopKitoblarSection";
import BadgeChip from "../../shared/components/ui/BadgeChip";
import HeroSection from "../../shared/components/ui/HeroSection";
import StatCard from "../../shared/components/ui/StatCard";

const parseReadingTimeMinutes = (data: unknown): number => {
  if (typeof data === "number" && Number.isFinite(data)) return data;
  if (typeof data === "string") {
    const trimmed = data.trim();
    const match = trimmed.match(/^(\d+(?:[.,]\d+)?)/);
    if (match) {
      const parsed = Number(match[1].replace(",", "."));
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }
  return 0;
};

const formatReadingTime = (minutes: number): { value: string; unit: string } => {
  if (!Number.isFinite(minutes) || minutes < 0) return { value: "0", unit: "min" };
  if (minutes < 60) {
    return {
      value: minutes % 1 === 0 ? minutes.toString() : minutes.toFixed(1),
      unit: "min",
    };
  }
  const hours = minutes / 60;
  return {
    value: hours % 1 === 0 ? hours.toString() : hours.toFixed(1),
    unit: "soat",
  };
};

const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [completedCount, setCompletedCount] = useState<number | null>(null);
  const [isCompletedCountLoading, setIsCompletedCountLoading] = useState(false);
  const [completedCountError, setCompletedCountError] = useState<string | null>(null);

  const [readingTimeMinutes, setReadingTimeMinutes] = useState<number | null>(null);
  const [isReadingTimeLoading, setIsReadingTimeLoading] = useState(false);
  const [readingTimeError, setReadingTimeError] = useState<string | null>(null);

  const [readingTimeTotalMinutes, setReadingTimeTotalMinutes] = useState<number | null>(null);
  const [isReadingTimeTotalLoading, setIsReadingTimeTotalLoading] = useState(false);
  const [readingTimeTotalError, setReadingTimeTotalError] = useState<string | null>(null);

  const [readingTimeTodayMinutes, setReadingTimeTodayMinutes] = useState<number | null>(null);
  const [isReadingTimeTodayLoading, setIsReadingTimeTodayLoading] = useState(false);
  const [readingTimeTodayError, setReadingTimeTodayError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const fetchCompletedCount = async () => {
      setIsCompletedCountLoading(true);
      setCompletedCountError(null);
      try {
        const { data } = await api.get<number | string>("/api/me/books/completed-count");
        if (!isActive) return;
        if (typeof data === "number" && Number.isFinite(data)) {
          setCompletedCount(data);
        } else if (typeof data === "string") {
          const parsed = Number(data);
          setCompletedCount(Number.isFinite(parsed) ? parsed : 0);
        } else {
          setCompletedCount(0);
        }
      } catch {
        if (!isActive) return;
        setCompletedCountError("O'qilgan kitoblar sonini yuklashda xatolik.");
        setCompletedCount(null);
      } finally {
        if (isActive) setIsCompletedCountLoading(false);
      }
    };

    void fetchCompletedCount();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const fetchReadingTime = async () => {
      setIsReadingTimeLoading(true);
      setReadingTimeError(null);
      try {
        const { data } = await api.get<number | string>("/api/me/books/mutoala-vaqti");
        if (!isActive) return;
        setReadingTimeMinutes(parseReadingTimeMinutes(data));
      } catch {
        if (!isActive) return;
        setReadingTimeError("Mutolaa vaqtini yuklashda xatolik.");
        setReadingTimeMinutes(null);
      } finally {
        if (isActive) setIsReadingTimeLoading(false);
      }
    };
    void fetchReadingTime();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const fetchReadingTimeTotal = async () => {
      setIsReadingTimeTotalLoading(true);
      setReadingTimeTotalError(null);
      try {
        const { data } = await api.get<number | string>("/api/me/books/full-mutoala-vaqti");
        if (!isActive) return;
        setReadingTimeTotalMinutes(parseReadingTimeMinutes(data));
      } catch {
        if (!isActive) return;
        setReadingTimeTotalError("Umumiy mutolaa vaqtini yuklashda xatolik.");
        setReadingTimeTotalMinutes(null);
      } finally {
        if (isActive) setIsReadingTimeTotalLoading(false);
      }
    };
    void fetchReadingTimeTotal();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const fetchReadingTimeToday = async () => {
      setIsReadingTimeTodayLoading(true);
      setReadingTimeTodayError(null);
      try {
        const { data } = await api.get<number | string>("/api/me/books/mutoala-vaqti-today");
        if (!isActive) return;
        setReadingTimeTodayMinutes(parseReadingTimeMinutes(data));
      } catch {
        if (!isActive) return;
        setReadingTimeTodayError("Bugungi mutolaa vaqtini yuklashda xatolik.");
        setReadingTimeTodayMinutes(null);
      } finally {
        if (isActive) setIsReadingTimeTodayLoading(false);
      }
    };
    void fetchReadingTimeToday();
    return () => {
      isActive = false;
    };
  }, []);

  const completedCountDisplay = isCompletedCountLoading
    ? "..."
    : typeof completedCount === "number"
      ? completedCount.toString()
      : "--";

  const readingLast7 = useMemo(
    () => (typeof readingTimeMinutes === "number" ? formatReadingTime(readingTimeMinutes) : null),
    [readingTimeMinutes],
  );
  const readingTotal = useMemo(
    () =>
      typeof readingTimeTotalMinutes === "number"
        ? formatReadingTime(readingTimeTotalMinutes)
        : null,
    [readingTimeTotalMinutes],
  );
  const readingToday = useMemo(
    () =>
      typeof readingTimeTodayMinutes === "number"
        ? formatReadingTime(readingTimeTodayMinutes)
        : null,
    [readingTimeTodayMinutes],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:py-10">
      <HeroSection
        title={`Xush kelibsiz, ${(user?.username ?? "kitobxon").toUpperCase()}!`}
        subtitle="Bugungi o'qish jarayoningizni kuzating, tavsiyalarni ko'ring va mutolaa ritmingizni bir joydan boshqaring."
        chips={["Sizning mutolaa olamingiz"]}
        action={{
          label: "Profilni boshqarish",
          onClick: () => navigate("/profile"),
        }}
        sideContent={
          <div className="dashboard-card">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border"
                style={{
                  borderColor: "color-mix(in srgb, var(--c-accent) 32%, transparent)",
                  backgroundColor:
                    "color-mix(in srgb, var(--c-accent-soft) 56%, transparent)",
                  color: "var(--c-accent)",
                }}
              >
                <Award size={20} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--c-text-muted)]">
                  Daraja
                </p>
                <p className="text-lg font-semibold text-[color:var(--c-text-primary)]">
                  Kitobxon
                </p>
              </div>
            </div>
            <div className="mt-3">
              <BadgeChip variant="success">Faol o'quvchi</BadgeChip>
            </div>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label="Jami o'qilganlar"
          value={completedCountDisplay}
          helper="O'qilgan kitoblar"
          hint="Barcha vaqt"
          interactive
          onClick={() => navigate("/profile/completed")}
          error={completedCountError}
        />
        <StatCard
          icon={Clock}
          label="Umumiy mutolaa"
          value={isReadingTimeTotalLoading ? "..." : readingTotal?.value ?? "--"}
          unit={isReadingTimeTotalLoading ? undefined : readingTotal?.unit}
          helper="Barcha sessiyalar bo'yicha"
          hint="Jami"
          error={readingTimeTotalError}
        />
        <StatCard
          icon={Clock}
          label="Oxirgi 7 kun"
          value={isReadingTimeLoading ? "..." : readingLast7?.value ?? "--"}
          unit={isReadingTimeLoading ? undefined : readingLast7?.unit}
          helper="Haftalik mutolaa"
          hint="7 kun"
          error={readingTimeError}
        />
        <StatCard
          icon={Clock}
          label="Bugungi mutolaa"
          value={isReadingTimeTodayLoading ? "..." : readingToday?.value ?? "--"}
          unit={isReadingTimeTodayLoading ? undefined : readingToday?.unit}
          helper="Bugungi faoliyat"
          hint="Bugun"
          error={readingTimeTodayError}
        />
      </div>

      <div className="space-y-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[color:var(--c-text-primary)]">
              Yangi qo'shilganlar
            </h3>
            <Link to="/books" className="text-sm font-semibold text-[color:var(--c-accent)]">
              Barchasi
            </Link>
          </div>
          <NewBooksSection limit={6} layout="carousel" showHeader={false} />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[color:var(--c-text-primary)]">
              Siz uchun
            </h3>
            <Link
              to="/books/siz-uchun"
              className="text-sm font-semibold text-[color:var(--c-accent)]"
            >
              Barchasi
            </Link>
          </div>
          <SizUchunSection limit={6} layout="carousel" showHeader={false} />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[color:var(--c-text-primary)]">
              Eng ko'p o'qilganlar
            </h3>
            <Link
              to="/books/top-kitoblar"
              className="text-sm font-semibold text-[color:var(--c-accent)]"
            >
              Barchasi
            </Link>
          </div>
          <TopKitoblarSection limit={10} layout="carousel" showHeader={false} />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[color:var(--c-text-primary)]">
              Mualliflar
            </h3>
            <Link to="/authors" className="text-sm font-semibold text-[color:var(--c-accent)]">
              Barchasi
            </Link>
          </div>
          <AuthorsSection limit={8} layout="carousel" showHeader={false} />
        </section>
      </div>
    </div>
  );
};

export default UserDashboard;
