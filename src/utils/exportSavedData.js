import JSZip from "jszip";
import { diagramsApi } from "../api/diagrams";
import { templatesApi } from "../api/templates";
import { saveAs } from "file-saver";

const zip = new JSZip();

const formatDiagram = (diagram) => {
  const formattedDiagram = { ...diagram };
  formattedDiagram.relationships = diagram.references;
  formattedDiagram.subjectAreas = diagram.areas;

  delete formattedDiagram.references;
  delete formattedDiagram.areas;

  return formattedDiagram;
};

export async function exportSavedData() {
  const diagramsFolder = zip.folder("diagrams");
  const diagrams = await diagramsApi.list();
  for (const diagram of diagrams) {
    diagramsFolder.file(
      `${diagram.name}(${diagram.id || diagram.diagramId}).json`,
      JSON.stringify(formatDiagram(diagram), null, 2),
    );
  }

  const templatesFolder = zip.folder("templates");
  const customTemplates = await templatesApi.list(1);
  for (const template of customTemplates) {
    templatesFolder.file(
      `${template.title}(${template.id || template.templateId}).json`,
      JSON.stringify(formatDiagram(template), null, 2),
    );
  }

  const content = await zip.generateAsync({ type: "blob" });
  const date = new Date();
  saveAs(
    content,
    `${date.getFullYear()}_${date.getMonth()}_${date.getDay()}_export.zip`,
  );
}
