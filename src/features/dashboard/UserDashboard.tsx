import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import api from '../../services/api';
import { BookOpen, Clock, Award } from 'lucide-react';
import SizUchunSection from '../books/SizUchunSection';
import TopKitoblarSection from '../books/TopKitoblarSection';
import NewBooksSection from '../books/NewBooksSection';
import AuthorsSection from '../authors/AuthorsSection';

const parseReadingTimeMinutes = (data: unknown): number => {
    if (typeof data === 'number' && Number.isFinite(data)) {
        return data;
    }

    if (typeof data === 'string') {
        const trimmed = data.trim();
        const match = trimmed.match(/^(\d+(?:[.,]\d+)?)/);
        if (match) {
            const parsed = Number(match[1].replace(',', '.'));
            return Number.isFinite(parsed) ? parsed : 0;
        }
    }

    return 0;
};

const formatReadingTime = (minutes: number): { value: string; unit: string } => {
    const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
    if (safeMinutes < 60) {
        const value = safeMinutes % 1 === 0 ? safeMinutes.toString() : safeMinutes.toFixed(1);
        return { value, unit: 'min' };
    }

    const hours = safeMinutes / 60;
    const value = hours % 1 === 0 ? hours.toString() : hours.toFixed(1);
    return { value, unit: 'soat' };
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
    const [readingTimeTodayMinutes, setReadingTimeTodayMinutes] = useState<number | null>(null);
    const [isReadingTimeTodayLoading, setIsReadingTimeTodayLoading] = useState(false);
    const [readingTimeTodayError, setReadingTimeTodayError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;

        const fetchCompletedCount = async () => {
            setIsCompletedCountLoading(true);
            setCompletedCountError(null);
            try {
                const { data } = await api.get<number>('/api/me/books/completed-count');
                if (!isActive) return;

                if (typeof data === 'number' && Number.isFinite(data)) {
                    setCompletedCount(data);
                    return;
                }

                if (typeof data === 'string') {
                    const parsed = Number(data);
                    setCompletedCount(Number.isFinite(parsed) ? parsed : 0);
                    return;
                }

                setCompletedCount(0);
            } catch {
                if (!isActive) return;
                setCompletedCountError("O'qilgan kitoblar sonini yuklashda xatolik yuz berdi.");
                setCompletedCount(null);
            } finally {
                if (!isActive) return;
                setIsCompletedCountLoading(false);
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
                const { data } = await api.get<number | string>('/api/me/books/mutoala-vaqti');
                if (!isActive) return;
                setReadingTimeMinutes(parseReadingTimeMinutes(data));
            } catch {
                if (!isActive) return;
                setReadingTimeError("Mutolaa vaqtini yuklashda xatolik yuz berdi.");
                setReadingTimeMinutes(null);
            } finally {
                if (!isActive) return;
                setIsReadingTimeLoading(false);
            }
        };

        void fetchReadingTime();

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
                const { data } = await api.get<number | string>('/api/me/books/mutoala-vaqti-today');
                if (!isActive) return;
                setReadingTimeTodayMinutes(parseReadingTimeMinutes(data));
            } catch {
                if (!isActive) return;
                setReadingTimeTodayError("Bugungi mutolaa vaqtini yuklashda xatolik yuz berdi.");
                setReadingTimeTodayMinutes(null);
            } finally {
                if (!isActive) return;
                setIsReadingTimeTodayLoading(false);
            }
        };

        void fetchReadingTimeToday();

        return () => {
            isActive = false;
        };
    }, []);

    const completedCountDisplay = isCompletedCountLoading
        ? '...'
        : typeof completedCount === 'number'
            ? completedCount.toString()
            : '--';
    const readingTimeDisplay =
        typeof readingTimeMinutes === 'number' ? formatReadingTime(readingTimeMinutes) : null;
    const readingTimeDisplayValue = isReadingTimeLoading ? '...' : readingTimeDisplay?.value ?? '--';
    const readingTimeDisplayUnit = isReadingTimeLoading ? undefined : readingTimeDisplay?.unit;
    const readingTimeTodayDisplay =
        typeof readingTimeTodayMinutes === 'number'
            ? formatReadingTime(readingTimeTodayMinutes)
            : null;
    const readingTimeTodayDisplayValue = isReadingTimeTodayLoading
        ? '...'
        : readingTimeTodayDisplay?.value ?? '--';
    const readingTimeTodayDisplayUnit = isReadingTimeTodayLoading
        ? undefined
        : readingTimeTodayDisplay?.unit;

    return (
        <div className="max-w-7xl mx-auto px-4 py-12 space-y-10">
            <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold uppercase tracking-tight text-[#2B2B2B] sm:text-4xl">
                        Xush kelibsiz, <span className="text-[#6B4F3A]">{user?.username}</span>!
                    </h1>
                    <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-4">
                        <p className="text-[#6B6B6B] italic">Sizning mutolaa olamingiz</p>
                        <span className="hidden text-[#6B6B6B] sm:inline">|</span>
                        <Link to="/profile" className="text-[#6B4F3A]/80 hover:text-[#6B4F3A] font-medium transition-colors border-b border-[#6B4F3A]/30 w-fit">
                            Profilni boshqarish
                        </Link>
                    </div>
                </div>
                <div className="flex flex-wrap gap-4">
                    <div className="glass px-6 py-3 rounded-2xl flex items-center gap-3">
                        <div className="p-2 bg-[#6B4F3A]/15 rounded-lg">
                            <Award className="text-[#6B4F3A]" size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-[#9A9A9A] uppercase font-bold">Daraja</p>
                            <p className="text-[#2B2B2B] font-medium">Kitobxon</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate('/profile/completed')}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            navigate('/profile/completed');
                        }
                    }}
                    className="glass-dark p-6 rounded-3xl border-[#E3DBCF] space-y-4 transition hover:border-[#6B4F3A]/30 hover:shadow-[0_12px_24px_rgba(107,79,58,0.12)] cursor-pointer"
                >
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-[#8FA68E]/20 rounded-2xl">
                            <BookOpen className="text-[#8FA68E]" size={24} />
                        </div>
                        <span className="text-xs text-[#9A9A9A] font-medium">Jami</span>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[#2B2B2B]">{completedCountDisplay}</p>
                        <p className="text-sm text-[#6B6B6B]">O'qilgan kitoblar</p>
                        {completedCountError ? (
                            <p className="text-xs text-[#C97B63] mt-2">{completedCountError}</p>
                        ) : null}
                    </div>
                </div>

                <div className="glass-dark p-6 rounded-3xl border-[#E3DBCF] space-y-4 relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#C97B63]/10 blur-2xl" />
                    <div className="flex items-center justify-between relative">
                        <div className="p-3 bg-[#C97B63]/15 rounded-2xl">
                            <Clock className="text-[#C97B63]" size={24} />
                        </div>
                        <span className="text-xs text-[#9A9A9A] font-medium">Oxirgi 7 kun</span>
                    </div>
                    <div className="relative">
                        <div className="flex items-end gap-1">
                            <span
                                className={`text-3xl font-bold text-[#2B2B2B] sm:text-4xl ${isReadingTimeLoading ? 'animate-pulse' : ''}`}
                            >
                                {readingTimeDisplayValue}
                            </span>
                            {readingTimeDisplayUnit ? (
                                <span className="mb-1 text-sm font-semibold text-[#6B6B6B]">
                                    {readingTimeDisplayUnit}
                                </span>
                            ) : null}
                        </div>
                        <p className="text-sm text-[#6B6B6B]">Mutolaa vaqti</p>
                        {readingTimeError ? (
                            <p className="text-xs text-[#C97B63] mt-2">{readingTimeError}</p>
                        ) : null}
                    </div>
                </div>

                <div className="glass-dark p-6 rounded-3xl border-[#E3DBCF] space-y-4 relative overflow-hidden">
                    <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-[#8FA68E]/10 blur-2xl" />
                    <div className="flex items-center justify-between relative">
                        <div className="p-3 bg-[#8FA68E]/20 rounded-2xl">
                            <Clock className="text-[#8FA68E]" size={24} />
                        </div>
                        <span className="text-xs text-[#9A9A9A] font-medium">Bugun</span>
                    </div>
                    <div className="relative">
                        <div className="flex items-end gap-1">
                            <span
                                className={`text-3xl font-bold text-[#2B2B2B] sm:text-4xl ${isReadingTimeTodayLoading ? 'animate-pulse' : ''}`}
                            >
                                {readingTimeTodayDisplayValue}
                            </span>
                            {readingTimeTodayDisplayUnit ? (
                                <span className="mb-1 text-sm font-semibold text-[#6B6B6B]">
                                    {readingTimeTodayDisplayUnit}
                                </span>
                            ) : null}
                        </div>
                        <p className="text-sm text-[#6B6B6B]">Mutolaa vaqti</p>
                        {readingTimeTodayError ? (
                            <p className="text-xs text-[#C97B63] mt-2">{readingTimeTodayError}</p>
                        ) : null}
                    </div>
                </div>
            </div>

            <NewBooksSection limit={6} layout="carousel" showHeader showAllLink={false} />
            <SizUchunSection limit={6} layout="carousel" showHeader showAllLink />
            <TopKitoblarSection limit={10} layout="carousel" showHeader showAllLink />
            <AuthorsSection limit={8} layout="carousel" showHeader showAllLink />

            {/* Pastki bloklar vaqtincha olib tashlandi */}
        </div>
    );
};

export default UserDashboard;



