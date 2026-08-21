import ReactDOM from "react-dom/client";
import { LocaleProvider } from "@douyinfe/semi-ui";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";
import en_US from "@douyinfe/semi-ui/lib/es/locale/source/en_US";
import "./index.css";
import "./i18n/i18n.js";

// 浏览器扩展 "Could not establish connection. Receiving end does not exist." 噪音
// 的过滤逻辑在 index.html <head> 的内联脚本里优先注册；这里保留一个兜底监听，
// 处理在内联脚本注册后才发生的扩展错误（main.jsx 是模块、晚于内联脚本加载）。
window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason;
  const message =
    (reason && reason.message) ||
    (typeof reason === "string" ? reason : "") ||
    "";
  if (message.includes("Could not establish connection")) {
    event.preventDefault();
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <LocaleProvider locale={en_US}>
    <App />
    <Analytics />
  </LocaleProvider>,
);
