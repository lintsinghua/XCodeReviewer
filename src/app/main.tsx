import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/assets/styles/globals.css";
import App from "./App.tsx";
import { AppWrapper } from "@/components/layout/PageMeta";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppWrapper>
      <App />
    </AppWrapper>
  </StrictMode>
);
