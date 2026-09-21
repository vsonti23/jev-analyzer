export const DEFAULT_PROFILE = Object.freeze({
  targetRoles: [], skills: [], yearsExperience: null, needsSponsorship: false
});

export const DEFAULT_POLICY = Object.freeze({
  maxAgeHours: 24, minimumFit: 7, allowedLocations: [], hideSkipped: false
});

export const DECISIONS = Object.freeze({ KEEP: "keep", SKIP: "skip", CHECK: "check" });

export function normalizeLines(value) {
  return String(value || "").split("\n").map((item) => item.trim()).filter(Boolean);
}

export function jobKey(job) {
  return job.source + ":" + (job.id || job.url || [job.title, job.company].filter(Boolean).join("|"));
}

