import { DECISIONS, jobKey } from "../shared/contracts.js";

const NO_SPONSORSHIP = /(?:no|cannot|can't|will not|won't|unable to)\s+(?:provide|offer|sponsor|support).{0,40}(?:visa|sponsorship)|(?:visa|sponsorship).{0,40}(?:not\s+(?:available|offered)|unavailable)/i;

function parseAgeHours(raw) {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  const match = value.match(/(\d+)\s*(minute|hour|day|week)s?\s+ago/);
  if (!match) return null;
  const units = { minute: 1 / 60, hour: 1, day: 24, week: 168 };
  return Number(match[1]) * units[match[2]];
}

function includesAny(haystack, needles) {
  const normalized = String(haystack || "").toLowerCase();
  return needles.some((item) => normalized.includes(item.toLowerCase()));
}

export function assessJob(job, profile, policy) {
  const reasons = [];
  const age = parseAgeHours(job.postedText);
  if (age !== null && age > policy.maxAgeHours) return result("skip", null, ["Too old"], job);
  if (age === null) reasons.push("Date unknown");

  const body = [job.title, job.description].filter(Boolean).join(" ");
  if (profile.needsSponsorship && NO_SPONSORSHIP.test(body)) return result("skip", null, ["No sponsorship"], job);
  if (profile.needsSponsorship && !job.description) reasons.push("Open description");

  if (policy.allowedLocations.length && job.location && !includesAny(job.location, policy.allowedLocations)) {
    return result("skip", null, ["Location filter"], job);
  }
  if (policy.allowedLocations.length && !job.location) reasons.push("Location unknown");

  const title = String(job.title || "");
  const titleTerms = profile.targetRoles.flatMap((role) => role.toLowerCase().split(/\W+/).filter((term) => term.length > 2));
  const roleMatches = titleTerms.filter((term) => title.toLowerCase().includes(term)).length;
  // Require only one meaningful title term locally. Exact role compatibility
  // belongs to Jev once the full description has been extracted.
  if (profile.targetRoles.length && titleTerms.length && roleMatches === 0) {
    return result("skip", null, ["Wrong role"], job);
  }
  if (!job.description) return result("check", null, reasons.length ? reasons : ["Open description"], job);

  // Placeholder for Jev: replace with an authenticated backend assessment in the next milestone.
  const skillHits = profile.skills.filter((skill) => includesAny(body, [skill])).length;
  const roleHit = profile.targetRoles.length ? Math.min(1, roleMatches / Math.max(1, titleTerms.length)) : 0.5;
  const skillScore = profile.skills.length ? skillHits / profile.skills.length : 0.5;
  const fit = Math.round((10 * (0.6 * roleHit + 0.4 * skillScore)) * 10) / 10;
  if (fit < policy.minimumFit) return result("skip", fit, ["Low match"], job);
  return result("keep", fit, reasons, job);
}

export function applyJevAssessment(local, classifier, policy) {
  if (local.decision === "skip") return local;
  if (!classifier?.adequateEvidence) return { ...local, decision: "check", fit: null, reasons: ["Uncertain"] };
  if (classifier.sponsorship === "unavailable") return { ...local, decision: "skip", fit: null, reasons: ["No sponsorship"] };
  const fit = Number(classifier.fit);
  if (!Number.isFinite(fit) || fit < 0 || fit > 10) return { ...local, decision: "check", fit: null, reasons: ["Invalid classification"] };
  if (classifier.confidence < 0.55) return { ...local, decision: "check", fit, reasons: ["Uncertain"] };
  return { ...local, fit, decision: fit >= policy.minimumFit ? "keep" : "skip", reasons: fit >= policy.minimumFit ? [] : ["Low match"] };
}

function result(decision, fit, reasons, job) {
  return { key: jobKey(job), decision, fit, reasons, job };
}
