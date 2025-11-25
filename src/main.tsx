import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "virtual:uno.css";
import App from "./App.tsx";
import { HashRouter } from "react-router";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import SessionStorageService from "./services/sessionStorage";
import VConsole from "vconsole";

new VConsole();

// 页面加载时清空 sessionStorage 中的视频 ID
SessionStorageService.clearAllVideoIds();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <ConfigProvider locale={zhCN}>
        <App />
      </ConfigProvider>
    </HashRouter>
  </StrictMode>
);
