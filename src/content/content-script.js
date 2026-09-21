import { enrichWithOpenDescription, extractLoadedJobs } from "./adapters.js";
import { applyJevAssessment, assessJob } from "./policy.js";

function badge(result) {
  const node = document.createElement("span");
  node.className = "job-sieve-badge job-sieve-" + result.decision;
  const rating = result.fit === null ? "" : result.fit.toFixed(1) + "/10 · ";
  node.textContent = rating + result.decision.toUpperCase() + (result.reasons[0] ? " · " + result.reasons[0] : "");
  return node;
}

function attachBadges(results, hideSkipped) {
  document.querySelectorAll(".job-sieve-badge").forEach((node) => node.remove());
  document.querySelectorAll("[data-job-sieve-hidden]").forEach((node) => { node.hidden = false; node.removeAttribute("data-job-sieve-hidden"); });
  for (const result of results) {
    const candidateLinks = [...document.querySelectorAll("a[href]")].filter((link) => link.href === result.job.url);
    const target = candidateLinks[0]?.closest("li, .job-card-container, .posting") || document.querySelector("[data-job-sieve-key='" + CSS.escape(result.key) + "']");
    if (!target) continue;
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
