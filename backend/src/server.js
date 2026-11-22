import dotenv from "dotenv";
dotenv.config();

import http from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";

const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);

// Socket.IO sends live updates only to the logged-in user's room.
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH"]
  },
  transports: ["websocket", "polling"]
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch {
    next(new Error("Invalid socket token"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.userId}`);
  console.log(`Socket connected for user ${socket.userId}`);
});

io.engine.on("connection_error", (error) => {
  console.error("Socket.IO connection error:", error.message);
});

app.set("io", io);

const startServer = async () => {
  await connectDB();
  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log("Socket.IO is ready for live updates");
  });
};

startServer();
