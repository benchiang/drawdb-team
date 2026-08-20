import { useSettings } from "../../../hooks";
import { useTemplates } from "../../../hooks/useTemplates";
import Thumbnail from "../../Thumbnail";
import { useTranslation } from "react-i18next";

export default function New({ selectedTemplateId, setSelectedTemplateId }) {
  const { settings } = useSettings();
  const { t } = useTranslation();
  const { items: templates } = useTemplates();

  return (
    <div className="grid grid-cols-3 gap-2 overflow-auto px-1">
      <div onClick={() => setSelectedTemplateId("blank")}>
        <div
          className={`rounded-md h-[180px] border-2 hover:border-dashed ${
            selectedTemplateId === "blank" ? "border-blue-400" : "border-zinc-400"
          }`}
        >
          <Thumbnail i="blank" diagram={{}} zoom={0.24} theme={settings.mode} />
        </div>
        <div className="text-center mt-1">{t("blank")}</div>
      </div>
      {(templates || []).map((temp) => (
        <div
          key={temp.templateId}
          onClick={() => setSelectedTemplateId(temp.templateId)}
        >
          <div
            className={`rounded-md h-[180px] border-2 hover:border-dashed ${
              selectedTemplateId === temp.templateId
                ? "border-blue-400"
                : "border-zinc-400"
            }`}
          >
            <Thumbnail
              i={temp.templateId}
              diagram={temp}
              zoom={0.24}
              theme={settings.mode}
            />
          </div>
          <div className="text-center mt-1">{temp.title}</div>
        </div>
      ))}
    </div>
  );
}
