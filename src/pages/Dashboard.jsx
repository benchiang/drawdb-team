// 登录后的首页：展示当前用户「我的图 / 共享给我」两个分区
// 点击列表项才进入编辑器画布（/editor/diagrams/:id）
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Empty,
  Modal,
  Spin,
  Tag,
  Banner,
  Toast,
} from "@douyinfe/semi-ui";
import { IconPlus, IconUser, IconExit, IconLock } from "@douyinfe/semi-icons";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";
import { diagramsApi } from "../api/diagrams";
import { subscribe, TOPICS } from "../api/storeBus";
import { useAuth } from "../context/AuthContext";
import ChangePasswordModal from "../components/Dashboard/ChangePasswordModal";
import NewDiagramModal from "../components/Dashboard/NewDiagramModal";
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

function DiagramCard({ diagram, onOpen, onDelete }) {
  // accessRole: 'owner' | 'edit' | 'read'
  // 非 owner（即 read/edit）都算"共享给我"
  const isShared = diagram.accessRole === "edit" || diagram.accessRole === "read";
  const isReadOnly = diagram.accessRole === "read";
  return (
    <div
      onClick={() => onOpen(diagram.diagramId)}
      className="group cursor-pointer rounded-lg border border-zinc-200 bg-white dark:bg-zinc-800 dark:border-zinc-700 hover:border-sky-400 hover:shadow-md transition-all p-4"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-zinc-800 dark:text-zinc-100 truncate flex-1">
          {diagram.name || "Untitled"}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isReadOnly && (
            <Tag size="small" color="grey">
              只读
            </Tag>
          )}
          {isShared && !isReadOnly && (
            <Tag size="small" color="violet">
              共享
            </Tag>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
        <Tag size="small" color="grey">
          {databaseName(diagram.database)}
        </Tag>
        <span>{formatTimestamp(diagram.lastModified)}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>共 {diagram.tables?.length ?? 0} 张表</span>
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

function TrashedDiagramCard({ diagram, onRestore, onPermanentDelete }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900/40 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-zinc-700 dark:text-zinc-200 truncate flex-1">
          {diagram.name || "Untitled"}
        </div>
        <Tag size="small" color="grey">
          {databaseName(diagram.database)}
        </Tag>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
        <span>
          {t("trashed_at")} {formatTimestamp(diagram.deletedAt)}
        </span>
      </div>
      <div className="flex items-center justify-end gap-3 text-xs">
        <button
          type="button"
          className="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
          onClick={() => onRestore?.(diagram)}
        >
          {t("restore")}
        </button>
        <button
          type="button"
          className="text-red-500 hover:text-red-700 transition-colors"
          onClick={() => onPermanentDelete?.(diagram)}
        >
          {t("delete_permanently")}
        </button>
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
  const [trashed, setTrashed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pwdModalVisible, setPwdModalVisible] = useState(false);

  const reload = useCallback(async () => {
    try {
      setError("");
      const [list, trashedList] = await Promise.all([
        diagramsApi.list(),
        diagramsApi.listTrashed().catch(() => []),
      ]);
      setItems(list || []);
      setTrashed(trashedList || []);
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
      // accessRole: 'owner' | 'edit' | 'read'
      if (d.accessRole === "edit" || d.accessRole === "read") s.push(d);
      else o.push(d);
    }
    return { owned: o, shared: s };
  }, [items]);

  const openDiagram = (id) => {
    navigate(`/editor/diagrams/${id}`);
  };

  const createDiagram = async (database) => {
    if (creating) return;
    setCreating(true);
    try {
      const newId = uuidv4();
      await diagramsApi.create({
        diagramId: newId,
        database: database || DB.GENERIC,
        name: "Untitled Diagram",
        lastModified: new Date(),
        tables: [],
        references: [],
        notes: [],
        areas: [],
        pan: { x: 0, y: 0 },
        zoom: 1,
      });
      setPickerOpen(false);
      navigate(`/editor/diagrams/${newId}`);
    } catch (err) {
      console.warn("create diagram failed", err);
      setError("创建图失败");
    } finally {
      setCreating(false);
    }
  };

  const deleteDiagram = (diagram) => {
    Modal.confirm({
      title: t("delete_diagram"),
      content: t("are_you_sure_delete_diagram"),
      okText: t("delete"),
      okButtonProps: { type: "danger" },
      cancelText: t("cancel"),
      onOk: async () => {
        try {
          await diagramsApi.remove(diagram.diagramId);
          Toast.success(t("move_to_recycle_bin"));
          reload();
        } catch (err) {
          console.warn("delete diagram failed", err);
          Toast.error(t("move_to_recycle_bin_failed"));
        }
      },
    });
  };

  const restoreDiagram = async (diagram) => {
    try {
      await diagramsApi.restore(diagram.diagramId);
      Toast.success(t("restore_success"));
      reload();
    } catch (err) {
      console.warn("restore diagram failed", err);
      Toast.error(t("restore_failed"));
    }
  };

  const permanentDeleteDiagram = (diagram) => {
    Modal.confirm({
      title: t("delete_permanently"),
      content: t("are_you_sure_delete_permanently", { name: diagram.name }),
      okText: t("delete_permanently"),
      okButtonProps: { type: "danger" },
      cancelText: t("cancel"),
      onOk: async () => {
        try {
          await diagramsApi.permanentDelete(diagram.diagramId);
          Toast.success(t("delete_permanently"));
          reload();
        } catch (err) {
          console.warn("permanent delete failed", err);
          Toast.error(t("permanent_delete_failed"));
        }
      },
    });
  };

  const emptyTrash = () => {
    if (trashed.length === 0) return;
    Modal.confirm({
      title: t("empty_recycle_bin"),
      content: t("are_you_sure_empty_recycle_bin"),
      okText: t("empty_recycle_bin"),
      okButtonProps: { type: "danger" },
      cancelText: t("cancel"),
      onOk: async () => {
        let failed = 0;
        for (const d of trashed) {
          try {
            await diagramsApi.permanentDelete(d.diagramId);
          } catch (err) {
            console.warn("permanent delete failed", err);
            failed += 1;
          }
        }
        if (failed === 0) {
          Toast.success(t("empty_recycle_bin_success"));
        } else {
          Toast.error(t("empty_recycle_bin_failed"));
        }
        reload();
      },
    });
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
              icon={<IconLock />}
              onClick={() => setPwdModalVisible(true)}
            >
              修改密码
            </Button>
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
              onClick={() => setPickerOpen(true)}
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
                  onOpen={openDiagram}
                />
              ))}
            </div>
          )}
        </Section>

        <Section
          title={t("recycle_bin")}
          count={trashed.length}
          action={
            trashed.length > 0 ? (
              <Button
                type="danger"
                theme="light"
                size="small"
                onClick={emptyTrash}
              >
                {t("empty_recycle_bin")}
              </Button>
            ) : null
          }
        >
          {loading ? null : trashed.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-6">
              <Empty description={t("recycle_bin_empty")} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trashed.map((d) => (
                <TrashedDiagramCard
                  key={d.diagramId}
                  diagram={d}
                  onRestore={restoreDiagram}
                  onPermanentDelete={permanentDeleteDiagram}
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

      <ChangePasswordModal
        visible={pwdModalVisible}
        onCancel={() => setPwdModalVisible(false)}
      />
      <NewDiagramModal
        visible={pickerOpen}
        creating={creating}
        onCancel={() => !creating && setPickerOpen(false)}
        onConfirm={createDiagram}
      />
    </div>
  );
}
