import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('invoicepro_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Request failed';
    const wrapped = new Error(message);
    wrapped.status = error.response?.status;
    wrapped.code = error.response?.data?.code;
    wrapped.data = error.response?.data;
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      const isAuthRoute = ['/login', '/signup', '/forgot-password', '/reset-password'].some((p) =>
        window.location.pathname.startsWith(p)
      );
      if (!isAuthRoute && window.location.pathname.startsWith('/app')) {
        localStorage.removeItem('invoicepro_token');
      }
    }
    return Promise.reject(wrapped);
  }
);

export default api;
