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
  Radio,
  RadioGroup,
} from "@douyinfe/semi-ui";
import {
  IconDeleteStroked,
  IconUserAdd,
  IconEyeOpened,
  IconEdit,
} from "@douyinfe/semi-icons";
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
  if (err?.response?.data?.error === "invalid_permission")
    return "权限值无效（只允许 read / edit）";
  return err?.response?.data?.error || err?.message || "操作失败";
}

const PERM_OPTIONS = [
  { value: "read", label: "只读", icon: <IconEyeOpened /> },
  { value: "edit", label: "可编辑", icon: <IconEdit /> },
];

function PermTag({ permission }) {
  if (permission === "read") {
    return (
      <Tag size="small" color="grey">
        <span className="inline-flex items-center gap-1">
          <IconEyeOpened size="small" /> 只读
        </span>
      </Tag>
    );
  }
  return (
    <Tag size="small" color="green">
      <span className="inline-flex items-center gap-1">
        <IconEdit size="small" /> 可编辑
      </span>
    </Tag>
  );
}

export default function Share({ setModal }) {
  const { title, diagramId } = useContext(IdContext);
  const { user: me } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // 邀请时给新协作者的权限（默认 edit）
  const [newPermission, setNewPermission] = useState("edit");
  // 单独追踪正在改权限的协作者 id，避免整列刷新闪烁
  const [updatingId, setUpdatingId] = useState(null);
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
      await collaboratorsApi.add(diagramId, pickedUser.username, newPermission);
      Toast.success("已添加协作者");
      setSuggestions((prev) => prev.filter((u) => u.id !== pickedUser.id));
      setQuery("");
      await reload();
    } catch (err) {
      setError(mapError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePermission = async (u, permission) => {
    if (u.permission === permission || updatingId === u.id) return;
    setUpdatingId(u.id);
    // 乐观更新：先改本地状态，失败再回滚
    const prevPerm = u.permission;
    setItems((prev) =>
      prev.map((c) => (c.id === u.id ? { ...c, permission } : c)),
    );
    try {
      await collaboratorsApi.updatePermission(diagramId, u.id, permission);
      Toast.success(
        permission === "read"
          ? `已设置 ${u.username} 为只读`
          : `已设置 ${u.username} 为可编辑`,
      );
    } catch (err) {
      // 回滚
      setItems((prev) =>
        prev.map((c) => (c.id === u.id ? { ...c, permission: prevPerm } : c)),
      );
      Toast.error(mapError(err));
    } finally {
      setUpdatingId(null);
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
            <div>
              邀请其他用户协作「<strong>{title}</strong>」：可授予<strong>可编辑</strong>或<strong>只读</strong>权限。
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              数据保存在本地 SQLite 中，保存时所有协作者看到的是同一份数据（最后保存者覆盖）。
            </div>
          </div>
        }
        closeIcon={null}
      />

      {isOwner && (
        <div className="space-y-2">
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
          <div className="flex items-center gap-3 px-1">
            <span className="text-xs text-zinc-500">新协作者权限：</span>
            <RadioGroup
              type="button"
              size="small"
              value={newPermission}
              onChange={(e) => setNewPermission(e.target.value)}
              disabled={submitting}
            >
              {PERM_OPTIONS.map((opt) => (
                <Radio key={opt.value} value={opt.value}>
                  <span className="inline-flex items-center gap-1">
                    {opt.icon}
                    {opt.label}
                  </span>
                </Radio>
              ))}
            </RadioGroup>
          </div>
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
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-zinc-800 truncate">{u.username}</span>
                  {u.user_role === "admin" && (
                    <Tag size="small" color="blue">
                      admin
                    </Tag>
                  )}
                  {!isOwner && <PermTag permission={u.permission} />}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isOwner && (
                    <RadioGroup
                      type="button"
                      size="small"
                      value={u.permission}
                      onChange={(e) => handleChangePermission(u, e.target.value)}
                    >
                      {PERM_OPTIONS.map((opt) => (
                        <Radio
                          key={opt.value}
                          value={opt.value}
                          disabled={updatingId === u.id}
                        >
                          <span className="inline-flex items-center gap-1">
                            {opt.icon}
                            {opt.label}
                          </span>
                        </Radio>
                      ))}
                    </RadioGroup>
                  )}
                  {isOwner && (
                    <Button
                      size="small"
                      type="danger"
                      icon={<IconDeleteStroked />}
                      onClick={() => handleRemove(u)}
                    >
                      移除
                    </Button>
                  )}
                </div>
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
