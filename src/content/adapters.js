function text(element) { return element?.textContent?.replace(/\s+/g, " ").trim() || null; }
function absoluteUrl(href) { try { return new URL(href, location.href).href; } catch { return null; } }

function extractLinkedIn() {
  const cards = [...document.querySelectorAll("li.jobs-search-results__list-item, .job-card-container")];
  return cards.map((card, index) => {
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

export function extractLoadedJobs() {
  if (location.hostname === "www.linkedin.com") return extractLinkedIn();
  if (location.hostname.endsWith("greenhouse.io")) return extractGreenhouse();
  if (location.hostname === "jobs.lever.co") return extractLever();
  return [];
}

