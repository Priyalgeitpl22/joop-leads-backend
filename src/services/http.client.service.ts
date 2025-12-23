import axios from "axios";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000/api";

export const httpClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      "HTTP Client error";
    return Promise.reject(new Error(message));
  }
);
