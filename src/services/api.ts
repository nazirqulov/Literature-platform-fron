import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import type { AuthResponse } from "../types";

const API_URL = "http://localhost:8080";

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (error: AxiosError | unknown) => void;
}> = [];

const processQueue = (
  error: AxiosError | null,
  token: string | null = null,
) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

const clearStoredTokens = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
};

const isAuthEndpoint = (url?: string) => {
  if (!url) return false;

  return [
    "/api/login",
    "/api/register",
    "/api/verify-email",
    "/api/forgot-password",
    "/api/reset-password",
    "/api/refresh-token",
  ].some(
    (path) => url.includes(path),
  );
};

api.interceptors.request.use(
  (config) => {
    if (isAuthEndpoint(config.url)) {
      if (config.headers?.Authorization) {
        delete config.headers.Authorization;
      }
      return config;
    }

    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig | undefined;

    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (originalRequest._retry || isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (!originalRequest.headers) {
            originalRequest.headers = {} as InternalAxiosRequestConfig["headers"];
          }
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      clearStoredTokens();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    return new Promise((resolve, reject) => {
      axios
        .post(`${API_URL}/api/refresh-token`, { refreshToken })
        .then(({ data }) => {
          const authResponse = data as AuthResponse;
          localStorage.setItem("accessToken", authResponse.accessToken);
          localStorage.setItem("refreshToken", authResponse.refreshToken);

          api.defaults.headers.common.Authorization = `Bearer ${authResponse.accessToken}`;
          if (!originalRequest.headers) {
            originalRequest.headers = {} as InternalAxiosRequestConfig["headers"];
          }
          originalRequest.headers.Authorization = `Bearer ${authResponse.accessToken}`;

          processQueue(null, authResponse.accessToken);
          resolve(api(originalRequest));
        })
        .catch((err) => {
          processQueue(err, null);
          clearStoredTokens();
          window.location.href = "/login";
          reject(err);
        })
        .finally(() => {
          isRefreshing = false;
        });
    });
  },
);

export default api;


