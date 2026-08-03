import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@moss/ui/tokens.css";
import "@moss/ui/typography.css";
import "@moss/ui/interaction.css";
import "../../styles/base.css";
import { Sidepanel } from "./Sidepanel";

const container = document.getElementById("root");
if (!container) {
  throw new Error("sidepanel root element missing");
}

createRoot(container).render(
  <StrictMode>
    <Sidepanel />
  </StrictMode>,
);
