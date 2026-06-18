// api/axiosInstance.js
// Axios instance với JWT interceptor & Tự động thử lại (Exponential Backoff)

import axios from 'axios';
import toast from 'react-hot-toast';
import axiosRetry from 'axios-retry'; // <-- Import thư viện ở đây

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000, 
  headers: { 'Content-Type': 'application/json' },
});

// ── Cấu hình Tự động thử lại (Exponential Backoff) ────────
const MAX_RETRIES = 3;

axiosRetry(axiosInstance, {
  retries: MAX_RETRIES, 
  retryCondition: (error) => {
    // Chỉ thử lại với lỗi mạng (không có response) hoặc lỗi server (5xx)
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status >= 500;
  },
  // Thời gian chờ: ~1s, 2s, 4s...
  retryDelay: (...arg) => axiosRetry.exponentialDelay(...arg, 1000),
  onRetry: (retryCount, error, requestConfig) => {
    console.warn(`[Cảnh báo mạng] Đang thử lại lần ${retryCount}/${MAX_RETRIES} tới ${requestConfig.url}...`);
  }
});

// ── Request Interceptor: gắn Bearer token ─────────────────
axiosInstance.interceptors.request.use(
  (config) => {
    try {
      const raw = localStorage.getItem('cdtn-auth');
      if (raw) {
        const { state } = JSON.parse(raw);
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
      }
    } catch (_) { }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response Interceptor: xử lý lỗi toàn cục ────────────
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    
    // Kiểm tra xem request này có đang được axios-retry ngầm thử lại hay không
    // Nếu đang trong quá trình thử lại (chưa đến lần cuối), ta chặn việc hiện Toast
    const config = error.config;
    const isRetryableError = !status || status >= 500;
    const currentRetryCount = config?.['axios-retry']?.retryCount || 0;
    const willRetry = isRetryableError && currentRetryCount < MAX_RETRIES;

    if (status === 401) {
      // Nếu đang ở trang login → không redirect, để lỗi truyền lên LoginPage.catch
      if (window.location.pathname === '/login') {
        return Promise.reject(error);
      }
      // Token hết hạn → xóa auth state và về trang login
      localStorage.removeItem('cdtn-auth');
      toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      window.location.href = '/login';
    } else if (status === 403) {
      toast.error('Bạn không có quyền thực hiện hành động này.');
    } else if (status === 404) {
      toast.error('Không tìm thấy dữ liệu yêu cầu.');
    } else if (status >= 500) {
      // CHỈ báo lỗi nếu đây là lần thử thất bại cuối cùng
      if (!willRetry) {
        toast.error('Lỗi máy chủ. Vui lòng thử lại sau.');
      }
    } else if (!error.response) {
      // CHỈ báo lỗi mạng nếu đây là lần thử thất bại cuối cùng
      if (!willRetry) {
        toast.error('Không thể kết nối đến máy chủ. Kiểm tra kết nối mạng.');
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;