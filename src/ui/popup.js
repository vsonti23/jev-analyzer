const $ = (id) => document.getElementById(id);

function update(results) {
  const counts = { keep: 0, skip: 0, check: 0 };
  results.forEach((result) => { counts[result.decision] += 1; });
  $("stats").hidden = false;
  $("loaded").textContent = results.length;
  ["keep", "skip", "check"].forEach((key) => { $(key).textContent = counts[key]; });
  $("status").textContent = results.length ? "Scan complete." : "No supported loaded job cards found.";
}

async function activeTab() { return (await chrome.tabs.query({ active: true, currentWindow: true }))[0]; }

async function scanTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "SCAN_PAGE" });
  } catch {
    // LinkedIn can finish its client-side navigation after Chrome's declarative
    // content-script injection point. A user-triggered activeTab injection is a
    // safe fallback and works for the page the user explicitly chose to scan.
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["src/content/badges.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["dist/content-script.js"] });
    return chrome.tabs.sendMessage(tabId, { type: "SCAN_PAGE" });
  }
}

$("scan").addEventListener("click", async () => {
  $("status").textContent = "Scanning loaded jobs…";
  const tab = await activeTab();
  try {
    const response = await scanTab(tab.id);
    update(response.results);
  } catch { $("status").textContent = "Open LinkedIn, Greenhouse, or Lever jobs first."; }
});
$("restore").addEventListener("click", async () => {
  const tab = await activeTab();
  try { await chrome.tabs.sendMessage(tab.id, { type: "RESTORE_SKIPPED" }); $("status").textContent = "Skipped jobs restored."; } catch { $("status").textContent = "Nothing to restore on this page."; }
});
$("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
