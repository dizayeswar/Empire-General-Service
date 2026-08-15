import { DEPT_BY_ACTION, TRASH_ACTIONS } from "./config.ts";
import {
  AuthOk,
  enrichAuthRole,
  handleGetPerms,
  handleLogin,
  verifyPassword,
  verifyToken,
  verifyTokenSession,
} from "./auth.ts";
import { isCivilWorkerId, isCleaningSupervisorRole, isElectricWorkerId, normalizeWorkerId } from "./helpers.ts";
import * as cleaning from "./handlers_cleaning.ts";
import * as issues from "./handlers_issues.ts";
import * as jobs from "./handlers_jobs.ts";
import * as misc from "./handlers_misc.ts";
import * as users from "./handlers_users.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") {
    return json({ ok: true, msg: "Empire API running (Supabase)", version: "2026-08-09-supabase-v1" });
  }
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json() as Record<string, unknown>;
    const action = String(body.action || "");

    // Fast path (no dept token required beyond what's in handler)
    if (action === "saveWorkerPushToken") return json(await misc.handleSaveWorkerPushToken(body));
    if (action === "testWorkerPush") return json(await misc.handleTestWorkerPush());
    if (action === "debugWorkerPush") return json(await misc.handleDebugWorkerPush());
    if (action === "login" || action === "verifyLogin") return json(await handleLogin(body));
    if (action === "verifyPassword") return json(await verifyPassword(body));
    if (action === "getPerms") return json(await handleGetPerms(body));
    if (action === "getSummary") return json(await misc.handleGetSummary(body));

    const adminUserActions: Record<string, number> = {
      listUsers: 1,
      createUser: 1,
      updateUser: 1,
      deleteUser: 1,
    };
    if (adminUserActions[action]) {
      let adminAuth = await verifyTokenSession(String(body.token || ""));
      if (!adminAuth.ok) return json(adminAuth);
      adminAuth = await enrichAuthRole(adminAuth as AuthOk);
      const a = adminAuth as AuthOk;
      if (action === "listUsers") return json(await users.handleListUsers(a));
      if (action === "createUser") return json(await users.handleCreateUser(body, a));
      if (action === "updateUser") return json(await users.handleUpdateUser(body, a));
      if (action === "deleteUser") return json(await users.handleDeleteUser(body, a));
    }

    const requiredDept = TRASH_ACTIONS[action] ? String(body.dept || "") : DEPT_BY_ACTION[action];
    if (!requiredDept) return json({ ok: false, error: "Unknown action" });

    const electricIssueActions: Record<string, number> = {
      addElectricIssue: 1, updateElectricIssue: 1, getElectricIssues: 1, markElectricFixed: 1,
      clearElectricIssues: 1, deleteElectricIssue: 1, assignElectricIssue: 1, markElectricNotDept: 1,
      restoreElectricIssue: 1, setElectricFixDelay: 1,
    };
    const civilIssueActions: Record<string, number> = {
      addCivilIssue: 1, updateCivilIssue: 1, getCivilIssues: 1, markCivilFixed: 1,
      clearCivilIssues: 1, deleteCivilIssue: 1, assignCivilIssue: 1, markCivilNotDept: 1,
      restoreCivilIssue: 1, setCivilFixDelay: 1,
    };

    let auth;
    if (action === "getWorkerLocations" || action === "reportWorkerLocation") {
      auth = await verifyToken(String(body.token || ""), "civil issue");
      if (!auth.ok) auth = await verifyToken(String(body.token || ""), "civil department");
      if (!auth.ok) auth = await verifyToken(String(body.token || ""), "electric issue");
      if (!auth.ok) auth = await verifyToken(String(body.token || ""), "electrical department");
      if (!auth.ok) auth = await verifyToken(String(body.token || ""), "cleaning");
    } else if (action === "getElectricWorkerReports" || action === "transferElectricIssueCompletion") {
      auth = await verifyToken(String(body.token || ""), "electrical department");
      if (!auth.ok) auth = await verifyToken(String(body.token || ""), "electric issue");
    } else if (
      action === "getCivilWorkerReports" ||
      action === "transferCivilIssueCompletion" ||
      action === "transferCivilWorkerReport"
    ) {
      auth = await verifyToken(String(body.token || ""), "civil department");
      if (!auth.ok) auth = await verifyToken(String(body.token || ""), "civil issue");
    } else if (electricIssueActions[action]) {
      auth = await verifyToken(String(body.token || ""), "electric issue");
      if (!auth.ok) auth = await verifyToken(String(body.token || ""), "electrical department");
    } else if (civilIssueActions[action]) {
      auth = await verifyToken(String(body.token || ""), "civil issue");
      if (!auth.ok) auth = await verifyToken(String(body.token || ""), "civil department");
    } else {
      auth = await verifyToken(String(body.token || ""), requiredDept);
    }
    if (!auth.ok) return json(auth);
    auth = await enrichAuthRole(auth as AuthOk);

    body.username = auth.username;
    body._authRole = String(auth.role || "").toLowerCase();
    body._authTrade = String(auth.trade || "").toLowerCase();

    if (body._authRole === "worker") {
      const workerBlocked: Record<string, number> = {
        addCivilIssue: 1, updateCivilIssue: 1, deleteCivilIssue: 1, clearCivilIssues: 1,
        assignCivilIssue: 1, markCivilNotDept: 1, restoreCivilIssue: 1, setCivilFixDelay: 1,
        getWorkerLocations: 1, addElectricIssue: 1, updateElectricIssue: 1, deleteElectricIssue: 1,
        clearElectricIssues: 1, assignElectricIssue: 1, markElectricNotDept: 1, restoreElectricIssue: 1,
        setElectricFixDelay: 1, deleteElectricWorkerReport: 1, deleteCivilWorkerReport: 1,
        addFireIssue: 1, updateFireIssue: 1, deleteFireIssue: 1, clearFireIssues: 1,
      };
      if (workerBlocked[action]) {
        return json({ ok: false, success: false, error: "not_allowed", message: "Not allowed for worker accounts." });
      }
    }
    if (isCleaningSupervisorRole(body._authRole)) {
      const blocked: Record<string, number> = {
        clearAll: 1, resetTasks: 1, getTrash: 1, restoreTrash: 1, purgeTrash: 1,
        deleteReport: 1, deleteTaskPhoto: 1, saveUiSettings: 1, sendCleaningReminder: 1,
      };
      if (blocked[action]) {
        return json({
          ok: false, success: false, error: "not_allowed",
          message: "Not allowed for cleaning supervisor accounts.",
        });
      }
    }
    if (
      action === "reportWorkerLocation" &&
      body._authRole !== "worker" &&
      !isCleaningSupervisorRole(body._authRole)
    ) {
      return json({
        ok: false, success: false, error: "not_allowed",
        message: "Only worker or cleaning supervisor accounts can report location.",
      });
    }
    if (action === "addElectricWorkerReport" || action === "updateElectricWorkerReportInvoice") {
      if (body._authRole !== "worker") {
        return json({ ok: false, success: false, error: "not_allowed", message: "Only electric workers can submit field reports." });
      }
      if (!isElectricWorkerId(String(body.username))) {
        return json({ ok: false, success: false, error: "not_allowed", message: "This account is not an electric field worker." });
      }
    }
    if (action === "addCivilWorkerReport" || action === "updateCivilWorkerReportInvoice") {
      if (body._authRole !== "worker") {
        return json({ ok: false, success: false, error: "not_allowed", message: "Only civil workers can submit field reports." });
      }
      if (!isCivilWorkerId(String(body.username))) {
        return json({ ok: false, success: false, error: "not_allowed", message: "This account is not a civil field worker." });
      }
    }

    const adminOnly: Record<string, number> = {
      saveUiSettings: 1, clearElectricalJobs: 1, clearCivilJobs: 1, clearCivilIssues: 1,
      clearElectricIssues: 1, clearFireIssues: 1, clearHseInspections: 1, clearAll: 1,
      getTrash: 1, restoreTrash: 1, purgeTrash: 1,
    };
    if (adminOnly[action] && String(auth.role || "").toLowerCase() !== "admin") {
      return json({ ok: false, success: false, error: "not_allowed", message: "Only an admin can do that." });
    }

    const a = auth as AuthOk;
    switch (action) {
      case "saveReport": return json(await cleaning.handleSaveReport(body));
      case "getReports": return json(await cleaning.handleGetReports(body));
      case "deleteReport": return json(await cleaning.handleDeleteReport(body));
      case "saveTasks": return json(await cleaning.handleSaveTasks(body));
      case "getTasks": return json(await cleaning.handleGetTasks(body));
      case "setTask": return json(await cleaning.handleSetTask(body));
      case "resetTasks": return json(await cleaning.handleResetTasks(body));
      case "clearAll": return json(await cleaning.handleClearAll(body));
      case "getWeekCoverage": return json(await cleaning.handleGetWeekCoverage(body));
      case "markTaskWeek": return json(await cleaning.handleMarkTaskWeek(body));
      case "getRangeCoverage": return json(await cleaning.handleGetRangeCoverage(body));
      case "getTaskPhotos": return json(await cleaning.handleGetTaskPhotos(body));
      case "addTaskPhoto": return json(await cleaning.handleAddTaskPhoto(body));
      case "addTaskPhotos": return json(await cleaning.handleAddTaskPhotos(body));
      case "deleteTaskPhoto": return json(await cleaning.handleDeleteTaskPhoto(body));
      case "logTask": return json(await cleaning.handleLogTask(body));
      case "getTaskLog": return json(await cleaning.handleGetTaskLog(body));
      case "sendCleaningReminder": return json(await misc.handleSendCleaningReminder(body));
      case "notifyCleaningWeekUnlock": return json(await misc.handleNotifyCleaningWeekUnlock());
      case "getUiSettings": return json(await misc.handleGetUiSettings());
      case "saveUiSettings": return json(await misc.handleSaveUiSettings(body));

      case "addCivilIssue": return json(await issues.handleAddIssue(body, "civil_issues"));
      case "updateCivilIssue": return json(await issues.handleUpdateIssue(body, "civil_issues"));
      case "getCivilIssues": return json(await issues.handleGetIssues(body, "civil_issues", a));
      case "assignCivilIssue": return json(await issues.handleAssignCivilIssue(body, a));
      case "markCivilNotDept": return json(await issues.handleRouteCivilNotDept(body, a));
      case "restoreCivilIssue": return json(await issues.handleRestoreCivilIssue(body, a));
      case "setCivilFixDelay": return json(await issues.handleSetCivilFixDelay(body, a));
      case "reportWorkerLocation": return json(await misc.handleReportWorkerLocation(body, a));
      case "getWorkerLocations": return json(await misc.handleGetWorkerLocations(body, a));
      case "markCivilFixed": return json(await issues.handleMarkFixed(body, "civil_issues", a));
      case "clearCivilIssues": return json(await issues.handleClearIssues(body, "civil_issues"));
      case "deleteCivilIssue": return json(await issues.handleDeleteIssue(body, "civil_issues"));

      case "addElectricIssue": return json(await issues.handleAddIssue(body, "electric_issues"));
      case "updateElectricIssue": return json(await issues.handleUpdateIssue(body, "electric_issues"));
      case "getElectricIssues": return json(await issues.handleGetIssues(body, "electric_issues", a));
      case "assignElectricIssue": return json(await issues.handleAssignElectricIssue(body, a));
      case "markElectricNotDept": return json(await issues.handleRouteElectricNotDept(body, a));
      case "restoreElectricIssue": return json(await issues.handleRestoreElectricIssue(body, a));
      case "setElectricFixDelay": return json(await issues.handleSetElectricFixDelay(body, a));
      case "markElectricFixed": return json(await issues.handleMarkFixed(body, "electric_issues", a));
      case "clearElectricIssues": return json(await issues.handleClearIssues(body, "electric_issues"));
      case "deleteElectricIssue": return json(await issues.handleDeleteIssue(body, "electric_issues"));

      case "addFireIssue": return json(await issues.handleAddIssue(body, "fire_issues"));
      case "updateFireIssue": return json(await issues.handleUpdateIssue(body, "fire_issues"));
      case "getFireIssues": return json(await issues.handleGetIssues(body, "fire_issues"));
      case "markFireFixed": return json(await issues.handleMarkFixed(body, "fire_issues", a));
      case "clearFireIssues": return json(await issues.handleClearIssues(body, "fire_issues"));
      case "deleteFireIssue": return json(await issues.handleDeleteIssue(body, "fire_issues"));

      case "addHseInspection": return json(await issues.handleAddHseInspection(body));
      case "updateHseInspection": return json(await issues.handleUpdateHseInspection(body));
      case "getHseInspections": return json(await issues.handleGetHseInspections(body));
      case "markHseResolved": return json(await issues.handleMarkFixed(body, "hse_inspections", a));
      case "clearHseInspections": return json(await issues.handleClearIssues(body, "hse_inspections"));
      case "deleteHseInspection": return json(await issues.handleDeleteIssue(body, "hse_inspections"));

      case "addElectricalJob": return json(await jobs.handleAddElectricalJob(body));
      case "getElectricalJobs": return json(await jobs.handleGetElectricalJobs(body));
      case "updateElectricalJob": return json(await jobs.handleUpdateElectricalJob(body));
      case "deleteElectricalJob": return json(await jobs.handleDeleteElectricalJob(body));
      case "clearElectricalJobs": return json(await jobs.handleClearElectricalJobs(body));
      case "getElectricalSummary": return json(await jobs.handleGetElectricalSummary(body));
      case "saveElectricalSummary": return json(await jobs.handleSaveElectricalSummary(body));
      case "getElectricWorkerReports": return json(await jobs.handleGetElectricWorkerReports(body, a));
      case "addElectricWorkerReport": return json(await jobs.handleAddElectricWorkerReport(body, a));
      case "updateElectricWorkerReportInvoice": return json(await jobs.handleUpdateElectricWorkerReportInvoice(body, a));
      case "deleteElectricWorkerReport": return json(await jobs.handleDeleteElectricWorkerReport(body, a));
      case "transferElectricWorkerReport": return json(await jobs.handleTransferElectricWorkerReport(body, a));
      case "transferElectricIssueCompletion": return json(await jobs.handleTransferElectricIssueCompletion(body, a));
      case "transferCivilIssueCompletion": return json(await jobs.handleTransferCivilIssueCompletion(body, a));
      case "getCivilWorkerReports": return json(await jobs.handleGetCivilWorkerReports(body, a));
      case "addCivilWorkerReport": return json(await jobs.handleAddCivilWorkerReport(body, a));
      case "updateCivilWorkerReportInvoice": return json(await jobs.handleUpdateCivilWorkerReportInvoice(body, a));
      case "deleteCivilWorkerReport": return json(await jobs.handleDeleteCivilWorkerReport(body, a));
      case "transferCivilWorkerReport": return json(await jobs.handleTransferCivilWorkerReport(body, a));

      case "addCivilJob": return json(await jobs.handleAddCivilJob(body));
      case "getCivilJobs": return json(await jobs.handleGetCivilJobs(body));
      case "updateCivilJob": return json(await jobs.handleUpdateCivilJob(body));
      case "deleteCivilJob": return json(await jobs.handleDeleteCivilJob(body));
      case "clearCivilJobs": return json(await jobs.handleClearCivilJobs(body));
      case "getCivilSummary": return json(await jobs.handleGetCivilSummary(body));
      case "saveCivilSummary": return json(await jobs.handleSaveCivilSummary(body));

      case "getAsaasItems": return json(await misc.handleGetAsaasItems());
      case "addAsaasItem": return json(await misc.handleAddAsaasItem(body, a));
      case "updateAsaasItem": return json(await misc.handleUpdateAsaasItem(body, a));
      case "markAsaasReturned": return json(await misc.handleMarkAsaasReturned(body, a));
      case "deleteAsaasItem": return json(await misc.handleDeleteAsaasItem(body));
      case "clearAsaasItems": return json(await misc.handleClearAsaasItems());

      case "getApplicationChecks": return json(await misc.handleGetApplicationChecks(body));
      case "getApplicationCheckMeta": return json(await misc.handleGetApplicationCheckMeta());
      case "getApplicationCheckDetail": return json(await misc.handleGetApplicationCheckDetail(body));
      case "updateApplicationCheck": return json(await misc.handleUpdateApplicationCheck(body, a));
      case "importApplicationChecks": return json(await misc.handleImportApplicationChecks(body, a));
      case "clearApplicationChecks": return json(await misc.handleClearApplicationChecks(body, a));

      case "getTrash": return json(await misc.handleGetTrash(body));
      case "restoreTrash": return json(await misc.handleRestoreTrash(body));
      case "purgeTrash": return json(await misc.handlePurgeTrash(body));

      default:
        return json({ ok: false, error: "Unhandled action" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: message });
  }
});

// keep verifyTokenSession available for summary
void verifyTokenSession;
void normalizeWorkerId;
