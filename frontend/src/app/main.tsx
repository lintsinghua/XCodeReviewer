import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/assets/styles/globals.css";
import App from "./App.tsx";
import { AppWrapper } from "@/components/layout/PageMeta";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import "@/shared/utils/fetchWrapper"; // 初始化fetch拦截器

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppWrapper>
        <App />
      </AppWrapper>
    </ErrorBoundary>
  </StrictMode>
);
