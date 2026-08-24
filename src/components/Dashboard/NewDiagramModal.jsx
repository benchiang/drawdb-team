import { useEffect, useState } from "react";
import { Modal } from "@douyinfe/semi-ui";
import { useTranslation } from "react-i18next";
import { DB } from "../../data/constants";
import { databases } from "../../data/databases";

const STORAGE_KEY = "drawdb.lastDbChoice";

// 顺序按用户使用频率排列，Generic 放最后作为兜底
const ORDER = [
  DB.MYSQL,
  DB.POSTGRES,
  DB.SQLITE,
  DB.MARIADB,
  DB.MSSQL,
  DB.ORACLESQL,
  DB.GENERIC,
];

function readLast() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export default function NewDiagramModal({
  visible,
  onCancel,
  onConfirm,
  creating,
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(() => {
    const last = readLast();
    return ORDER.includes(last) ? last : DB.MYSQL;
  });
  const [lastUsed, setLastUsed] = useState("");

  // 每次打开时刷新"上次使用"标记，并校验 selected 仍在可选列表内
  useEffect(() => {
    if (visible) {
      const last = readLast();
      setLastUsed(last);
      if (!ORDER.includes(selected)) {
        setSelected(ORDER.includes(last) ? last : DB.MYSQL);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleOk = () => {
    try {
      localStorage.setItem(STORAGE_KEY, selected);
    } catch {
      /* localStorage 不可用时静默忽略 */
    }
    onConfirm(selected);
  };

  return (
    <Modal
      title={t("create_new_diagram")}
      visible={visible}
      onCancel={onCancel}
      onOk={handleOk}
      okText={t("create")}
      cancelText={t("cancel")}
      okButtonProps={{ loading: creating, disabled: !selected }}
      width={520}
    >
      <div className="py-1 text-sm text-zinc-500 dark:text-zinc-400">
        {t("select_database_tip")}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {ORDER.map((key) => {
          const meta = databases[key] || {};
          const isSelected = selected === key;
          const isLast = lastUsed === key && isSelected;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={`text-left p-3 rounded-md border transition-colors flex items-center gap-3 ${
                isSelected
                  ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20"
                  : "border-zinc-200 dark:border-zinc-700 hover:border-sky-300 dark:hover:border-sky-600"
              }`}
            >
              {meta.image ? (
                <img
                  src={meta.image}
                  alt={meta.name}
                  className="w-7 h-7 rounded shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded bg-zinc-200 dark:bg-zinc-700 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-800 dark:text-zinc-100 truncate">
                  {meta.name}
                </div>
                {isLast && (
                  <div className="text-xs text-sky-500 dark:text-sky-400">
                    {t("last_used")}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
