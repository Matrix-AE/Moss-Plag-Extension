import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@moss/ui/tokens.css";
import "@moss/ui/typography.css";
import "@moss/ui/interaction.css";
import "../../styles/base.css";
import { Settings } from "./Settings";

const container = document.getElementById("root");
if (!container) {
  throw new Error("settings root element missing");
}

createRoot(container).render(
  <StrictMode>
    <Settings />
  </StrictMode>,
);
