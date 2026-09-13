import axios from "axios";

const api = axios.create({
  baseURL: "https://it-service-2rke.onrender.com/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;