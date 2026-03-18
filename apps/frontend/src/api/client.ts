import axios from "axios";
import { message } from "antd";
import { useAppStore } from "@/store/useAppStore";

const apiClient = axios.create({
  baseURL: "/api/v1",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = useAppStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

apiClient.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res && typeof res === "object" && "code" in res) {
      if (res.code === 200 || res.code === 0) {
        return res.data;
      }
      message.error(res.message || "请求失败");
      const error = new Error(res.message || "请求失败") as Error & { code?: number; response?: any };
      error.code = res.code;
      error.response = res;
      return Promise.reject(error);
    }
    return res;
  },
  (error) => {
    const msg = error.response?.data?.message || error.message || "网络错误";
    message.error(msg);

    if (error.response?.status === 401) {
      useAppStore.getState().logout();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
