import assert from "node:assert/strict";
import test from "node:test";
import { applyJevAssessment, assessJob } from "../src/content/policy.js";

const profile = { targetRoles: ["Backend Engineer"], skills: ["TypeScript", "AWS"], needsSponsorship: true };
const policy = { maxAgeHours: 24, minimumFit: 7, allowedLocations: [] };
const job = (overrides = {}) => ({ source: "test", id: "1", title: "Backend Engineer", company: "Acme", location: "Remote", postedText: "2 hours ago", description: "TypeScript services deployed on AWS.", ...overrides });

test("rejects an exact posting age outside the local window", () => {
  assert.equal(assessJob(job({ postedText: "25 hours ago" }), profile, policy).decision, "skip");
});

test("rejects explicit sponsorship denial", () => {
  const result = assessJob(job({ description: "We cannot provide visa sponsorship now or in the future." }), profile, policy);
  assert.equal(result.decision, "skip");
  assert.deepEqual(result.reasons, ["No sponsorship"]);
});

test("keeps a full strong match and returns a 0-10 rating", () => {
  const result = assessJob(job(), profile, policy);
  assert.equal(result.decision, "keep");
  assert.equal(result.fit, 10);
});

test("does not claim a card has passed sponsorship assessment", () => {
  const result = assessJob(job({ description: null }), profile, policy);
  assert.equal(result.decision, "check");
  assert.equal(result.fit, null);
  assert.ok(result.reasons.includes("Open description"));
});

test("does not reject a related role just because phrasing differs", () => {
  const result = assessJob(job({ title: "Senior Platform Backend Developer" }), profile, policy);
  assert.notEqual(result.reasons[0], "Wrong role");
});

test("uses Jev's 0-10 score only when evidence and confidence are adequate", () => {
  const local = assessJob(job(), profile, policy);
  const result = applyJevAssessment(local, { adequateEvidence: true, sponsorship: "not_stated", fit: 8.5, confidence: 0.8 }, policy);
  assert.equal(result.decision, "keep");
  assert.equal(result.fit, 8.5);
});

test("routes uncertain Jev classifications to review", () => {
  const local = assessJob(job(), profile, policy);
  const result = applyJevAssessment(local, { adequateEvidence: true, sponsorship: "not_stated", fit: 9, confidence: 0.4 }, policy);
  assert.equal(result.decision, "check");
});
