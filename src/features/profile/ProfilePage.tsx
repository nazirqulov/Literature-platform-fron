import React, { useEffect } from 'react';
import { useAuth } from '../../context/useAuth';
import ProfileInfo from './ProfileInfo';
import ProfileForm from './ProfileForm';
import ProfileImageHandler from './ProfileImageHandler';
import BookList from './BookList';
import { Loader2, Settings, List } from 'lucide-react';

const ProfilePage: React.FC = () => {
    const { user, refreshUser, refreshProfileImageUrl, isLoading } = useAuth();

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

    const mockData = {
        read: [
            { title: "O'tkan kunlar", author: "Abdulla Qodiriy" },
            { title: "Yulduzli tunlar", author: "Pirimqul Qodirov" },
        ],
        reading: [
            { title: "Kecha va Kunduz", author: "Cho'lpon" },
        ],
        favorites: [
            { title: "Dunyoning ishlari", author: "O'tkir Hoshimov" },
        ],
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

                        <div className="space-y-8">
                            <BookList title="Hozir o'qilmoqda" books={mockData.reading} />
                            <BookList title="O'qib bo'lingan" books={mockData.read} />
                            <BookList title="Saralangan" books={mockData.favorites} />
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



