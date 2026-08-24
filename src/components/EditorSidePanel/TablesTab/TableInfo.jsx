import { useState } from "react";
import {
  Collapse,
  TextArea,
  Button,
  Card,
  Select,
} from "@douyinfe/semi-ui";
import { IconAlertTriangle } from "@douyinfe/semi-icons";
import {
  useDiagram,
  useLayout,
  useSaveState,
  useUndoRedo,
} from "../../../hooks";
import { Action, ObjectType, State, DB } from "../../../data/constants";
import TableField from "./TableField";
import IndexDetails from "./IndexDetails";
import UniqueConstraintDetails from "./UniqueConstraintDetails";
import { useTranslation } from "react-i18next";
import { SortableList } from "../../SortableList/SortableList";

const TABLE_MODAL_HINT_KEY = "drawdb.tableModalHintShown";

export default function TableInfo({
  data,
  indexPanelKey,
  setIndexPanelKey,
  uqPanelKey,
  setUqPanelKey,
  commentPanelKey,
  setCommentPanelKey,
  showComment,
}) {
  const { tables, database } = useDiagram();
  const { t } = useTranslation();
  const [hintDismissed, setHintDismissed] = useState(() => {
    try {
      return localStorage.getItem(TABLE_MODAL_HINT_KEY) === "1";
    } catch {
      return true;
    }
  });
  const { layout } = useLayout();
  const { updateTable, setTables } = useDiagram();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const { setSaveState } = useSaveState();
  const [editField, setEditField] = useState({});

  const dismissHint = () => {
    setHintDismissed(true);
    try {
      localStorage.setItem(TABLE_MODAL_HINT_KEY, "1");
    } catch {
      /* localStorage 不可用时静默 */
    }
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
            activeKey={indexPanelKey}
            keepDOM={false}
            lazyRender
            onChange={(itemKey) => setIndexPanelKey(itemKey)}
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
            activeKey={uqPanelKey}
            keepDOM={false}
            lazyRender
            onChange={(itemKey) => setUqPanelKey(itemKey)}
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
            activeKey={commentPanelKey}
            onChange={(itemKey) => setCommentPanelKey(itemKey)}
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
    </div>
  );
}
