/* eslint-disable @typescript-eslint/no-explicit-any */
import { yupResolver } from "@hookform/resolvers/yup";
import { Loader2, Lock, User } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import * as yup from "yup";
import { useAuth } from "../../context/useAuth";
import {
  getRecaptchaToken,
  initializeRecaptcha,
  isRecaptchaConfigured,
} from "../../services/recaptcha";
import { isSuperAdminRole } from "../../shared/utils/roleUtils";
import type { LoginRequest } from "../../types";

const schema = yup.object().shape({
  usernameOrEmail: yup
    .string()
    .required("Username yoki Email kiritilishi shart"),
  password: yup.string().required("Parol kiritilishi shart"),
});

type LoginFormData = {
  usernameOrEmail: string;
  password: string;
};

const resolveLoginErrorMessage = (error: any): string => {
  const status = error?.response?.status as number | undefined;
  const data = error?.response?.data;
  const rawMessage =
    typeof data === "string"
      ? data
      : typeof data?.message === "string"
        ? data.message
        : "";
  const message = rawMessage.trim();
  const lower = message.toLowerCase();
  const looksTechnical =
    lower.includes("exception") ||
    lower.includes("stack") ||
    lower.includes("java.") ||
    lower.includes("no value present") ||
    lower.includes("ichki server xatosi");

  if (status === 401 || status === 400) {
    return "Login yoki parol noto'g'ri";
  }

  if (status === 403) {
    if (lower.includes("bot")) {
      return "Xavfsizlik tekshiruvi muvaffaqiyatsiz. Qayta urinib ko'ring.";
    }
    return "Kirishga ruxsat berilmadi.";
  }

  if (status === 429) {
    return "Juda ko'p urinish bo'ldi. Birozdan keyin qayta urinib ko'ring.";
  }

  if ((typeof status === "number" && status >= 500) || looksTechnical) {
    return "Serverda vaqtinchalik xatolik. Iltimos keyinroq urinib ko'ring.";
  }

  if (message.length > 0) {
    return message;
  }

  return "Login yoki parol noto'g'ri";
};

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isRecaptchaReady, setIsRecaptchaReady] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(schema),
  });

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

  useEffect(() => {
    document.body.classList.add("recaptcha-auth-page");
    return () => {
      document.body.classList.remove("recaptcha-auth-page");
    };
  }, []);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      if (!isRecaptchaConfigured()) {
        throw new Error("reCAPTCHA sozlanmagan. `VITE_RECAPTCHA_SITE_KEY` ni tekshiring.");
      }

      const token = await getRecaptchaToken("login");
      const payload: LoginRequest = {
        usernameOrEmail: data.usernameOrEmail,
        password: data.password,
        recaptchaToken: token,
        recaptchToken: token,
      };

      const loggedInUser = await login(payload);
      toast.success("Xush kelibsiz!");
      const role = loggedInUser.role;
      if (isSuperAdminRole(role)) {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error: any) {
      toast.error(resolveLoginErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#2B2B2B]">Kirish</h2>
        <p className="text-[#6B6B6B] mt-2 text-sm italic">
          O'zbek adabiyoti xazinasiga kirish
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#6B6B6B] mb-1">
            Foydalanuvchi nomi yoki Email
          </label>
          <div className="relative">
            <User
              className="absolute left-3 top-2.5 text-[#9A9A9A]"
              size={18}
            />
            <input
              {...register("usernameOrEmail")}
              type="text"
              placeholder="username yoki email"
              className={`input-field pl-10 ${errors.usernameOrEmail ? "border-red-500/50" : ""}`}
            />
          </div>
          {errors.usernameOrEmail && (
            <p className="text-red-400 text-xs mt-1">
              {errors.usernameOrEmail.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[#6B6B6B] mb-1">
            Parol
          </label>
          <div className="relative">
            <Lock
              className="absolute left-3 top-2.5 text-[#9A9A9A]"
              size={18}
            />
            <input
              {...register("password")}
              type="password"
              placeholder="••••••••"
              className={`input-field pl-10 ${errors.password ? "border-red-500/50" : ""}`}
            />
          </div>
          {errors.password && (
            <p className="text-red-400 text-xs mt-1">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-[#6B6B6B] hover:text-[#6B6B6B]">
            <input
              type="checkbox"
              className="w-4 h-4 rounded bg-white border-[#E3DBCF]"
            />
            Eslab qolish
          </label>
          <Link
            to="/forgot-password"
            className="text-[#6B4F3A] hover:underline"
          >
            Parolni unutdingizmi?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading || (isRecaptchaConfigured() && !isRecaptchaReady)}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            "Kirish"
          )}
        </button>
        {isRecaptchaConfigured() && !isRecaptchaReady ? (
          <p className="text-xs text-[#9A9A9A]">
            Xavfsizlik tekshiruvi yuklanmoqda...
          </p>
        ) : null}
      </form>

      <div className="text-center mt-4">
        <p className="text-sm text-[#6B6B6B]">
          Hisobingiz yo'qmi?{" "}
          <Link
            to="/register"
            className="text-[#6B4F3A] hover:text-[#5A4030] font-medium"
          >
            Ro'yxatdan o'tish
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;


