const GOATCOUNTER_ENDPOINT = (import.meta.env.VITE_GOATCOUNTER_ENDPOINT || "").trim();
const ALLOW_LOCAL_ANALYTICS = import.meta.env.VITE_GOATCOUNTER_ALLOW_LOCAL === "true";
const EVENT_PREFIX = "text-to-chem";
const pendingEvents = [];
let initialized = false;

export function initAnalytics() {
  if (initialized || !GOATCOUNTER_ENDPOINT || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (window.location.protocol === "file:") {
    return;
  }

  initialized = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://gc.zgo.at/count.js";
  script.dataset.goatcounter = GOATCOUNTER_ENDPOINT;
  if (ALLOW_LOCAL_ANALYTICS) {
    script.dataset.goatcounterSettings = JSON.stringify({ allow_local: true });
  }
  script.addEventListener("load", flushPendingEvents);
  document.head.appendChild(script);
}

export function trackUsageEvent(name, detail = "") {
  if (!GOATCOUNTER_ENDPOINT || typeof window === "undefined") {
    return;
  }

  const event = {
    path: `${EVENT_PREFIX}-${sanitizePathPart(name)}${detail ? `-${sanitizePathPart(detail)}` : ""}`,
    title: detail ? `${name}: ${detail}` : name,
    event: true
  };

  if (window.goatcounter?.count) {
    window.goatcounter.count(event);
  } else {
    pendingEvents.push(event);
  }
}

export function bucketCount(count) {
  if (count <= 0) {
    return "0";
  }
  if (count === 1) {
    return "1";
  }
  if (count === 2) {
    return "2";
  }
  if (count <= 5) {
    return "3-5";
  }
  return "6-plus";
}

function flushPendingEvents() {
  if (!window.goatcounter?.count) {
    return;
  }

  while (pendingEvents.length > 0) {
    window.goatcounter.count(pendingEvents.shift());
  }
}

function sanitizePathPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
