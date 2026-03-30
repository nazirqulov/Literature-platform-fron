import { yupResolver } from "@hookform/resolvers/yup";
import { Loader2, Mail } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import * as yup from "yup";
import { useAuth } from "../../context/useAuth";

const schema = yup.object({
  email: yup
    .string()
    .email("Email formati noto'g'ri")
    .required("Email kiritilishi shart"),
});

type ForgotPasswordForm = {
  email: string;
};

const ForgotPasswordPage: React.FC = () => {
  const { forgotPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ForgotPasswordForm>({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (values: ForgotPasswordForm) => {
    setIsLoading(true);
    try {
      const message = await forgotPassword({ email: values.email.trim() });
      toast.success(message);
      setSentEmail(values.email.trim());
      reset();
    } catch (error: any) {
      const backendMessage =
        typeof error?.response?.data === "string"
          ? error.response.data
          : error?.response?.data?.message;
      toast.error(
        backendMessage || "So'rov yuborishda xatolik yuz berdi. Qayta urinib ko'ring.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#2B2B2B]">Parolni tiklash</h2>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          Ro'yxatdan o'tgan emailingizni kiriting
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[#6B6B6B]">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 text-[#9A9A9A]" size={18} />
            <input
              {...register("email")}
              type="email"
              placeholder="example@mail.com"
              className={`input-field pl-10 ${errors.email ? "border-red-500/50" : ""}`}
            />
          </div>
          {errors.email ? (
            <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary flex w-full items-center justify-center gap-2"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Yuborish"}
        </button>
      </form>

      {sentEmail ? (
        <div className="rounded-xl border border-[#6B4F3A]/20 bg-[#6B4F3A]/5 p-3 text-sm text-[#6B6B6B]">
          <p className="font-medium text-[#2B2B2B]">Email yuborildi: {sentEmail}</p>
          <p className="mt-1">Tokenni olib, reset sahifada token + joriy parol + yangi parolni kiriting.</p>
          <Link
            to="/reset-password"
            className="mt-2 inline-flex rounded-lg border border-[#6B4F3A]/30 px-3 py-1.5 font-medium text-[#6B4F3A] hover:bg-[#6B4F3A]/10"
          >
            Parolni yangilash sahifasiga o'tish
          </Link>
        </div>
      ) : null}

      <div className="text-center text-sm text-[#6B6B6B]">
        <Link to="/login" className="font-medium text-[#6B4F3A] hover:underline">
          Kirish sahifasiga qaytish
        </Link>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
