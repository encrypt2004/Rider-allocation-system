import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));
app.use(express.json());

// A simple route to check whether the backend is running.
app.get("/api/health", (req, res) => {
  res.json({ message: "Rider Allocation API is running" });
});

app.use("/api/auth", authRoutes);

export default app;
