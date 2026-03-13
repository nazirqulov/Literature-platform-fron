export interface User {
    id: number;
    username: string;
    email: string;
    fullName: string;
    phone: string;
    profileImage: string;
    role: string;
    isActive: boolean;
    emailVerified: boolean;
    createdAt: string;
}

// Explicit alias for clarity when dealing with backend responses.
export type UserResponse = User;

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user?: User;
}

export interface LoginResponse {
    tokenType?: string;
    accessToken: string;
    refreshToken: string;
    authorities?: string[];
    username?: string;
    expires_in?: number;
    user?: User;
}

export interface UpdateProfileRequest {
    username: string;
    email: string;
    fullName: string;
    phone: string;
}

export interface RegisterRequest {
    username: string;
    email: string;
    password?: string;
}

export interface VerifyEmailRequest {
    email: string;
    code: string;
}

export interface LoginRequest {
    usernameOrEmail: string;
    password: string;
    recaptchaToken?: string;
    recaptchToken?: string;
}

export type BookStatus = "reading" | "completed" | "favorite";

export interface ReadingListItem {
    id: number;
    title: string;
    author: string;
    status: BookStatus;
    progress: number; // 0-100
    isFavorite?: boolean;
}


