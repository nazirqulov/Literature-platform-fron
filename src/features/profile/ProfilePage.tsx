import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import ProfileInfo from './ProfileInfo';
import ProfileForm from './ProfileForm';
import ProfileImageHandler from './ProfileImageHandler';
import FavoriteBooksPreview from './FavoriteBooksPreview';
import CompletedBooksPreview from './CompletedBooksPreview';
import ReadingBooksPreview from './ReadingBooksPreview';
import { Loader2, Settings, List, BookOpen, CheckCircle2, Heart, ChevronDown } from 'lucide-react';

const ProfilePage: React.FC = () => {
    const { user, refreshUser, refreshProfileImageUrl, isLoading } = useAuth();
    const navigate = useNavigate();
    type ReadingSectionId = 'reading' | 'completed' | 'favorites';
    const [openSection, setOpenSection] = useState<ReadingSectionId | null>('reading');

    useEffect(() => {
        void Promise.all([refreshUser(), refreshProfileImageUrl()]);
        // Context funksiyalari har renderda yangilangani uchun dependency qo'shilsa request loop yuz beradi.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (isLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F5F1E8]">
                <Loader2 className="animate-spin text-[#6B4F3A]" size={48} />
            </div>
        );
    }

    const isSuperAdmin = user.role === 'SUPERADMIN' || user.role === 'ROLE_SUPERADMIN';
    const sections = [
        {
            id: 'reading' as const,
            title: "Hozir o'qilmoqda",
            subtitle: "So'nggi 2 ta o'qilayotgan kitob",
            href: '/profile/reading',
            icon: BookOpen,
            content: <ReadingBooksPreview showHeader={false} />
        },
        {
            id: 'completed' as const,
            title: "O'qib bo'lingan",
            subtitle: "Yakunlangan kitoblar ro'yxati",
            href: '/profile/completed',
            icon: CheckCircle2,
            content: <CompletedBooksPreview showHeader={false} />
        },
        {
            id: 'favorites' as const,
            title: 'Saralangan',
            subtitle: "Tanlangan kitoblar to'plami",
            href: '/profile/favorites',
            icon: Heart,
            content: <FavoriteBooksPreview showHeader={false} />
        }
    ];

    const handleToggle = (sectionId: ReadingSectionId) => {
        setOpenSection((prev) => (prev === sectionId ? null : sectionId));
    };

    const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, sectionId: ReadingSectionId) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleToggle(sectionId);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-12 space-y-12 animate-fade-in">
            {/* Header & Stats */}
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row gap-8 items-center bg-white p-8 rounded-3xl border border-[#E3DBCF] glass-dark">
                    <ProfileImageHandler />

                    <div className="flex-grow text-center md:text-left space-y-4">
                        <div>
                            <h1 className="text-2xl font-bold uppercase tracking-tight text-[#2B2B2B] sm:text-3xl">
                                {user.fullName || user.username}
                            </h1>
                            <p className="text-[#6B6B6B] font-mono text-sm">{user.email}</p>
                        </div>

                        <div className="flex flex-wrap justify-center md:justify-start gap-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${user.isActive ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {user.isActive ? 'Faol' : 'Nofaol'}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-[#6B4F3A]/10 text-[#6B4F3A] border border-[#6B4F3A]/20">
                                {user.role}
                            </span>
                        </div>
                    </div>
                </div>

                <ProfileInfo user={user} />
            </div>

            <div className="grid lg:grid-cols-3 gap-12">
                {!isSuperAdmin && (
                    <div className="lg:col-span-2 space-y-10">
                        <div className="flex items-center gap-3 border-b border-[#E3DBCF] pb-4">
                            <List className="text-[#6B4F3A]" size={24} />
                            <h2 className="text-2xl font-bold text-[#2B2B2B]">Mutolaa ro'yxati</h2>
                        </div>

                        <div className="space-y-4">
                            {sections.map((section) => {
                                const isOpen = openSection === section.id;
                                const Icon = section.icon;
                                return (
                                    <div
                                        key={section.id}
                                        className="overflow-hidden rounded-3xl border border-[#E3DBCF] bg-white/90 shadow-[0_12px_30px_rgba(107,79,58,0.08)]"
                                    >
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            aria-expanded={isOpen}
                                            aria-controls={`accordion-${section.id}`}
                                            onClick={() => handleToggle(section.id)}
                                            onKeyDown={(event) => handleHeaderKeyDown(event, section.id)}
                                            className="group flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-[#F9F6F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6B4F3A]/30"
                                        >
                                            <div className="flex items-center gap-4">
                                                <span
                                                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-[#6B4F3A] transition ${isOpen ? 'border-[#6B4F3A]/30 bg-[#6B4F3A]/10' : 'border-[#E3DBCF] bg-[#F5F1E8]'}`}
                                                >
                                                    <Icon size={20} />
                                                </span>
                                                <div>
                                                    <div className="text-lg font-bold text-[#2B2B2B] uppercase tracking-wide">
                                                        {section.title}
                                                    </div>
                                                    <div className="text-xs text-[#6B6B6B]">{section.subtitle}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        navigate(section.href);
                                                    }}
                                                    onKeyDown={(event) => event.stopPropagation()}
                                                    className="text-xs font-semibold text-[#6B4F3A] transition hover:text-[#5A4030]"
                                                >
                                                    Barchasini ko'rish
                                                </button>
                                                <ChevronDown
                                                    size={20}
                                                    className={`text-[#6B6B6B] transition ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                                                />
                                            </div>
                                        </div>
                                        <div
                                            id={`accordion-${section.id}`}
                                            className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                                        >
                                            <div className="overflow-hidden">
                                                <div className="px-6 pb-6 pt-1">
                                                    {section.content}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className={`${isSuperAdmin ? 'lg:col-span-3' : ''} space-y-8`}>
                    <div className="flex items-center gap-3 border-b border-[#E3DBCF] pb-4">
                        <Settings className="text-[#6B4F3A]" size={24} />
                        <h2 className="text-2xl font-bold text-[#2B2B2B]">Profil sozlamalari</h2>
                    </div>
                    <div className="glass-dark p-8 rounded-3xl border border-[#E3DBCF]">
                        <ProfileForm initialData={{
                            fullName: user.fullName,
                            phone: user.phone,
                            username: user.username,
                            email: user.email
                        }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;



