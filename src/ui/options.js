import { DEFAULT_POLICY, DEFAULT_PROFILE, normalizeLines } from "../shared/contracts.js";
const form = document.getElementById("profile-form");
const saved = document.getElementById("saved");

function fill(settings) { for (const [key, value] of Object.entries(settings.profile)) { const input = form.elements[key]; if (!input) continue; input.value = Array.isArray(value) ? value.join("\n") : (value ?? ""); input.checked = Boolean(value); } for (const [key, value] of Object.entries(settings.policy)) { const input = form.elements[key]; if (!input) continue; input.value = Array.isArray(value) ? value.join("\n") : value; input.checked = Boolean(value); } }
async function load() { const settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" }); fill({ profile: { ...DEFAULT_PROFILE, ...settings.profile }, policy: { ...DEFAULT_POLICY, ...settings.policy } }); }
form.addEventListener("submit", async (event) => { event.preventDefault(); const data = new FormData(form); const settings = { profile: { targetRoles: normalizeLines(data.get("targetRoles")), skills: normalizeLines(data.get("skills")), yearsExperience: data.get("yearsExperience") ? Number(data.get("yearsExperience")) : null, needsSponsorship: data.get("needsSponsorship") === "on" }, policy: { minimumFit: Number(data.get("minimumFit")), maxAgeHours: Number(data.get("maxAgeHours")), allowedLocations: normalizeLines(data.get("allowedLocations")), hideSkipped: data.get("hideSkipped") === "on" } }; await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings }); saved.textContent = "Saved"; setTimeout(() => { saved.textContent = ""; }, 1600); });
load();

