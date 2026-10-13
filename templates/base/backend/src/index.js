import "dotenv/config";
import express from "express";
import cors from "cors";
import itemsRouter from "./routes/items.js";
import { prisma } from "./prisma/client.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "backend",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/items", itemsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Error-handling middleware
app.use((err, _req, res, _next) => {
  console.error("[Backend Error]:", err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
  });
});

const server = app.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});

async function shutdown(signal) {
  console.log(`\nReceived ${signal}. Closing HTTP server and database connection...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      console.error("Error disconnecting Prisma:", err);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default app;

