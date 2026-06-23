import { Router } from "express";
import { getDb } from "../config/firebase.js";
import { getGemini } from "../config/gemini.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "community-hero-api",
    firestore: !!getDb(),
    gemini: !!getGemini(),
    time: new Date().toISOString(),
  });
});

export default router;
