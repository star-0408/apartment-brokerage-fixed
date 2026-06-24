import axios from "axios";
import { store } from "../store/store";

const DATA_SERVICE = import.meta.env.VITE_BACKEND_URL || "https://apartment-brokerage-wkfs.onrender.com";

const axiosInstance = axios.create({
  baseURL: `${DATA_SERVICE}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// ---- Request interceptor: מוסיף Access Token לכל בקשה ----
axiosInstance.interceptors.request.use((config) => {
  const token = store.getState().auth.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Response interceptor: טיפול ב-401 + Refresh Token ----
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // אם לא 401 — לא רלוונטי
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // אם כבר מרענן — מוסיף לתור
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axiosInstance(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // קריאה לשרת לחידוש ה-token
      const response = await axios.post(
        `${DATA_SERVICE}/api/auth/refresh-token`,
        {},
        { withCredentials: true } // ה-refresh token בא מ-HttpOnly cookie
      );

      const newToken: string = response.data.token;

      // עדכון ב-store
      store.dispatch({ type: "auth/setToken", payload: newToken });

      // עדכון ה-header ב-axios
      axiosInstance.defaults.headers.common.Authorization = `Bearer ${newToken}`;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;

      processQueue(null, newToken);
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Refresh נכשל — logout
      store.dispatch({ type: "auth/logout" });
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default axiosInstance;
