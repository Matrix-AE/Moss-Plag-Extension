import { WorkflowApp } from "../../shared/workflow/WorkflowApp";

/**
 * Run window: the popup cannot host a file chooser (Chrome destroys a browser-action popup
 * when the OS dialog takes focus), so file selection and runs happen on this page.
 */
export function Workspace() {
  return <WorkflowApp surface="page" />;
}
