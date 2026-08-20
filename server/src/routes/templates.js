// Templates REST —— 按 owner_id 隔离
import { Router } from "express";
import { getDb } from "../db.js";
import { authRequired } from "../auth.js";
import { rowToTemplate, templateToRow } from "../transform.js";

const router = Router();
router.use(authRequired);

function ownerOf(req) {
  return req.user.sub;
}

router.get("/", (req, res) => {
  const db = getDb();
  const custom = req.query.custom;
  let rows;
  if (custom === "0" || custom === "1") {
    rows = db
      .prepare(
        "SELECT * FROM templates WHERE owner_id = ? AND custom = ? ORDER BY title ASC",
      )
      .all(ownerOf(req), Number(custom));
  } else {
    rows = db
      .prepare(
        "SELECT * FROM templates WHERE owner_id = ? ORDER BY title ASC",
      )
      .all(ownerOf(req));
  }
  res.json({ items: rows.map(rowToTemplate) });
});

router.get("/:id", (req, res) => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM templates WHERE id = ? AND owner_id = ?")
    .get(req.params.id, ownerOf(req));
  if (!row) return res.status(404).json({ error: "not_found" });
  res.json(rowToTemplate(row));
});

router.post("/", (req, res) => {
  const db = getDb();
  const row = templateToRow(req.body);
  if (!row.id || !row.title || !row.database) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  db.prepare(
    `INSERT INTO templates (id, owner_id, title, database, custom, payload)
     VALUES (@id, @owner_id, @title, @database, @custom, @payload)`,
  ).run({ ...row, owner_id: ownerOf(req) });
  const created = db.prepare("SELECT * FROM templates WHERE id = ?").get(row.id);
  res.status(201).json(rowToTemplate(created));
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM templates WHERE id = ? AND owner_id = ?")
    .run(req.params.id, ownerOf(req));
  if (result.changes === 0) return res.status(404).json({ error: "not_found" });
  res.status(204).end();
});

export default router;
