import axios from "axios";

const api = axios.create({
  baseURL: "https://<your-render-backend-url>.onrender.com/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;