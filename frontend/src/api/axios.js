import axios from 'axios';

/**
 * MAGEED GROUP — Axios API Client
 * 
 * Uses VITE_API_URL in production (direct backend URL)
 * Falls back to '/api' in development (Vite proxy handles it)
 */

const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // 30 second timeout
});

// ── Request interceptor: attach auth token ──
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle auth errors ──
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 — token expired or invalid
    if (error.response?.status === 401) {
      // Clear stored auth
      localStorage.removeItem('token');
      localStorage.removeItem('admin');

      // Redirect to login if on admin pages
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/login';
      }
    }

    // Handle network errors
    if (!error.response) {
      error.message = 'خطأ في الاتصال بالخادم — تحقق من اتصال الإنترنت';
    }

    return Promise.reject(error);
  }
);

export default api;
