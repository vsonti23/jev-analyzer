function text(element) { return (element?.innerText || element?.getAttribute?.("aria-label") || element?.textContent || "").replace(/\s+/g, " ").trim() || null; }
function absoluteUrl(href) { try { return new URL(href, location.href).href; } catch { return null; } }

function elementsIncludingOpenShadows(selector) {
  const result = [];
  const visit = (root) => {
    result.push(...root.querySelectorAll(selector));
    root.querySelectorAll("*").forEach((node) => { if (node.shadowRoot) visit(node.shadowRoot); });
  };
  visit(document);
  return [...new Set(result)];
}

function extractLinkedIn() {
  const cards = [...document.querySelectorAll("li.jobs-search-results__list-item, .job-card-container")];
  const extracted = cards.map((card, index) => {
    const link = card.querySelector("a[href*='/jobs/view/']");
    const age = text(card.querySelector("time"));
    return {
      source: "linkedin", id: link?.getAttribute("data-job-id") || link?.href?.match(/\d+/)?.[0] || String(index),
      url: absoluteUrl(link?.href), title: text(card.querySelector(".job-card-list__title, .artdeco-entity-lockup__title, strong")),
      company: text(card.querySelector(".job-card-container__company-name, .artdeco-entity-lockup__subtitle")),
      location: text(card.querySelector(".job-card-container__metadata-item, .artdeco-entity-lockup__caption")),
      postedText: age, description: null, coverage: "card"
    };
  });
  if (extracted.length) return extracted;

  // LinkedIn's current search page renders result rows as buttons. Their
  // styling/classes change often, but a posting timestamp is stable user-facing
  // job data and distinguishes them from ordinary navigation buttons.
  return elementsIncludingOpenShadows("button, [role='button']").flatMap((card, index) => {
    const raw = text(card);
    const age = raw?.match(/(?:reposted|posted)\s+(\d+\s+(?:minute|hour|day)s?\s+ago)/i)?.[1] || null;
    if (!age) return [];
    const beforeDismiss = raw.split(/\s+dismiss\s+/i)[0].trim();
    const verifiedTitle = beforeDismiss.match(/^(?:selected,\s*)?(.+?)\s+\(verified job\)/i)?.[1];
    const dismissedTitle = raw.match(/\bdismiss\s+(.+?)\s+job\b/i)?.[1];
    const title = verifiedTitle || dismissedTitle || beforeDismiss;
    const id = card.getAttribute("data-job-id") || card.getAttribute("data-occludable-job-id") || "button-" + index;
    card.dataset.jobSieveKey = "linkedin:" + id;
    return [{ source: "linkedin", id, url: null, title, company: null, location: null, postedText: age, description: null, coverage: "card" }];
  });
}

function extractGreenhouse() {
  const links = [...document.querySelectorAll("a[href*='/jobs/']")];
  return links.map((link, index) => ({
    source: "greenhouse", id: link.href.match(/jobs\/(\d+)/)?.[1] || String(index), url: absoluteUrl(link.href),
    title: text(link), company: document.title.split("|")[0]?.trim() || null,
    location: text(link.closest("div")?.querySelector(".location")), postedText: null, description: null, coverage: "card"
  })).filter((job) => job.title);
}

function extractLever() {
  const links = [...document.querySelectorAll("a[href*='/']")].filter((link) => link.closest(".posting"));
  return links.map((link, index) => ({
    source: "lever", id: link.href.split("/").filter(Boolean).pop() || String(index), url: absoluteUrl(link.href),
    title: text(link.querySelector("h5, .posting-title, div")) || text(link), company: document.title.split("|")[0]?.trim() || null,
    location: text(link.querySelector(".sort-by-location, .posting-categories")), postedText: null, description: null, coverage: "card"
  })).filter((job) => job.title);
}

function extractTesla() {
  const links = [...document.querySelectorAll("a[href*='/careers/search/job/']")];
  const seen = new Set();
  return links.flatMap((link, index) => {
    const url = absoluteUrl(link.href);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    const card = link.closest("article, li, [class*='job'], [class*='Job']") || link;
    return [{ source: "tesla", id: url.match(/search\/job\/(\d+)/)?.[1] || String(index), url, title: text(link), company: "Tesla", location: text(card.querySelector("[class*='location'], [class*='Location']")), postedText: text(card.querySelector("time")), description: null, coverage: "card" }];
  });
}

