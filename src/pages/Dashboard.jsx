// 登录后的首页：展示当前用户「我的图 / 共享给我」两个分区
// 点击列表项才进入编辑器画布（/editor/diagrams/:id）
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Empty,
  Spin,
  Tag,
  Banner,
} from "@douyinfe/semi-ui";
import { IconPlus, IconUser, IconExit } from "@douyinfe/semi-icons";
import { v4 as uuidv4 } from "uuid";
import { useTranslation } from "react-i18next";
import { diagramsApi } from "../api/diagrams";
import { subscribe, TOPICS } from "../api/storeBus";
import { useAuth } from "../context/AuthContext";
import { databases } from "../data/databases";
import { DB } from "../data/constants";
import logo from "../assets/logo_light_160.png";

const databaseName = (database) => databases[database]?.name ?? "Generic";

function formatTimestamp(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function DiagramCard({ diagram, currentUserId, onOpen, onDelete }) {
  const isShared = diagram.accessRole === "collab";
  return (
    <div
      onClick={() => onOpen(diagram.diagramId)}
      className="group cursor-pointer rounded-lg border border-zinc-200 bg-white dark:bg-zinc-800 dark:border-zinc-700 hover:border-sky-400 hover:shadow-md transition-all p-4"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-zinc-800 dark:text-zinc-100 truncate flex-1">
          {diagram.name || "Untitled"}
        </div>
        {isShared && (
          <Tag size="small" color="violet">
            Shared
          </Tag>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
        <Tag size="small" color="grey">
          {databaseName(diagram.database)}
        </Tag>
        <span>{formatTimestamp(diagram.lastModified)}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>
          {isShared
            ? `共 ${diagram.tables?.length ?? 0} 张表`
            : `${diagram.tables?.length ?? 0} 张表`}
        </span>
        {!isShared && (
          <button
            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(diagram);
            }}
          >
            删除
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, count, children, action }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">
            {title}
          </h2>
          <span className="text-sm text-zinc-400">({count})</span>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    try {
      setError("");
      const list = await diagramsApi.list();
      setItems(list || []);
    } catch (err) {
      console.warn("load diagrams failed", err);
      setError("无法加载图列表");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const unsubscribe = subscribe((topic) => {
      if (topic === TOPICS.DIAGRAMS_CHANGED) reload();
    });
    return unsubscribe;
  }, [reload]);

  const { owned, shared } = useMemo(() => {
    const o = [];
    const s = [];
    for (const d of items) {
      if (d.accessRole === "collab") s.push(d);
      else o.push(d);
    }
    return { owned: o, shared: s };
  }, [items]);

  const openDiagram = (id) => {
    navigate(`/editor/diagrams/${id}`);
  };

  const createDiagram = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const newId = uuidv4();
      await diagramsApi.create({
        diagramId: newId,
        database: DB.GENERIC,
        name: "Untitled Diagram",
        lastModified: new Date(),
        tables: [],
        references: [],
        notes: [],
        areas: [],
        pan: { x: 0, y: 0 },
        zoom: 1,
      });
      navigate(`/editor/diagrams/${newId}`);
    } catch (err) {
      console.warn("create diagram failed", err);
      setError("创建图失败");
    } finally {
      setCreating(false);
    }
  };

  const deleteDiagram = async (diagram) => {
    if (!window.confirm(`确定要删除「${diagram.name}」吗？`)) return;
    try {
      await diagramsApi.remove(diagram.diagramId);
      reload();
    } catch (err) {
      console.warn("delete diagram failed", err);
      setError("删除失败");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="drawDB" className="h-9" />
            <span className="text-zinc-300 dark:text-zinc-600">|</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              {user?.username}
              {user?.role === "admin" && (
                <Tag size="small" color="blue" className="ml-2">
                  admin
                </Tag>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === "admin" && (
              <Button onClick={() => navigate("/users")}>
                <IconUser /> 用户管理
              </Button>
            )}
            <Button
              type="tertiary"
              icon={<IconExit />}
              onClick={handleLogout}
            >
              注销
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <Banner
            type="danger"
            description={error}
            closeIcon={null}
            className="mb-4"
          />
        )}

        <Section
          title="我的图"
          count={owned.length}
          action={
            <Button
              type="primary"
              icon={<IconPlus />}
              loading={creating}
              onClick={createDiagram}
            >
              新建图
            </Button>
          }
        >
          {loading ? (
            <div className="flex justify-center py-10">
              <Spin />
            </div>
          ) : owned.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-8">
              <Empty description="还没有图，点击右上角「新建图」开始" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {owned.map((d) => (
                <DiagramCard
                  key={d.diagramId}
                  diagram={d}
                  currentUserId={user?.id}
                  onOpen={openDiagram}
                  onDelete={deleteDiagram}
                />
              ))}
            </div>
          )}
        </Section>

        <Section title="共享给我" count={shared.length}>
          {loading ? null : shared.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-6">
              <Empty description="暂无他人共享给你的图" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shared.map((d) => (
                <DiagramCard
                  key={d.diagramId}
                  diagram={d}
                  currentUserId={user?.id}
                  onOpen={openDiagram}
                />
              ))}
            </div>
          )}
        </Section>
      </main>

      <footer className="text-center text-xs text-zinc-400 py-6">
        &copy; {new Date().getFullYear()} <strong>drawDB</strong> - 本地多用户
        数据库设计工具
      </footer>
    </div>
  );
}
