import axios from "axios";

const CHATBOT_URL = process.env.NEXT_PUBLIC_CHAT_URL || "http://localhost:1111/chatbot";

const chatbot = axios.create({
  baseURL: CHATBOT_URL,
  withCredentials: true,
});

chatbot.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("accessToken")
      : null;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default chatbot;