import { enrichWithOpenDescription, extractLoadedJobs } from "./adapters.js";
import { applyJevAssessment, assessJob } from "./policy.js";

function badge(result) {
  const node = document.createElement("job-sieve-badge");
  node.className = "job-sieve-badge";
  const colors = { keep: "#00875a", skip: "#dc2626", check: "#f59e0b" };
  node.setAttribute("aria-label", result.decision === "keep" ? "Job Sieve: keep" : result.decision === "skip" ? "Job Sieve: skip" : "Job Sieve: check");
  node.title = node.getAttribute("aria-label");
  node.style.cssText = "all:initial !important;position:absolute !important;display:block !important;box-sizing:border-box !important;left:0 !important;top:0 !important;bottom:0 !important;width:3px !important;height:auto !important;margin:0 !important;padding:0 !important;border:0 !important;border-radius:2px 0 0 2px !important;background:" + colors[result.decision] + " !important;box-shadow:0 0 0 1px rgba(15,23,42,.2),1px 0 2px rgba(15,23,42,.18) !important;line-height:0 !important;z-index:2 !important;";
  const root = node.attachShadow({ mode: "closed" });
  root.append(document.createElement("span"));
  return node;
}

function attachBadges(results, hideSkipped) {
  document.querySelectorAll(".job-sieve-badge").forEach((node) => node.remove());
  document.querySelectorAll("[data-job-sieve-hidden]").forEach((node) => { node.hidden = false; node.removeAttribute("data-job-sieve-hidden"); });
  for (const result of results) {
    const candidateLinks = [...document.querySelectorAll("a[href]")].filter((link) => link.href === result.job.url);
    const target = candidateLinks[0]?.closest("li, .job-card-container, .posting") || document.querySelector("[data-job-sieve-key='" + CSS.escape(result.key) + "']");
    if (!target) continue;
    if (getComputedStyle(target).position === "static") target.style.position = "relative";
    target.append(badge(result));
    if (hideSkipped && result.decision === "skip") { target.hidden = true; target.dataset.jobSieveHidden = "true"; }
  }
}

async function scan() {
  const settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  const jobs = enrichWithOpenDescription(extractLoadedJobs());
  const localResults = jobs.map((job) => assessJob(job, settings.profile, settings.policy));
  const results = await Promise.all(localResults.map(async (local) => {
    if (local.decision === "skip" || !local.job.description) return local;
    const response = await chrome.runtime.sendMessage({ type: "CLASSIFY_JOB", job: local.job });
    return response.ok ? applyJevAssessment(local, response.result, settings.policy) : { ...local, decision: "check", fit: null, reasons: ["Classifier unavailable"] };
  }));
  attachBadges(results, settings.policy.hideSkipped);
  await chrome.runtime.sendMessage({ type: "PAGE_RESULTS", results });
  return results;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SCAN_PAGE") { scan().then((results) => sendResponse({ ok: true, results })); return true; }
  if (message.type === "RESTORE_SKIPPED") { attachBadges([], false); sendResponse({ ok: true }); }
  return undefined;
});
