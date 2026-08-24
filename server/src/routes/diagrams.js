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

// 列出当前用户可见的图（owner + 协作者），并排除已软删的
router.get("/", (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT d.*, 'owner' AS access_role
         FROM diagrams d WHERE d.owner_id = ? AND d.deleted_at IS NULL
       UNION
       SELECT d.*, c.permission AS access_role
         FROM diagrams d
         JOIN diagram_collaborators c ON c.diagram_id = d.id
        WHERE c.user_id = ? AND d.deleted_at IS NULL
       ORDER BY last_modified DESC`,
    )
    .all(ownerOf(req), ownerOf(req));
  res.json({
    items: rows.map((r) => ({ ...rowToDiagram(r), accessRole: r.access_role })),
  });
});

// 回收站：当前用户作为 owner 已软删的图
router.get("/trash", (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM diagrams
        WHERE owner_id = ? AND deleted_at IS NOT NULL
        ORDER BY deleted_at DESC`,
    )
    .all(ownerOf(req));
  res.json({
    items: rows.map((r) => ({
      ...rowToDiagram(r),
      deletedAt: r.deleted_at,
    })),
  });
});

router.get("/:id", (req, res) => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM diagrams WHERE id = ?")
    .get(req.params.id);
  if (!row || row.deleted_at) return res.status(404).json({ error: "not_found" });
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
  const row = db
    .prepare("SELECT * FROM diagrams WHERE id = ?")
    .get(req.params.id);
  if (!row || row.deleted_at) return res.status(404).json({ error: "not_found" });
  const role = diagramAccessOf(db, req.params.id, ownerOf(req));
  if (!role) return res.status(404).json({ error: "not_found" });
  // 只读协作者不能保存图
  if (role !== "owner" && role !== "edit") {
    return res.status(403).json({ error: "read_only" });
  }
  const updated = diagramToRow({ ...req.body, diagramId: req.params.id });
  if (!updated.name || !updated.database) {
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
  ).run(updated);
  const after = db.prepare("SELECT * FROM diagrams WHERE id = @id").get({ id: updated.id });
  res.json({ ...rowToDiagram(after), accessRole: role });
});

// 软删除：把 deleted_at 标记为当前时间
router.delete("/:id", (req, res) => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM diagrams WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.owner_id !== ownerOf(req)) {
    return res.status(403).json({ error: "owner_only" });
  }
  if (row.deleted_at) return res.status(404).json({ error: "not_found" });
  db.prepare(
    `UPDATE diagrams SET deleted_at = datetime('now')
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL`,
  ).run(req.params.id, ownerOf(req));
  res.status(204).end();
});

// 恢复：清掉 deleted_at
router.post("/:id/restore", (req, res) => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM diagrams WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.owner_id !== ownerOf(req)) {
    return res.status(403).json({ error: "owner_only" });
  }
  if (!row.deleted_at) return res.status(404).json({ error: "not_found" });
  db.prepare(
    `UPDATE diagrams SET deleted_at = NULL
      WHERE id = ? AND owner_id = ? AND deleted_at IS NOT NULL`,
  ).run(req.params.id, ownerOf(req));
  res.json({ ...rowToDiagram(row), accessRole: "owner" });
});

// 硬删除：仅在已软删后才允许（防误删）
router.delete("/:id/permanent", (req, res) => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM diagrams WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.owner_id !== ownerOf(req)) {
    return res.status(403).json({ error: "owner_only" });
  }
  if (!row.deleted_at) return res.status(404).json({ error: "not_found" });
  db.prepare(
    `DELETE FROM diagrams
      WHERE id = ? AND owner_id = ? AND deleted_at IS NOT NULL`,
  ).run(req.params.id, ownerOf(req));
  res.status(204).end();
});

export default router;
