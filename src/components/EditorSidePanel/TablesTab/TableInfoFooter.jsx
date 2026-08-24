import { Button, Dropdown, Modal } from "@douyinfe/semi-ui";
import {
  IconCopyStroked,
  IconDeleteStroked,
  IconPlus,
} from "@douyinfe/semi-icons";
import { useTranslation } from "react-i18next";
import { nanoid } from "nanoid";
import {
  useDiagram,
  useLayout,
  useSelect,
  useUndoRedo,
} from "../../../hooks";
import { Action, ObjectType } from "../../../data/constants";
import ColorPicker from "../ColorPicker";

/**
 * 表格编辑 Modal 底部固定工具栏。
 * 作为 Modal 的 `footer` slot 渲染，因此位于 Modal 滚动 body 之外，
 * 不会被字段列表的滚动带走。
 */
export default function TableInfoFooter({
  data,
  onAddIndex,
  onAddUniqueConstraint,
  onAddComment,
}) {
  const { t } = useTranslation();
  const { layout } = useLayout();
  const { tables, updateTable, deleteTable, addTable } = useDiagram();
  const { setSelectedElement } = useSelect();
  const { setUndoStack, setRedoStack } = useUndoRedo();

  const handleColorPick = (color) => {
    if (layout.readOnly) return;
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "self",
        tid: data.id,
        undo: { color: data.color },
        redo: { color },
        message: t("edit_table", {
          tableName: data.name,
          extra: "[color]",
        }),
      },
    ]);
    setRedoStack([]);
  };

  const handleAddField = () => {
    if (layout.readOnly) return;
    const id = nanoid();
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "field_add",
        tid: data.id,
        fid: id,
        message: t("edit_table", {
          tableName: data.name,
          extra: "[add field]",
        }),
      },
    ]);
    setRedoStack([]);
    updateTable(data.id, {
      fields: [
        ...data.fields,
        {
          id,
          name: "",
          type: "",
          default: "",
          check: "",
          primary: false,
          unique: false,
          notNull: false,
          increment: false,
          comment: "",
        },
      ],
    });
  };

  const handleAddComment = () => {
    if (layout.readOnly || data.comment) return;
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "comment",
        tid: data.id,
        undo: { comment: "" },
        redo: { comment: "" },
        message: t("edit_table", {
          tableName: data.name,
          extra: "[add comment]",
        }),
      },
    ]);
    setRedoStack([]);
    onAddComment?.();
  };

  const handleAddUniqueConstraint = () => {
    if (layout.readOnly) return;
    const id = nanoid();
    const newUnique = {
      id,
      name: `unique_${(data.uniqueConstraints || []).length + 1}`,
      fields: [],
    };
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "unique_constraint_add",
        tid: data.id,
        uid: id,
        message: t("edit_table", {
          tableName: data.name,
          extra: "[add unique]",
        }),
      },
    ]);
    setRedoStack([]);
    updateTable(data.id, {
      uniqueConstraints: [...(data.uniqueConstraints || []), newUnique],
    });
    onAddUniqueConstraint?.();
  };

  const handleAddIndex = () => {
    if (layout.readOnly) return;
    const id = nanoid();
    const newIndex = {
      id,
      name: `idx_${(data.indices || []).length + 1}`,
      fields: [],
      unique: false,
    };
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "index_add",
        tid: data.id,
        iid: id,
        message: t("edit_table", {
          tableName: data.name,
          extra: "[add index]",
        }),
      },
    ]);
    setRedoStack([]);
    updateTable(data.id, { indices: [...(data.indices || []), newIndex] });
    onAddIndex?.();
  };

  const handleDuplicate = () => {
    if (layout.readOnly) return;
    const newId = nanoid();
    const duplicated = {
      ...data,
      id: newId,
      name: `${data.name || "table"}_copy`,
      fields: data.fields.map((f) => ({ ...f, id: nanoid() })),
      indices: (data.indices || []).map((idx) => ({ ...idx, id: nanoid() })),
      uniqueConstraints: (data.uniqueConstraints || []).map((uc) => ({
        ...uc,
        id: nanoid(),
      })),
    };
    setUndoStack((prev) => [
      ...prev,
      {
        data: { table: duplicated, index: tables.length },
        action: Action.ADD,
        element: ObjectType.TABLE,
        message: t("duplicate_table_by_name", { tableName: data.name }),
      },
    ]);
    setRedoStack([]);
    addTable({ table: duplicated }, false);
    setSelectedElement((prev) => ({
      ...prev,
      element: ObjectType.TABLE,
      id: newId,
      open: true,
    }));
  };

  const handleDelete = () => {
    if (layout.readOnly) return;
    Modal.confirm({
      title: t("delete_table", { tableName: data.name || "table" }),
      content: t("are_you_sure_delete_table"),
      okText: t("delete"),
      okButtonProps: { type: "danger" },
      cancelText: t("cancel"),
      onOk: () => {
        deleteTable(data.id);
        setSelectedElement({
          element: ObjectType.NONE,
          id: null,
          open: false,
        });
      },
    });
  };

  return (
    <div className="flex items-center justify-between gap-1 border-t border-zinc-200 bg-zinc-50 px-4 py-2">
      <ColorPicker
        usePopover
        readOnly={layout.readOnly}
        value={data.color}
        onChange={(color) => updateTable(data.id, { color })}
        onColorPick={handleColorPick}
      />
      <div className="flex gap-1">
        <Dropdown
          position="bottomLeft"
          trigger="click"
          render={
            <Dropdown.Menu>
              <Dropdown.Item onClick={handleAddComment}>
                {t("add_comment")}
              </Dropdown.Item>
              <Dropdown.Item onClick={handleAddUniqueConstraint}>
                {t("add_unique_constraint")}
              </Dropdown.Item>
              <Dropdown.Item onClick={handleAddIndex}>
                {t("add_index")}
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <Button
            icon={<IconPlus />}
            disabled={layout.readOnly}
            title={t("add")}
          />
        </Dropdown>
        <Button disabled={layout.readOnly} onClick={handleAddField}>
          {t("add_field")}
        </Button>
        <Button
          type="tertiary"
          theme="light"
          disabled={layout.readOnly}
          icon={<IconCopyStroked />}
          title={t("duplicate")}
          onClick={handleDuplicate}
        />
        <Button
          type="danger"
          disabled={layout.readOnly}
          icon={<IconDeleteStroked />}
          onClick={handleDelete}
        />
      </div>
    </div>
  );
}
