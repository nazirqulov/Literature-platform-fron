import React, { useEffect, useMemo, useState } from 'react';
import type { User } from '../../types';
import { Calendar, ShieldCheck, Mail, Clock } from 'lucide-react';
import { normalizeRole } from '../../shared/utils/roleUtils';
import api from '../../services/api';

interface ProfileInfoProps {
    user: User;
}

const parseReadingTimeMinutes = (data: unknown): number => {
    if (typeof data === 'number' && Number.isFinite(data)) return data;
    if (typeof data === 'string') {
        const match = data.trim().match(/^(\d+(?:[.,]\d+)?)/);
        if (match) {
            const parsed = Number(match[1].replace(',', '.'));
            return Number.isFinite(parsed) ? parsed : 0;
        }
    }
    return 0;
};

const formatReadingTime = (minutes: number): { value: string; unit: string } => {
    if (!Number.isFinite(minutes) || minutes < 0) return { value: '0', unit: 'min' };
    if (minutes < 60) {
        return {
            value: minutes % 1 === 0 ? minutes.toString() : minutes.toFixed(1),
            unit: 'min',
        };
    }

    const hours = minutes / 60;
    return {
        value: hours % 1 === 0 ? hours.toString() : hours.toFixed(1),
        unit: 'soat',
    };
};

const ProfileInfo: React.FC<ProfileInfoProps> = ({ user }) => {
    const showReadingTime = normalizeRole(user.role) === 'USER';
    const [readingTimeMinutes, setReadingTimeMinutes] = useState<number | null>(null);
    const [isReadingTimeLoading, setIsReadingTimeLoading] = useState(false);
    const [readingTimeError, setReadingTimeError] = useState<string | null>(null);

    useEffect(() => {
        if (!showReadingTime) {
            setReadingTimeMinutes(null);
            setReadingTimeError(null);
            setIsReadingTimeLoading(false);
            return;
        }

        let isActive = true;
        const fetchReadingTime = async () => {
            setIsReadingTimeLoading(true);
            setReadingTimeError(null);
            try {
                const { data } = await api.get<number | string>('/api/me/books/full-mutoala-vaqti');
                if (!isActive) return;
                setReadingTimeMinutes(parseReadingTimeMinutes(data));
            } catch {
                if (!isActive) return;
                setReadingTimeMinutes(null);
                setReadingTimeError('Yuklanmadi');
            } finally {
                if (isActive) setIsReadingTimeLoading(false);
            }
        };

        void fetchReadingTime();

        return () => {
            isActive = false;
        };
    }, [showReadingTime]);

    const readingTime = useMemo(
        () =>
            typeof readingTimeMinutes === 'number'
                ? formatReadingTime(readingTimeMinutes)
                : null,
        [readingTimeMinutes],
    );

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('uz-UZ', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div
            className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
                showReadingTime ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
            }`}
        >
            <div className="glass p-4 rounded-2xl flex items-center gap-4">
                <div className="p-3 bg-[#6B4F3A]/15 rounded-xl">
                    <Calendar className="text-[#6B4F3A]" size={24} />
                </div>
                <div>
                    <p className="text-xs text-[#9A9A9A] uppercase font-bold tracking-wider">A'zo bo'ldi</p>
                    <p className="text-[#2B2B2B] font-medium">{formatDate(user.createdAt)}</p>
                </div>
            </div>

            <div className="glass p-4 rounded-2xl flex items-center gap-4">
                <div className="p-3 bg-[#8FA68E]/20 rounded-xl">
                    <ShieldCheck className="text-[#8FA68E]" size={24} />
                </div>
                <div>
                    <p className="text-xs text-[#9A9A9A] uppercase font-bold tracking-wider">Maqom</p>
                    <p className="text-[#2B2B2B] font-medium">{user.role}</p>
                </div>
            </div>

            <div className="glass p-4 rounded-2xl flex items-center gap-4">
                <div className="p-3 bg-[#C97B63]/15 rounded-xl">
                    <Mail className="text-[#C97B63]" size={24} />
                </div>
                <div>
                    <p className="text-xs text-[#9A9A9A] uppercase font-bold tracking-wider">Email holati</p>
                    <p className="text-[#2B2B2B] font-medium">{user.emailVerified ? 'Tasdiqlangan' : 'Tasdiqlanmagan'}</p>
                </div>
            </div>

            {showReadingTime ? (
                <div className="glass p-4 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-xl">
                        <Clock className="text-purple-500" size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-[#9A9A9A] uppercase font-bold tracking-wider">Mutolaa vaqti</p>
                        <p className="text-[#2B2B2B] font-medium">
                            {isReadingTimeLoading
                                ? '...'
                                : readingTime
                                  ? `${readingTime.value} ${readingTime.unit}`
                                  : '--'}
                        </p>
                        {readingTimeError ? (
                            <p className="text-xs font-medium text-[#C97B63]">{readingTimeError}</p>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default ProfileInfo;



