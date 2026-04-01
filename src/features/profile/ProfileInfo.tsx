import React from 'react';
import type { User } from '../../types';
import { Calendar, ShieldCheck, Mail, Clock } from 'lucide-react';
import { normalizeRole } from '../../shared/utils/roleUtils';

interface ProfileInfoProps {
    user: User;
}

const ProfileInfo: React.FC<ProfileInfoProps> = ({ user }) => {
    const showReadingTime = normalizeRole(user.role) === 'USER';
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
                        <p className="text-[#2B2B2B] font-medium">8.5 soat</p>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default ProfileInfo;



