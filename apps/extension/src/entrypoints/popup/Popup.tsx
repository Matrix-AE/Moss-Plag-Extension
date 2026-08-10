import { WorkflowApp } from "../../shared/workflow/WorkflowApp";

/** Toolbar panel: account, plan, Moss ID, status. File work moves to the run window. */
export function Popup() {
  return <WorkflowApp surface="popup" />;
}
