import ReactDOM from "react-dom/client";
import { LocaleProvider } from "@douyinfe/semi-ui";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";
import en_US from "@douyinfe/semi-ui/lib/es/locale/source/en_US";
import "./index.css";
import "./i18n/i18n.js";

// 过滤掉浏览器扩展抛出的 "Could not establish connection. Receiving end does not exist."
// 错误（chrome.runtime.connect 找不到 background service worker）。
// 与 drawDB 应用代码无关（应用未使用任何 chrome.runtime/postMessage API），
// 但会污染控制台导致误判。仅消息完全匹配时才吞掉。
window.addEventListener("unhandledrejection", (event) => {
  const message = String(
    event?.reason?.message || event?.reason || "",
  );
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
