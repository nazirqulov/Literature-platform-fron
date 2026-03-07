import api from "../../services/api";

export interface AuthorResponse {
  id?: number;
  name?: string;
  biography?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  nationality?: string | null;
  profileImage?: string | null;
  booksCount?: number | null;
  createdAt?: string | null;
}

export const resolveProfileUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  const baseUrl = api.defaults.baseURL ?? "http://localhost:8080";
  return new URL(value.replace(/^\/+/, ""), `${baseUrl}/`).toString();
};

export const normalizeAuthors = (data: unknown): AuthorResponse[] => {
  if (Array.isArray(data)) return data as AuthorResponse[];
  if (!data || typeof data !== "object") return [];
  const typed = data as { content?: AuthorResponse[]; data?: unknown };
  if (Array.isArray(typed.content)) return typed.content;
  if (Array.isArray(typed.data)) return typed.data as AuthorResponse[];
  return [];
};

export const extractAuthorPayload = (data: unknown): AuthorResponse | null => {
  if (!data || typeof data !== "object") return null;
  const typed = data as Record<string, unknown>;
  const possible =
    (typed.author as AuthorResponse | undefined) ??
    (typed.data as AuthorResponse | undefined) ??
    (!Array.isArray(typed.content) ? (typed.content as AuthorResponse) : undefined) ??
    (data as AuthorResponse);
  if (!possible) return null;
  if (
    typeof possible === "object" &&
    (typeof possible.id === "number" || typeof possible.name === "string")
  ) {
    return possible;
  }
  return null;
};

export const getAuthorInitials = (name?: string | null) => {
  if (!name) return "M";
  const parts = name
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};
