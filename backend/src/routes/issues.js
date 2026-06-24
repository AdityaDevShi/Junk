import { Router } from "express";
import { classifyIssue, draftComplaint } from "../services/geminiService.js";
import {
  createIssue,
  listIssues,
  getIssue,
  updateIssueStatus,
  resolveIssue,
  reopenIssue,
  setComplaintDraft,
  findOpenDuplicate,
  corroborateIssue,
} from "../services/issuesService.js";

const router = Router();

// GET /api/v1/issues
router.get("/", async (req, res, next) => {
  try {
    const issues = await listIssues({ limit: Number(req.query.limit) || 200 });
    res.json({ issues });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/issues/:id
router.get("/:id", async (req, res, next) => {
  try {
    const issue = await getIssue(req.params.id);
    if (!issue) return res.status(404).json({ error: "not_found" });
    res.json(issue);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/issues  { imageBase64, mimeType, note, location, reporterId, reporterName }
router.post("/", async (req, res, next) => {
  try {
    const {
      imageBase64,
      mimeType = "image/jpeg",
      note = "",
      location,
      reporterId,
      reporterName,
    } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: "imageBase64 is required" });

    // 1) AI triage (category + severity + description) from the photo.
    const classified = await classifyIssue({ imageBase64, mimeType, note });
    if (classified.isCivicIssue === false) {
      return res.status(422).json({ error: "not_a_civic_issue", classification: classified });
    }

    // 2) Agentic dedup: merge into an existing nearby open issue of the same category.
    const dup = await findOpenDuplicate({ category: classified.category, location });
    if (dup) {
      const already =
        dup.reporterId === reporterId || (dup.corroborators || []).includes(reporterId);
      if (already) {
        // Same user re-reporting the same open issue — don't inflate the count.
        return res.json({ ...dup, merged: true, alreadyReported: true });
      }
      const updated = await corroborateIssue(dup.id, reporterId);
      return res.json({ ...updated, merged: true });
    }

    // 3) Otherwise create a fresh ticket.
    const issue = await createIssue({
      title: classified.title,
      description: classified.description,
      category: classified.category,
      severity: classified.severity,
      confidence: classified.confidence,
      imageData: `data:${mimeType};base64,${imageBase64}`,
      location,
      reporterId,
      reporterName,
    });
    res.status(201).json({ ...issue, merged: false });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/issues/:id/status  { status, by }
router.patch("/:id/status", async (req, res, next) => {
  try {
    const { status, by } = req.body || {};
    const allowed = ["reported", "acknowledged", "in_progress", "resolved", "reopened"];
    if (!allowed.includes(status)) return res.status(400).json({ error: "invalid_status" });
    const issue = await updateIssueStatus(req.params.id, status, { by });
    res.json(issue);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/issues/:id/resolve  { afterImageBase64, mimeType, resolvedBy }
router.post("/:id/resolve", async (req, res, next) => {
  try {
    const { afterImageBase64, mimeType = "image/jpeg", resolvedBy } = req.body || {};
    const afterImageData = afterImageBase64
      ? `data:${mimeType};base64,${afterImageBase64}`
      : null;
    const issue = await resolveIssue(req.params.id, { afterImageData, resolvedBy });
    res.json(issue);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/issues/:id/reopen  { reason }
router.post("/:id/reopen", async (req, res, next) => {
  try {
    const issue = await reopenIssue(req.params.id, { reason: req.body?.reason });
    res.json(issue);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/issues/:id/complaint  -> generate & store a formal complaint draft
router.post("/:id/complaint", async (req, res, next) => {
  try {
    const issue = await getIssue(req.params.id);
    if (!issue) return res.status(404).json({ error: "not_found" });
    const complaintDraft = await draftComplaint(issue);
    const updated = await setComplaintDraft(req.params.id, complaintDraft);
    res.json({ complaintDraft, issue: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
