import { yupResolver } from "@hookform/resolvers/yup";
import { Eye, EyeOff, KeyRound, Loader2, Lock } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import * as yup from "yup";
import { useAuth } from "../../context/useAuth";

const schema = yup.object({
  token: yup.string().required("Token kiritilishi shart"),
  currentPassword: yup
    .string()
    .required("Joriy parol kiritilishi shart"),
  newPassword: yup
    .string()
    .min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak")
    .required("Yangi parol kiritilishi shart"),
  confirmPassword: yup
    .string()
    .required("Parolni qayta kiriting")
    .oneOf([yup.ref("newPassword")], "Parollar mos emas"),
});

type ResetPasswordForm = {
  token: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const ResetPasswordPage: React.FC = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const defaultToken = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: yupResolver(schema),
    defaultValues: {
      token: defaultToken,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: ResetPasswordForm) => {
    setIsLoading(true);
    try {
      const payload = {
        token: values.token.trim(),
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      };
      const message = await resetPassword(payload);
      toast.success(message);
      navigate("/login", { replace: true });
    } catch (error: any) {
      const backendMessage =
        typeof error?.response?.data === "string"
          ? error.response.data
          : error?.response?.data?.message;
      toast.error(backendMessage || "Parolni tiklashda xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#2B2B2B]">Yangi parol o'rnatish</h2>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          Emailga kelgan token va yangi parolni kiriting
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[#6B6B6B]">Token</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-2.5 text-[#9A9A9A]" size={18} />
            <input
              {...register("token")}
              type="text"
              placeholder="Reset token"
              className={`input-field pl-10 ${errors.token ? "border-red-500/50" : ""}`}
            />
          </div>
          {errors.token ? (
            <p className="mt-1 text-xs text-red-400">{errors.token.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#6B6B6B]">Joriy parol</label>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 text-[#9A9A9A]" size={18} />
            <input
              {...register("currentPassword")}
              type={showCurrentPassword ? "text" : "password"}
              placeholder="Joriy parol"
              className={`input-field pl-10 pr-10 ${errors.currentPassword ? "border-red-500/50" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              className="absolute right-3 top-2.5 text-[#9A9A9A]"
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.currentPassword ? (
            <p className="mt-1 text-xs text-red-400">{errors.currentPassword.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#6B6B6B]">Yangi parol</label>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 text-[#9A9A9A]" size={18} />
            <input
              {...register("newPassword")}
              type={showNewPassword ? "text" : "password"}
              placeholder="Yangi parol"
              className={`input-field pl-10 pr-10 ${errors.newPassword ? "border-red-500/50" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="absolute right-3 top-2.5 text-[#9A9A9A]"
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.newPassword ? (
            <p className="mt-1 text-xs text-red-400">{errors.newPassword.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#6B6B6B]">
            Yangi parolni qayta kiriting
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 text-[#9A9A9A]" size={18} />
            <input
              {...register("confirmPassword")}
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Parolni qayta kiriting"
              className={`input-field pl-10 pr-10 ${errors.confirmPassword ? "border-red-500/50" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-2.5 text-[#9A9A9A]"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirmPassword ? (
            <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary flex w-full items-center justify-center gap-2"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Parolni yangilash"}
        </button>
      </form>

      <div className="text-center text-sm text-[#6B6B6B]">
        <Link to="/login" className="font-medium text-[#6B4F3A] hover:underline">
          Kirish sahifasiga qaytish
        </Link>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
