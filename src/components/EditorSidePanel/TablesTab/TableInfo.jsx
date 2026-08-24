import { useState, useRef } from "react";
import {
  Collapse,
  Input,
  TextArea,
  Button,
  Card,
  Select,
  Dropdown,
  Modal,
} from "@douyinfe/semi-ui";
import ColorPicker from "../ColorPicker";
import {
  IconAlertTriangle,
  IconCopyStroked,
  IconDeleteStroked,
  IconPlus,
} from "@douyinfe/semi-icons";
import {
  useDiagram,
  useLayout,
  useSaveState,
  useSelect,
  useUndoRedo,
} from "../../../hooks";
import { Action, ObjectType, State, DB } from "../../../data/constants";
import TableField from "./TableField";
import IndexDetails from "./IndexDetails";
import UniqueConstraintDetails from "./UniqueConstraintDetails";
import { useTranslation } from "react-i18next";
import { SortableList } from "../../SortableList/SortableList";
import { nanoid } from "nanoid";

const TABLE_MODAL_HINT_KEY = "drawdb.tableModalHintShown";

export default function TableInfo({ data }) {
  const { tables, database } = useDiagram();
  const { t } = useTranslation();
  const [indexActiveKey, setIndexActiveKey] = useState("");
  const [uniqueActiveKey, setUniqueActiveKey] = useState("");
  const [commentActiveKey, setCommentActiveKey] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(() => {
    try {
      return localStorage.getItem(TABLE_MODAL_HINT_KEY) === "1";
    } catch {
      return true;
    }
  });
  const { layout } = useLayout();
  const { deleteTable, updateTable, setTables, addTable } = useDiagram();
  const { setSelectedElement } = useSelect();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const { setSaveState } = useSaveState();
  const [editField, setEditField] = useState({});
  const initialColorRef = useRef(data.color);

  const dismissHint = () => {
    setHintDismissed(true);
    try {
      localStorage.setItem(TABLE_MODAL_HINT_KEY, "1");
    } catch {
      /* localStorage 不可用时静默 */
    }
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
    // 切换 Modal 内容到新表，保持 Modal 打开
    setSelectedElement((prev) => ({
      ...prev,
      element: ObjectType.TABLE,
      id: newId,
      open: true,
    }));
  };

  const handleColorPick = (color) => {
    setUndoStack((prev) => {
      let undoColor = initialColorRef.current;
      const lastColorChange = prev.findLast(
        (e) =>
          e.element === ObjectType.TABLE &&
          e.tid === data.id &&
          e.action === Action.EDIT &&
          e.redo?.color,
      );
      if (lastColorChange) {
        undoColor = lastColorChange.redo.color;
      }

      if (color === undoColor) return prev;

      const newStack = [
        ...prev,
        {
          action: Action.EDIT,
          element: ObjectType.TABLE,
          component: "self",
          tid: data.id,
          undo: { color: undoColor },
          redo: { color: color },
          message: t("edit_table", {
            tableName: data.name,
            extra: "[color]",
          }),
        },
      ];
      return newStack;
    });
    setRedoStack([]);
  };

  const inheritedFieldNames =
    Array.isArray(data.inherits) && data.inherits.length > 0
      ? data.inherits
          .map((parentName) => {
            const parent = tables.find((t) => t.name === parentName);
            return parent ? parent.fields.map((f) => f.name) : [];
          })
          .flat()
      : [];

  const addIndex = () => {
    setIndexActiveKey("1");
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "index_add",
        tid: data.id,
        message: t("edit_table", {
          tableName: data.name,
          extra: "[add index]",
        }),
      },
    ]);
    setRedoStack([]);
    updateTable(data.id, {
      indices: [
        ...data.indices,
        {
          id: data.indices.length,
          name: `${data.name}_index_${data.indices.length}`,
          unique: false,
          fields: [],
        },
      ],
    });
  };

  const addUniqueConstraint = () => {
    setUniqueActiveKey("1");
    const constraints = data.uniqueConstraints || [];
    setUndoStack((prev) => [
      ...prev,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "unique_constraint_add",
        tid: data.id,
        message: t("edit_table", {
          tableName: data.name,
          extra: "[add unique constraint]",
        }),
      },
    ]);
    setRedoStack([]);
    updateTable(data.id, {
      uniqueConstraints: [
        ...constraints,
        {
          id: constraints.length,
          name: `${data.name}_unique_${constraints.length}`,
          fields: [],
        },
      ],
    });
  };

  const addComment = () => {
    setShowComment(true);
    setCommentActiveKey("1");
  };

  return (
    <div>
      {!hintDismissed && (
        <div
          className="mb-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="note"
        >
          <IconAlertTriangle className="mt-0.5 shrink-0" />
          <div className="flex-1 leading-relaxed">
            {t("table_modal_hint")}
          </div>
          <Button
            size="small"
            type="tertiary"
            theme="borderless"
            onClick={dismissHint}
          >
            {t("got_it")}
          </Button>
        </div>
      )}

      <div className="sticky top-0 z-10 -mx-4 bg-zinc-50 px-4 pb-2 pt-1 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center mb-2.5">
          <div className="text-md font-semibold break-keep">{t("name")}:</div>
          <Input
            value={data.name}
            validateStatus={data.name.trim() === "" ? "error" : "default"}
            placeholder={t("name")}
            className="ms-2"
            readonly={layout.readOnly}
            onChange={(value) => updateTable(data.id, { name: value })}
            onFocus={(e) => setEditField({ name: e.target.value })}
            onBlur={(e) => {
              if (e.target.value === editField.name) return;
              setUndoStack((prev) => [
                ...prev,
                {
                  action: Action.EDIT,
                  element: ObjectType.TABLE,
                  component: "self",
                  tid: data.id,
                  undo: editField,
                  redo: { name: e.target.value },
                  message: t("edit_table", {
                    tableName: e.target.value,
                    extra: "[name]",
                  }),
                },
              ]);
              setRedoStack([]);
            }}
          />
        </div>
      </div>

      <SortableList
        items={data.fields}
        keyPrefix={`table-${data.id}`}
        onChange={(newFields) =>
          setTables((prev) =>
            prev.map((t) =>
              t.id === data.id ? { ...t, fields: newFields } : t,
            ),
          )
        }
        afterChange={() => setSaveState(State.SAVING)}
        renderItem={(item, i) => (
          <TableField
            data={item}
            tid={data.id}
            index={i}
            inherited={inheritedFieldNames.includes(item.name)}
          />
        )}
      />

      {database === DB.POSTGRES && (
        <div className="mb-2">
          <div className="text-md font-semibold break-keep">
            {t("inherits")}:
          </div>
          <Select
            multiple
            value={data.inherits || []}
            optionList={tables
              .filter((t) => t.id !== data.id)
              .map((t) => ({ label: t.name, value: t.name }))}
            onChange={(value) => {
              if (layout.readOnly) return;

              setUndoStack((prev) => [
                ...prev,
                {
                  action: Action.EDIT,
                  element: ObjectType.TABLE,
                  component: "self",
                  tid: data.id,
                  undo: { inherits: data.inherits },
                  redo: { inherits: value },
                  message: t("edit_table", {
                    tableName: data.name,
                    extra: "[inherits]",
                  }),
                },
              ]);
              setRedoStack([]);
              updateTable(data.id, { inherits: value });
            }}
            placeholder={t("inherits")}
            className="w-full"
          />
        </div>
      )}

      {data.indices.length > 0 && (
        <Card
          bodyStyle={{ padding: "4px" }}
          style={{ marginTop: "12px", marginBottom: "12px" }}
          headerLine={false}
        >
          <Collapse
            activeKey={indexActiveKey}
            keepDOM={false}
            lazyRender
            onChange={(itemKey) => setIndexActiveKey(itemKey)}
            accordion
          >
            <Collapse.Panel header={t("indices")} itemKey="1">
              {data.indices.map((idx, k) => (
                <IndexDetails
                  key={"index_" + k}
                  data={idx}
                  iid={k}
                  tid={data.id}
                  fields={data.fields.map((e) => ({
                    value: e.name,
                    label: e.name,
                  }))}
                />
              ))}
            </Collapse.Panel>
          </Collapse>
        </Card>
      )}

      {(data.uniqueConstraints || []).length > 0 && (
        <Card
          bodyStyle={{ padding: "4px" }}
          style={{ marginTop: "12px", marginBottom: "12px" }}
          headerLine={false}
        >
          <Collapse
            activeKey={uniqueActiveKey}
            keepDOM={false}
            lazyRender
            onChange={(itemKey) => setUniqueActiveKey(itemKey)}
            accordion
          >
            <Collapse.Panel header={t("unique_constraints")} itemKey="1">
              {data.uniqueConstraints.map((uc, k) => (
                <UniqueConstraintDetails
                  key={"unique_constraint_" + k}
                  data={uc}
                  cid={k}
                  tid={data.id}
                  fields={data.fields.map((e) => ({
                    value: e.name,
                    label: e.name,
                  }))}
                />
              ))}
            </Collapse.Panel>
          </Collapse>
        </Card>
      )}

      {((data.comment && data.comment.trim() !== "") || showComment) && (
        <Card
          bodyStyle={{ padding: "4px" }}
          style={{ marginTop: "12px", marginBottom: "12px" }}
          headerLine={false}
        >
          <Collapse
            activeKey={commentActiveKey}
            onChange={(itemKey) => setCommentActiveKey(itemKey)}
            keepDOM={false}
            lazyRender
            accordion
          >
            <Collapse.Panel header={t("comment")} itemKey="1">
              <TextArea
                field="comment"
              value={data.comment}
              readonly={layout.readOnly}
              autosize
              placeholder={t("comment")}
              rows={1}
              onChange={(value) =>
                updateTable(data.id, { comment: value }, false)
              }
              onFocus={(e) => setEditField({ comment: e.target.value })}
              onBlur={(e) => {
                if (e.target.value === editField.comment) return;
                setUndoStack((prev) => [
                  ...prev,
                  {
                    action: Action.EDIT,
                    element: ObjectType.TABLE,
                    component: "self",
                    tid: data.id,
                    undo: editField,
                    redo: { comment: e.target.value },
                    message: t("edit_table", {
                      tableName: e.target.value,
                      extra: "[comment]",
                    }),
                  },
                ]);
                setRedoStack([]);
              }}
              />
            </Collapse.Panel>
          </Collapse>
        </Card>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 mt-5 border-t border-zinc-200 bg-zinc-50 px-4 py-2 shadow-[0_-1px_0_0_rgba(0,0,0,0.04)]">
        <div className="flex justify-between items-center gap-1">
          <ColorPicker
            usePopover={true}
            readOnly={layout.readOnly}
            value={data.color}
            onChange={(color) => updateTable(data.id, { color })}
            onColorPick={(color) => handleColorPick(color)}
          />
          <div className="flex gap-1">
            <Dropdown
              position="bottomLeft"
              trigger="click"
              render={
                <Dropdown.Menu>
                  <Dropdown.Item onClick={addComment}>
                    {t("add_comment")}
                  </Dropdown.Item>
                  <Dropdown.Item onClick={addUniqueConstraint}>
                    {t("add_unique_constraint")}
                  </Dropdown.Item>
                  <Dropdown.Item onClick={addIndex}>
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
            <Button
              block
              disabled={layout.readOnly}
              onClick={() => {
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
              }}
            >
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
              onClick={() => {
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
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
