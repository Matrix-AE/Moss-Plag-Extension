import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@moss/ui/tokens.css";
import "@moss/ui/typography.css";
import "@moss/ui/interaction.css";
import "../../styles/base.css";
import { Workspace } from "./Workspace";
import { ErrorBoundary } from "../../shared/ErrorBoundary";
import { applyTheme, loadThemePreference } from "../../shared/theme";

void loadThemePreference().then(applyTheme);

const container = document.getElementById("root");
if (!container) {
  throw new Error("workspace root element missing");
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <Workspace />
    </ErrorBoundary>
  </StrictMode>,
);
