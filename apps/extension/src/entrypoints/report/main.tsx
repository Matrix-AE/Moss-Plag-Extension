import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@moss/ui/tokens.css";
import "@moss/ui/typography.css";
import "@moss/ui/interaction.css";
import "../../styles/base.css";
import { Report } from "./Report";

const container = document.getElementById("root");
if (!container) {
  throw new Error("report root element missing");
}

createRoot(container).render(
  <StrictMode>
    <Report />
  </StrictMode>,
);
