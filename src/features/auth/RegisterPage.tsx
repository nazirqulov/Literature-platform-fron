import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { toast } from 'react-toastify';
import { User, Mail, Lock, Loader2 } from 'lucide-react';
import {
    getRecaptchaToken,
    initializeRecaptcha,
    isRecaptchaConfigured,
} from '../../services/recaptcha';
import type { RegisterRequest } from '../../types';

const schema = yup.object().shape({
    username: yup.string().required('Username kiritilishi shart').min(3, 'Kamida 3 ta belgi bo\'lishi kerak').max(50),
    email: yup.string().email('Noto\'g\'ri email format').required('Email kiritilishi shart'),
    password: yup.string().required('Parol kiritilishi shart').min(6, 'Kamida 6 ta belgi bo\'lishi kerak'),
    confirmPassword: yup.string().oneOf([yup.ref('password')], 'Parollar mos kelmadi').required('Parolni tasdiqlang'),
});

type RegisterFormData = {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
};

const resolveRegisterErrorMessage = (error: any): string => {
    const status = error?.response?.status as number | undefined;
    const data = error?.response?.data;
    const rawMessage =
        typeof data === 'string'
            ? data
            : typeof data?.message === 'string'
                ? data.message
                : '';
    const message = rawMessage.trim();
    const lower = message.toLowerCase();
    const looksTechnical =
        lower.includes('exception') ||
        lower.includes('stack') ||
        lower.includes('java.') ||
        lower.includes('no value present') ||
        lower.includes('ichki server xatosi');

    if (status === 400 || status === 409) {
        return message || "Bu username yoki email allaqachon ro'yxatdan o'tgan.";
    }

    if (status === 403) {
        if (lower.includes('bot')) {
            return "Xavfsizlik tekshiruvi muvaffaqiyatsiz. Qayta urinib ko'ring.";
        }
        return "Ro'yxatdan o'tishga ruxsat berilmadi.";
    }

    if (status === 429) {
        return "Juda ko'p urinish bo'ldi. Birozdan keyin qayta urinib ko'ring.";
    }

    if ((typeof status === 'number' && status >= 500) || looksTechnical) {
        return "Serverda vaqtinchalik xatolik. Iltimos keyinroq urinib ko'ring.";
    }

    if (message.length > 0) {
        return message;
    }

    return "Ro'yxatdan o'tishda xatolik yuz berdi.";
};

const RegisterPage: React.FC = () => {
    const { register: registerUser } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [isRecaptchaReady, setIsRecaptchaReady] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
        resolver: yupResolver(schema),
    });

    useEffect(() => {
        document.body.classList.add('recaptcha-auth-page');
        return () => {
            document.body.classList.remove('recaptcha-auth-page');
        };
    }, []);

    useEffect(() => {
        if (!isRecaptchaConfigured()) return;
        let cancelled = false;

        const prepareRecaptcha = async () => {
            try {
                await initializeRecaptcha();
                if (!cancelled) {
                    setIsRecaptchaReady(true);
                }
            } catch {
                if (!cancelled) {
                    setIsRecaptchaReady(false);
                }
            }
        };

        void prepareRecaptcha();

        return () => {
            cancelled = true;
        };
    }, []);

    const onSubmit = async (data: RegisterFormData) => {
        setIsLoading(true);
        try {
            if (!isRecaptchaConfigured()) {
                throw new Error("reCAPTCHA sozlanmagan. `VITE_RECAPTCHA_SITE_KEY` ni tekshiring.");
            }

            const token = await getRecaptchaToken('register');
            const payload: RegisterRequest = {
                username: data.username,
                email: data.email,
                password: data.password,
                recaptchaToken: token,
            };

            await registerUser(payload);
            toast.success('Ro\'yxatdan o\'tdingiz! Emailingizni tasdiqlang.');
            navigate(`/verify-email?email=${encodeURIComponent(data.email)}`);
        } catch (error: any) {
            toast.error(resolveRegisterErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-[#2B2B2B]">Ro'yxatdan o'tish</h2>
                <p className="text-[#6B6B6B] mt-2 text-sm italic">O'zbek adabiyoti olamiga xush kelibsiz</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-[#6B6B6B] mb-1">Foydalanuvchi nomi</label>
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 text-[#9A9A9A]" size={18} />
                        <input
                            {...register('username')}
                            type="text"
                            placeholder="username"
                            className={`input-field pl-10 ${errors.username ? 'border-red-500/50' : ''}`}
                        />
                    </div>
                    {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-[#6B6B6B] mb-1">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-2.5 text-[#9A9A9A]" size={18} />
                        <input
                            {...register('email')}
                            type="email"
                            placeholder="example@mail.com"
                            className={`input-field pl-10 ${errors.email ? 'border-red-500/50' : ''}`}
                        />
                    </div>
                    {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-[#6B6B6B] mb-1">Parol</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-2.5 text-[#9A9A9A]" size={18} />
                        <input
                            {...register('password')}
                            type="password"
                            placeholder="••••••••"
                            className={`input-field pl-10 ${errors.password ? 'border-red-500/50' : ''}`}
                        />
                    </div>
                    {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-[#6B6B6B] mb-1">Parolni tasdiqlash</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-2.5 text-[#9A9A9A]" size={18} />
                        <input
                            {...register('confirmPassword')}
                            type="password"
                            placeholder="••••••••"
                            className={`input-field pl-10 ${errors.confirmPassword ? 'border-red-500/50' : ''}`}
                        />
                    </div>
                    {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
                </div>

                <button
                    type="submit"
                    disabled={isLoading || (isRecaptchaConfigured() && !isRecaptchaReady)}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Davom etish'}
                </button>
                {isRecaptchaConfigured() && !isRecaptchaReady ? (
                    <p className="text-xs text-[#9A9A9A]">
                        Xavfsizlik tekshiruvi yuklanmoqda...
                    </p>
                ) : null}
            </form>

            <div className="text-center mt-4">
                <p className="text-sm text-[#6B6B6B]">
                    Hisobingiz bormi?{' '}
                    <Link to="/login" className="text-[#6B4F3A] hover:text-[#5A4030] font-medium">
                        Kirish
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default RegisterPage;



