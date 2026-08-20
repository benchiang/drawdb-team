import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  AutoComplete,
  Toast,
  Modal,
  Banner,
  Tag,
  Empty,
  Spin,
} from "@douyinfe/semi-ui";
import { IconDeleteStroked, IconUserAdd } from "@douyinfe/semi-icons";
import { useTranslation } from "react-i18next";
import { IdContext } from "../../Workspace";
import { MODAL } from "../../../data/constants";
import { collaboratorsApi } from "../../../api/collaborators";
import { usersApi } from "../../../api/auth";
import { useAuth } from "../../../context/AuthContext";

function mapError(err) {
  if (err?.response?.data?.error === "user_not_found")
    return "找不到该用户";
  if (err?.response?.data?.error === "already_collaborator")
    return "该用户已经是协作者";
  if (err?.response?.data?.error === "cannot_share_with_self")
    return "不能把自己加为协作者";
  if (err?.response?.data?.error === "owner_only")
    return "只有所有者可以管理协作者";
  return err?.response?.data?.error || err?.message || "操作失败";
}

export default function Share({ setModal }) {
  const { t } = useTranslation();
  const { title, diagramId } = useContext(IdContext);
  const { user: me } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const searchSeqRef = useRef(0);

  const isOwner = true; // Share Modal 只在 owner 视角下打开（ControlPanel 已是 owner 路径）

  const reload = useCallback(async () => {
    if (!diagramId) return;
    setLoading(true);
    try {
      const list = await collaboratorsApi.list(diagramId);
      setItems(list || []);
    } catch (err) {
      console.warn("load collaborators failed", err);
    } finally {
      setLoading(false);
    }
  }, [diagramId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // 输入关键字时动态搜索候选用户（防抖 250ms + 序号防止乱序）
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }
    const seq = ++searchSeqRef.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const list = await usersApi.search(q);
        if (seq !== searchSeqRef.current) return;
        // 过滤掉自己、已是协作者的用户
        const collaboratorIds = new Set(items.map((c) => c.id));
        const filtered = (list || []).filter(
          (u) => u.id !== me?.id && !collaboratorIds.has(u.id),
        );
        setSuggestions(filtered);
      } catch (err) {
        if (seq !== searchSeqRef.current) return;
        console.warn("user search failed", err);
        setSuggestions([]);
      } finally {
        if (seq === searchSeqRef.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, me?.id, items]);

  // 派生：只有当 query 严格匹配某个候选的 username 时，才视为"已选"
  // 不依赖独立 pickedUser state，避免 onChange/onSelect 触发顺序导致状态错乱
  const pickedUser = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    return suggestions.find((u) => u.username === q) || null;
  }, [query, suggestions]);

  const handleAdd = async () => {
    if (submitting) return;
    if (!pickedUser) {
      setError("请从下拉列表中选择一个用户");
      return;
    }
    if (pickedUser.id === me?.id) {
      setError("不能把自己加为协作者");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await collaboratorsApi.add(diagramId, pickedUser.username);
      Toast.success("已添加协作者");
      // 添加成功后，把候选用户立即从 suggestions 中移除（防重复）
      setSuggestions((prev) => prev.filter((u) => u.id !== pickedUser.id));
      setQuery("");
      await reload();
    } catch (err) {
      setError(mapError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = (u) => {
    Modal.confirm({
      title: "移除协作者",
      content: `确定要移除「${u.username}」对「${title}」的访问？`,
      okText: "移除",
      okButtonProps: { type: "danger" },
      onOk: async () => {
        try {
          await collaboratorsApi.remove(diagramId, u.id);
          Toast.success("已移除");
          await reload();
        } catch (err) {
          Toast.error(mapError(err));
        }
      },
    });
  };

  if (!diagramId) {
    return (
      <Banner
        type="info"
        description="当前图尚未保存，请先保存后再分享。"
        closeIcon={null}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Banner
        type="info"
        description={
          <div>
            <div>协作者可对「<strong>{title}</strong>」进行查看与编辑。</div>
            <div className="text-xs text-zinc-500 mt-1">
              数据保存在本地 SQLite 中，所有人看到的都是同一份数据（最后保存者覆盖）。
            </div>
          </div>
        }
        closeIcon={null}
      />

      {isOwner && (
        <div className="flex gap-2">
          <div className="flex-1">
            <AutoComplete
              value={query}
              onChange={(v) => {
                setQuery(v);
                setError("");
              }}
              placeholder="输入用户名搜索（至少 1 个字符）"
              disabled={submitting}
              data={suggestions.map((u) => ({
                value: u.username,
                label: (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-800">{u.username}</span>
                    {u.role === "admin" && (
                      <Tag size="small" color="blue">
                        admin
                      </Tag>
                    )}
                  </div>
                ),
              }))}
              emptyContent={
                searching ? (
                  <div className="flex items-center justify-center gap-2 py-2 text-zinc-500">
                    <Spin size="small" /> 搜索中...
                  </div>
                ) : (
                  <div className="text-center text-zinc-400 py-2 text-sm">
                    没有匹配的用户
                  </div>
                )
              }
              filterLocal={false}
              style={{ width: "100%" }}
            />
          </div>
          <Button
            type="primary"
            icon={<IconUserAdd />}
            loading={submitting}
            disabled={submitting || !pickedUser}
            onClick={handleAdd}
          >
            邀请
          </Button>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div>
        <div className="text-sm font-semibold text-zinc-700 mb-2">
          当前协作者（{items.length}）
        </div>
        {loading ? (
          <div className="text-center text-zinc-500 py-4">加载中...</div>
        ) : items.length === 0 ? (
          <Empty description="暂无协作者" />
        ) : (
          <ul className="divide-y border rounded-md">
            {items.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-zinc-800">{u.username}</span>
                  {u.user_role === "admin" && (
                    <Tag size="small" color="blue">
                      admin
                    </Tag>
                  )}
                </div>
                <Button
                  size="small"
                  type="danger"
                  icon={<IconDeleteStroked />}
                  onClick={() => handleRemove(u)}
                >
                  移除
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setModal(MODAL.NONE)}>关闭</Button>
      </div>
    </div>
  );
}
