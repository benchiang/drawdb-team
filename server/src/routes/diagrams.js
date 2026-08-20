// Diagrams REST —— owner + collaborator 都能访问
import { Router } from "express";
import { getDb, diagramAccessOf } from "../db.js";
import { authRequired } from "../auth.js";
import { rowToDiagram, diagramToRow } from "../transform.js";

const router = Router();
router.use(authRequired);

function ownerOf(req) {
  return req.user.sub;
}

router.get("/", (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT d.*, 'owner' AS access_role
         FROM diagrams d WHERE d.owner_id = ?
       UNION
       SELECT d.*, 'collab' AS access_role
         FROM diagrams d
         JOIN diagram_collaborators c ON c.diagram_id = d.id
        WHERE c.user_id = ?
       ORDER BY last_modified DESC`,
    )
    .all(ownerOf(req), ownerOf(req));
  res.json({
    items: rows.map((r) => ({ ...rowToDiagram(r), accessRole: r.access_role })),
  });
});

router.get("/:id", (req, res) => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM diagrams WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  const role = diagramAccessOf(db, req.params.id, ownerOf(req));
  if (!role) return res.status(404).json({ error: "not_found" });
  res.json({ ...rowToDiagram(row), accessRole: role });
});

router.post("/", (req, res) => {
  const db = getDb();
  const row = diagramToRow(req.body);
  if (!row.id || !row.name || !row.database) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  db.prepare(
    `INSERT INTO diagrams (id, owner_id, name, database, gist_id, loaded_from_gist_id, last_modified, payload)
     VALUES (@id, @owner_id, @name, @database, @gist_id, @loaded_from_gist_id, @last_modified, @payload)`,
  ).run({ ...row, owner_id: ownerOf(req) });
  const created = db.prepare("SELECT * FROM diagrams WHERE id = ?").get(row.id);
  res.status(201).json({ ...rowToDiagram(created), accessRole: "owner" });
});

router.put("/:id", (req, res) => {
  const db = getDb();
  const role = diagramAccessOf(db, req.params.id, ownerOf(req));
  if (!role) return res.status(404).json({ error: "not_found" });
  const row = diagramToRow({ ...req.body, diagramId: req.params.id });
  if (!row.name || !row.database) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  db.prepare(
    `UPDATE diagrams
     SET name = @name,
         database = @database,
         gist_id = @gist_id,
         loaded_from_gist_id = @loaded_from_gist_id,
         last_modified = @last_modified,
         payload = @payload
     WHERE id = @id`,
  ).run(row);
  const updated = db.prepare("SELECT * FROM diagrams WHERE id = ?").get(row.id);
  res.json({ ...rowToDiagram(updated), accessRole: role });
});

router.delete("/:id", (req, res) => {
  // 仅 owner 可以删除（co-collab 不能直接删整张图）
  const db = getDb();
  const role = diagramAccessOf(db, req.params.id, ownerOf(req));
  if (role !== "owner") return res.status(403).json({ error: "owner_only" });
  const result = db
    .prepare("DELETE FROM diagrams WHERE id = ? AND owner_id = ?")
    .run(req.params.id, ownerOf(req));
  if (result.changes === 0) return res.status(404).json({ error: "not_found" });
  res.status(204).end();
});

export default router;
