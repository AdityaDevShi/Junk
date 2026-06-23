import "dotenv/config";
import express from "express";
import cors from "cors";
import { initFirebase } from "./config/firebase.js";
import healthRouter from "./routes/health.js";
import issuesRouter from "./routes/issues.js";

const app = express();

const origins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : "*";

app.use(cors({ origin: origins }));
app.use(express.json({ limit: "12mb" })); // base64 images can be large

// Initialize Firebase Admin (warns and no-ops if credentials are missing)
initFirebase();

app.get("/", (req, res) =>
  res.json({ service: "Community Hero API", health: "/api/v1/health" })
);
app.use("/api/v1/health", healthRouter);
app.use("/api/v1/issues", issuesRouter);

// 404
app.use((req, res) => res.status(404).json({ error: "not_found", path: req.path }));

// centralized error handler
app.use((err, req, res, _next) => {
  console.error("[error]", err);
  res.status(err.status || 500).json({ error: err.message || "internal_error" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`[server] Community Hero API listening on http://localhost:${PORT}`)
);
