// 修改密码弹窗：登录用户改自己的密码
// 入口在 Dashboard 顶栏；服务端走 POST /api/auth/password
// 表单沿用项目 Users.jsx 的 "受控 Input + error div" 风格，不用 Form.useForm。
import { useEffect, useState } from "react";
import { Modal, Input, Button, Toast } from "@douyinfe/semi-ui";
import { useTranslation } from "react-i18next";
import { authApi } from "../../api/auth";

export default function ChangePasswordModal({ visible, onCancel }) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
    }
  }, [visible]);

  const validate = () => {
    if (!currentPassword) {
      return t("wrong_current_password");
    }
    if (newPassword.length < 4) {
      return t("password_too_short");
    }
    if (newPassword !== confirmPassword) {
      return t("password_mismatch");
    }
    if (newPassword === currentPassword) {
      return t("password_unchanged");
    }
    return "";
  };

  const handleOk = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      Toast.success(t("password_changed"));
      onCancel?.();
    } catch (err) {
      const code = err?.response?.data?.error;
      let message = t("change_password_failed");
      if (code === "invalid_credentials") {
        message = t("wrong_current_password");
      } else if (code === "credentials_too_weak") {
        message = t("password_too_short");
      } else if (code === "password_unchanged") {
        message = t("password_unchanged");
      } else if (err?.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={t("change_password")}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      maskClosable={false}
      width={420}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleOk();
        }}
        className="space-y-3 pt-2 pb-5"
      >
        <div>
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
            {t("current_password")}
          </div>
          <Input
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder={t("current_password")}
            disabled={submitting}
          />
        </div>
        <div>
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
            {t("new_password")}
          </div>
          <Input
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder={t("new_password")}
            disabled={submitting}
          />
        </div>
        <div>
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
            {t("confirm_password")}
          </div>
          <Input
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder={t("confirm_password")}
            disabled={submitting}
          />
        </div>
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onCancel} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            disabled={submitting}
          >
            {t("change_password")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
