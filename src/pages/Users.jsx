import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Toast, Button, Modal, Input, Select } from "@douyinfe/semi-ui";
import { IconDeleteStroked, IconEdit } from "@douyinfe/semi-icons";
import { usersApi } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo_light_160.png";

function UserFormModal({ visible, initial, onCancel, onSubmit, submitting }) {
  const isEdit = Boolean(initial?.id);
  const [username, setUsername] = useState(initial?.username || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(initial?.role || "user");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setUsername(initial?.username || "");
      setPassword("");
      setRole(initial?.role || "user");
      setError("");
    }
  }, [visible, initial]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (isEdit) {
      if (password && password.length < 4) {
        setError("密码至少 4 个字符");
        return;
      }
      const payload = {};
      if (password) payload.password = password;
      payload.role = role;
      const res = await onSubmit(payload);
      if (!res.ok) setError(res.error || "保存失败");
    } else {
      if (username.length < 3 || password.length < 4) {
        setError("用户名至少 3 个字符，密码至少 4 个字符");
        return;
      }
      const res = await onSubmit({ username, password, role });
      if (!res.ok) setError(res.error || "创建失败");
    }
  };

  return (
    <Modal
      title={isEdit ? "编辑用户" : "新建用户"}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      width={420}
    >
      <form onSubmit={handleSubmit} className="space-y-3 pt-2">
        {!isEdit && (
          <div>
            <div className="text-sm font-medium text-zinc-700 mb-1">用户名</div>
            <Input
              value={username}
              onChange={setUsername}
              placeholder="至少 3 个字符"
            />
          </div>
        )}
        <div>
          <div className="text-sm font-medium text-zinc-700 mb-1">
            {isEdit ? "新密码（留空则不修改）" : "密码"}
          </div>
          <Input
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="至少 4 个字符"
          />
        </div>
        <div>
          <div className="text-sm font-medium text-zinc-700 mb-1">角色</div>
          <Select
            value={role}
            onChange={setRole}
            style={{ width: "100%" }}
            optionList={[
              { value: "user", label: "普通用户" },
              { value: "admin", label: "管理员" },
            ]}
          />
        </div>
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onCancel}>取消</Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            disabled={submitting}
          >
            {isEdit ? "保存" : "创建"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function mapError(err) {
  if (err?.response?.data?.error === "username_taken") return "用户名已被占用";
  if (err?.response?.data?.error === "cannot_demote_last_admin")
    return "至少保留一个管理员";
  if (err?.response?.data?.error === "cannot_delete_last_admin")
    return "至少保留一个管理员";
  if (err?.response?.data?.error === "cannot_delete_self")
    return "不能删除自己";
  return err?.response?.data?.error || err?.message || "操作失败";
}

export default function Users() {
  const { user: me } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await usersApi.list();
      setItems(list);
    } catch (err) {
      Toast.error("加载用户列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setModalVisible(true);
  };

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    try {
      if (editing) {
        await usersApi.update(editing.id, payload);
        Toast.success("已保存");
      } else {
        await usersApi.create(payload);
        Toast.success("已创建");
      }
      setModalVisible(false);
      setEditing(null);
      await reload();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: mapError(err) };
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (u) => {
    if (u.id === me?.id) {
      Toast.error("不能删除自己");
      return;
    }
    Modal.confirm({
      title: "确认删除",
      content: `确定要删除用户「${u.username}」？该用户的所有数据也会一并删除。`,
      okText: "删除",
      okButtonProps: { type: "danger" },
      onOk: async () => {
        try {
          await usersApi.remove(u.id);
          Toast.success("已删除");
          await reload();
        } catch (err) {
          Toast.error(mapError(err));
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="px-12 xl:px-20 sm:px-6 py-3 flex justify-between items-center select-none bg-white border-b">
        <div className="flex items-center">
          <Link to="/editor">
            <img
              src={logo}
              alt="logo"
              className="me-2 sm:h-[28px] md:h-[46px] h-[48px]"
            />
          </Link>
          <div className="ms-4 text-xl font-semibold">用户管理</div>
        </div>
        <div className="flex gap-2">
          <Link to="/editor">
            <Button>返回编辑器</Button>
          </Link>
          <Button type="primary" onClick={openCreate}>
            新建用户
          </Button>
        </div>
      </div>

      <div className="px-12 xl:px-20 sm:px-6 py-6">
        <div className="bg-white rounded-md shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-zinc-700">
              <tr>
                <th className="text-left px-4 py-2">ID</th>
                <th className="text-left px-4 py-2">用户名</th>
                <th className="text-left px-4 py-2">角色</th>
                <th className="text-left px-4 py-2">创建时间</th>
                <th className="text-right px-4 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    加载中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    暂无用户
                  </td>
                </tr>
              ) : (
                items.map((u) => (
                  <tr key={u.id} className="border-t hover:bg-zinc-50">
                    <td className="px-4 py-2 text-zinc-500">{u.id}</td>
                    <td className="px-4 py-2 font-medium text-zinc-800">
                      {u.username}
                      {u.id === me?.id && (
                        <span className="ms-2 text-xs text-sky-600">(我)</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          u.role === "admin"
                            ? "bg-sky-100 text-sky-700"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-500">{u.created_at}</td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        size="small"
                        icon={<IconEdit />}
                        onClick={() => openEdit(u)}
                        className="me-1"
                      >
                        编辑
                      </Button>
                      <Button
                        size="small"
                        type="danger"
                        icon={<IconDeleteStroked />}
                        onClick={() => handleDelete(u)}
                        disabled={u.id === me?.id}
                      >
                        删除
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-zinc-400 mt-3">
          注：删除用户会同时级联删除该用户的所有 diagrams / templates。
        </div>
      </div>

      <UserFormModal
        visible={modalVisible}
        initial={editing}
        submitting={submitting}
        onCancel={() => {
          setModalVisible(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
