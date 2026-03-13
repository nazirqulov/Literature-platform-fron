import React, {
  createContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import api from "../services/api";
import { isSuperAdminRole, normalizeRole } from "../shared/utils/roleUtils";
import type {
  LoginResponse,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  User,
  VerifyEmailRequest,
} from "../types";

export interface AuthContextType {
  user: User | null;
  profileImageUrl: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<User>;
  register: (data: RegisterRequest) => Promise<void>;
  verifyEmail: (data: VerifyEmailRequest) => Promise<void>;
  logout: () => void;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  updateProfileImage: (file: File) => Promise<void>;
  refreshUser: () => Promise<User>;
  refreshProfileImageUrl: () => Promise<void>;
}

const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff&size=128";

interface ProfileImageMetaResponse {
  filename?: string | null;
  url?: string | null;
}

interface ResolvedImage {
  url: string | null;
  isObjectUrl: boolean;
}

const normalizeAssetUrl = (url: string) => {
  if (url.startsWith("http")) return url;
  const baseUrl = api.defaults.baseURL ?? "http://localhost:8080";
  return new URL(url, `${baseUrl}/`).toString();
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const profileObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    void checkAuth();
  }, []);

  useEffect(() => {
    return () => {
      if (profileObjectUrlRef.current) {
        URL.revokeObjectURL(profileObjectUrlRef.current);
        profileObjectUrlRef.current = null;
      }
    };
  }, []);

  const clearAuthState = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
    setProfileImageUrl(null);
    if (profileObjectUrlRef.current) {
      URL.revokeObjectURL(profileObjectUrlRef.current);
      profileObjectUrlRef.current = null;
    }
  };

  const checkAuth = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      await refreshUser();
    } catch {
      clearAuthState();
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async (): Promise<User> => {
    const { data } = await api.get<User>("/api/me");
    const normalizedRole = normalizeRole(data.role) ?? data.role;
    const normalizedUser = { ...data, role: normalizedRole ?? data.role };
    setUser(normalizedUser);
    return normalizedUser;
  };

  const resolveImageFromBlob = async (blob: Blob): Promise<ResolvedImage> => {
    if (blob.type.includes("application/json")) {
      const text = await blob.text();
      try {
        const parsed = JSON.parse(text) as { url?: string };
        if (parsed.url) {
          return { url: normalizeAssetUrl(parsed.url), isObjectUrl: false };
        }
      } catch {
        // Fallback to text parsing below.
      }
      const trimmed = text.trim();
      return {
        url: trimmed ? normalizeAssetUrl(trimmed) : null,
        isObjectUrl: false,
      };
    }

    if (blob.type.startsWith("text/")) {
      const text = (await blob.text()).trim();
      return { url: text ? normalizeAssetUrl(text) : null, isObjectUrl: false };
    }

    const objectUrl = URL.createObjectURL(blob);
    return { url: objectUrl, isObjectUrl: true };
  };

  const refreshProfileImageUrl = async () => {
    try {
      const { data } = await api.get<ProfileImageMetaResponse>(
        "/api/me/profile-image-url",
      );

      const filename = data?.filename ?? null;
      if (filename) {
        const response = await api.get<Blob>(
          `/api/profiles/${encodeURIComponent(filename)}`,
          { responseType: "blob" },
        );

        const resolved = await resolveImageFromBlob(response.data);
        if (profileObjectUrlRef.current) {
          URL.revokeObjectURL(profileObjectUrlRef.current);
          profileObjectUrlRef.current = null;
        }

        if (resolved.isObjectUrl) {
          profileObjectUrlRef.current = resolved.url;
        }

        setProfileImageUrl(resolved.url ?? DEFAULT_AVATAR);
        return;
      }

      if (data?.url) {
        if (profileObjectUrlRef.current) {
          URL.revokeObjectURL(profileObjectUrlRef.current);
          profileObjectUrlRef.current = null;
        }
        setProfileImageUrl(normalizeAssetUrl(data.url));
        return;
      }

      setProfileImageUrl(DEFAULT_AVATAR);
    } catch (error) {
      console.error("Failed to fetch profile image URL:", error);
      setProfileImageUrl(DEFAULT_AVATAR);
    }
  };

  const login = async (data: LoginRequest) => {
    const response = await api.post<LoginResponse>("/api/login", data);
    const {
      accessToken,
      refreshToken,
      user: loginUser,
      authorities,
      username,
    } = response.data;

    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);

    const derivedRole = authorities?.some((role) => isSuperAdminRole(role))
      ? "SUPERADMIN"
      : normalizeRole(authorities?.[0]) ?? "USER";

    const fallbackUser: User = loginUser ?? {
      id: 0,
      username: username ?? data.usernameOrEmail,
      email: "",
      fullName: "",
      phone: "",
      profileImage: "",
      role: derivedRole,
      isActive: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };

    setUser(fallbackUser);

    try {
      const freshUser = await refreshUser();
      return freshUser;
    } catch {
      setUser(fallbackUser);
      return fallbackUser;
    }
  };

  const register = async (data: RegisterRequest) => {
    await api.post("/api/register", data);
  };

  const verifyEmail = async (data: VerifyEmailRequest) => {
    await api.post("/api/verify-email", data);
  };

  const updateProfile = async (data: UpdateProfileRequest) => {
    const { data: updatedUser } = await api.put<User>("/api/update-profile", data);
    setUser(updatedUser);
  };

  const updateProfileImage = async (file: File) => {
    const formData = new FormData();
    formData.append("profileImage", file);
    await api.post("/api/me/profile-image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    await refreshProfileImageUrl();
    await refreshUser();
  };

  const logout = () => {
    clearAuthState();
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profileImageUrl,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        verifyEmail,
        logout,
        updateProfile,
        updateProfileImage,
        refreshUser,
        refreshProfileImageUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