function extractGeneric() {
  const structured = [...document.querySelectorAll("script[type='application/ld+json']")].flatMap((node) => {
    try { const value = JSON.parse(node.textContent); return Array.isArray(value) ? value : [value]; } catch { return []; }
  }).filter((value) => value?.['@type'] === "JobPosting");
  if (structured.length) return structured.map((value, index) => ({ source: "generic", id: value.identifier?.value || String(index), url: absoluteUrl(value.url) || location.href, title: value.title || null, company: value.hiringOrganization?.name || null, location: value.jobLocation?.address?.addressLocality || value.jobLocation?.name || null, postedText: value.datePosted || null, description: value.description || null, coverage: "full_description" }));

  const links = [...document.querySelectorAll("a[href]")].filter((link) => /\/(?:jobs?|careers?)(?:\/|\?|$)/i.test(link.getAttribute("href") || ""));
  const seen = new Set();
  return links.flatMap((link, index) => {
    const url = absoluteUrl(link.href);
    const title = text(link);
    if (!url || !title || title.length < 4 || seen.has(url)) return [];
    seen.add(url);
    return [{ source: "generic", id: url, url, title, company: null, location: null, postedText: null, description: null, coverage: "card" }];
  });
}

export function extractLoadedJobs() {
  if (location.hostname === "linkedin.com" || location.hostname === "www.linkedin.com") return extractLinkedIn();
  if (location.hostname.endsWith("greenhouse.io")) return extractGreenhouse();
  if (location.hostname === "jobs.lever.co") return extractLever();
  if (location.hostname === "www.tesla.com" && location.pathname.includes("/careers/")) return extractTesla();
  return extractGeneric();
}

function pageDescription() {
  return text(document.querySelector(
    ".jobs-description-content__text, .jobs-description__content, #content, .section-wrapper .content, .posting-page, .posting"
  ));
}

function selectedLinkedInId() {
  const selected = document.querySelector("a.jobs-search-results__list-item--active[href*='/jobs/view/'], a[aria-current='page'][href*='/jobs/view/']");
  return selected?.href?.match(/\d+/)?.[0] || location.href.match(/jobs\/view\/(\d+)/)?.[1] || null;
}

/**
 * A listing card frequently does not include requirements or work-authorization
 * language. Enrich only the currently selected/full detail so a short card is
 * never treated as a complete job description.
 */
export function enrichWithOpenDescription(jobs) {
  const description = location.pathname.includes("/careers/search/job/") || /\/(?:jobs?|careers?)(?:\/|$)/i.test(location.pathname) ? text(document.querySelector("main, article")) : pageDescription();
  if (!description || description.length < 120) return jobs;
  if (location.hostname === "linkedin.com" || location.hostname === "www.linkedin.com") {
    const id = selectedLinkedInId();
    return jobs.map((job) => job.id === id ? { ...job, description, coverage: "full_description" } : job);
  }
  if (location.hostname.endsWith("greenhouse.io") || location.hostname === "jobs.lever.co") {
    const current = location.href.replace(/\/$/, "");
    return jobs.map((job) => job.url?.replace(/\/$/, "") === current
      ? { ...job, description, coverage: "full_description" }
      : job);
  }
  if (location.hostname === "www.tesla.com" && location.pathname.includes("/careers/search/job/")) {
    const current = location.href.replace(/\/$/, "");
    return jobs.map((job) => job.url?.replace(/\/$/, "") === current ? { ...job, description, coverage: "full_description" } : job);
  }
  if (jobKeyForPage(jobs)) {
    const current = location.href.replace(/\/$/, "");
    return jobs.map((job) => job.url?.replace(/\/$/, "") === current ? { ...job, description, coverage: "full_description" } : job);
  }
  return jobs;
}

function jobKeyForPage(jobs) {
  return jobs.some((job) => job.source === "generic") && /\/(?:jobs?|careers?)(?:\/|$)/i.test(location.pathname);
}
