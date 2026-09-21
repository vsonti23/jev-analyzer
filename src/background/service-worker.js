import { DEFAULT_CONNECTION, DEFAULT_POLICY, DEFAULT_PROFILE } from "../shared/contracts.js";

const SETTINGS_KEY = "settings";

async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return {
    profile: { ...DEFAULT_PROFILE, ...(stored[SETTINGS_KEY]?.profile || {}) },
    policy: { ...DEFAULT_POLICY, ...(stored[SETTINGS_KEY]?.policy || {}) },
    connection: { ...DEFAULT_CONNECTION, ...(stored[SETTINGS_KEY]?.connection || {}) }
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SETTINGS") {
    getSettings().then(sendResponse);
    return true;
  }
  if (message.type === "SAVE_SETTINGS") {
    const settings = message.settings;
    chrome.storage.local.set({ [SETTINGS_KEY]: settings }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "PAGE_RESULTS") {
    const tabId = sender.tab?.id;
    if (tabId) chrome.storage.session.set({ ["scan:" + tabId]: message.results });
    sendResponse({ ok: true });
  }
  if (message.type === "CLASSIFY_JOB") {
    getSettings().then(async (settings) => {
      const endpoint = new URL("/v1/classify", settings.connection.backendUrl).toString();
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job: message.job, profile: settings.profile }) });
      if (!response.ok) throw new Error("Classifier returned " + response.status);
      return response.json();
    }).then((result) => sendResponse({ ok: true, result })).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return undefined;
});
