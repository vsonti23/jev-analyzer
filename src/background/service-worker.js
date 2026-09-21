import { DEFAULT_POLICY, DEFAULT_PROFILE } from "../shared/contracts.js";

const SETTINGS_KEY = "settings";

async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return {
    profile: { ...DEFAULT_PROFILE, ...(stored[SETTINGS_KEY]?.profile || {}) },
    policy: { ...DEFAULT_POLICY, ...(stored[SETTINGS_KEY]?.policy || {}) }
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
  return undefined;
});

