import axios from "axios";

const api = axios.create({
  baseURL: "https://it-service-pink.vercel.app/login",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;