import { dbToTypes } from "../../data/datatypes";
import {
  buildFieldComment,
  parseDefault,
  uniqueConstraintClause,
  getFkColumnNames,
} from "./shared";

export function toOracleSQL(diagram) {
  return `${diagram.tables
    .map(
      (table) => {
        const fieldComments = new Map();
        table.fields.forEach((f) => fieldComments.set(f.id, buildFieldComment(f)));
        return `${
          table.comment === "" ? "" : `/* ${table.comment} */\n`
        }CREATE TABLE "${table.name}" (\n${table.fields
          .map(
            (field) => {
              const fc = fieldComments.get(field.id);
              const fcLines = fc
                ? fc
                    .split("\n")
                    .map((l) => `\t-- ${l}\n`)
                    .join("")
                : "";
              return `${fcLines}\t"${field.name}" ${field.type}${
                field.size !== undefined && field.size !== ""
                  ? "(" + field.size + ")"
                  : ""
              }${field.notNull ? " NOT NULL" : ""}${
                field.increment ? " GENERATED ALWAYS AS IDENTITY" : ""
              }${field.unique ? " UNIQUE" : ""}${
                field.default !== ""
                  ? ` DEFAULT ${parseDefault(field, diagram.database)}`
                  : ""
              }${
                field.check === "" ||
                !dbToTypes[diagram.database][field.type].hasCheck
                  ? ""
                  : ` CHECK(${field.check})`
              }`;
            }
          )
          .join(",\n")}${
          table.fields.filter((f) => f.primary).length > 0
            ? `,\n\tPRIMARY KEY(${table.fields
                .filter((f) => f.primary)
                .map((f) => `"${f.name}"`)
                .join(", ")})`
            : ""
          }${uniqueConstraintClause(table, (s) => `"${s}"`)}\n)${table.comment ? ` -- ${table.comment}` : ""};\n${`\n${table.indices
          .map(
            (i) =>
              `\nCREATE ${i.unique ? "UNIQUE " : ""}INDEX "${i.name}"\nON "${table.name}" (${i.fields
                .map((f) => `"${f}"`)
                .join(", ")});`,
          )
          .join("")}`}`;
      }
    )
    .join("\n")}\n${diagram.references
    .map((r) => {
      const { name: startName, fields: startFields } = diagram.tables.find(
        (t) => t.id === r.startTableId,
      );
      const endTable = diagram.tables.find((t) => t.id === r.endTableId);
      const { name: endName } = endTable;
      const { startColumns, endColumns } = getFkColumnNames(
        r,
        { fields: startFields },
        endTable,
      );
      return `ALTER TABLE "${startName}"\nADD CONSTRAINT "${r.name}" FOREIGN KEY (${startColumns
        .map((c) => `"${c}"`)
        .join(", ")}) REFERENCES "${endName}" (${endColumns
        .map((c) => `"${c}"`)
        .join(", ")})\nON UPDATE ${r.updateConstraint.toUpperCase()} ON DELETE ${r.deleteConstraint.toUpperCase()};`;
    })
    .join("\n")}`;
}
