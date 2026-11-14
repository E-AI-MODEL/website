/* EAI first-party usage measurement: only public route and fixed click IDs.
   No tracking cookies, URLs with queries, typed text, IP or referrer collected. */
(function () {
  "use strict";
  var OFF_KEY = "eai_analytics_opt_out";
  var VISITOR_KEY = "eai_analytics_visitor_v1";
  var SESSION_KEY = "eai_analytics_session_v1";
  var MAX_AGE = 30 * 86400000;
  var SESSION_TIMEOUT = 30 * 60000;
  function read(store, key) {
    try { return store.getItem(key); } catch (_) { return null; }
  }
  function write(store, key, value) {
    try { store.setItem(key, value); return true; } catch (_) { return false; }
  }
  function forget(store, key) {
    try { store.removeItem(key); } catch (_) { /* private browsing */ }
  }
  function optedOut() { return read(localStorage, OFF_KEY) === "1"; }
  function isBlocked() {
    return optedOut() || navigator.globalPrivacyControl === true ||
      navigator.doNotTrack === "1" || window.doNotTrack === "1";
  }
  window.EAIPrivacy = {
    isDisabled: isBlocked,
    disable: function () {
      write(localStorage, OFF_KEY, "1");
      forget(localStorage, VISITOR_KEY);
      forget(sessionStorage, SESSION_KEY);
      document.dispatchEvent(new Event("eai-analytics-change"));
    },
    enable: function () {
      forget(localStorage, OFF_KEY);
      document.dispatchEvent(new Event("eai-analytics-change"));
    }
  };
  if (!/^((www\.)?eaimodel\.nl)$/.test(location.hostname) || isBlocked()) return;
  if (new URLSearchParams(location.search).get("demo") === "1") return;
  function randomId() {
    if (!crypto || !crypto.getRandomValues) return null;
    var bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  function parse(value) { try { return JSON.parse(value); } catch (_) { return null; } }
  var now = Date.now();
  var visitor = parse(read(localStorage, VISITOR_KEY));
  if (!visitor || !/^[0-9a-f]{32}$/.test(visitor.id || "") || !Number.isFinite(visitor.until) || visitor.until < now) {
    visitor = { id: randomId(), until: now + MAX_AGE };
    if (!visitor.id || !write(localStorage, VISITOR_KEY, JSON.stringify(visitor))) return;
  }
  var session = parse(read(sessionStorage, SESSION_KEY));
  if (!session || !/^[0-9a-f]{32}$/.test(session.id || "") || !Number.isFinite(session.last) || now - session.last > SESSION_TIMEOUT || now < session.last) {
    session = { id: randomId(), last: now };
    if (!session.id) return;
  }
  if (!write(sessionStorage, SESSION_KEY, JSON.stringify(session))) return;
  function publicPath(path) {
    if (!/^\/(?:[a-z0-9_-]+\/){0,9}$/.test(path)) return null;
    if (/\/(?:leif|houseoftalents|admin|beheer|private|login|auth|backoffice|continue|html-galerij)\//.test(path)) return null;
    return path;
  }
  var page = location.pathname.endsWith("/") ? location.pathname : location.pathname + "/";
  if (page === "/index.html/") page = "/";
  if (!publicPath(page)) return;
  var clickBudget = 50;
  function send(event, target) {
    if (isBlocked() || !session || !visitor) return;
    var payload = {version: 1, visitor: visitor.id, session: session.id, event: event, path: page};
    if (target) payload.target = target;
    try {
      session.last = Date.now();
      write(sessionStorage, SESSION_KEY, JSON.stringify(session));
      fetch("/statistieken/collect.php", {
        method: "POST", mode: "same-origin", credentials: "omit", keepalive: true,
        headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)
      }).catch(function () { /* statistics must never block the page */ });
    } catch (_) { /* statistics must never block the page */ }
  }
  send("view");
  var engaged = false;
  var visibleSince = document.visibilityState === "visible" ? performance.now() : null;
  var accumulated = 0;
  function currentVisible() {
    return accumulated + (visibleSince === null ? 0 : Math.max(0, performance.now() - visibleSince));
  }
  function markEngaged() {
    if (!engaged && currentVisible() >= 10000) { engaged = true; send("engage"); }
  }
  var engagementTimer = setInterval(function () {
    if (isBlocked()) { clearInterval(engagementTimer); return; }
    markEngaged();
    if (engaged) clearInterval(engagementTimer);
  }, 1200);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && visibleSince !== null) {
      accumulated = currentVisible(); visibleSince = null;
    } else if (document.visibilityState === "visible" && visibleSince === null) {
      visibleSince = performance.now();
    }
    markEngaged();
  });
  function normalizedIdentifier(value) {
    if (typeof value !== "string") return "";
    value = value.toLowerCase().trim();
    return /^[a-z][a-z0-9_-]{0,48}$/.test(value) ? value : "";
  }
  function clickTarget(node) {
    var tag = node.tagName.toLowerCase();
    if (tag === "a") {
      var href = node.getAttribute("href");
      if (!href || href.charAt(0) === "#") return "link:anker";
      try {
        var url = new URL(href, location.href);
        if (!/^(www\.)?eaimodel\.nl$/.test(url.hostname)) return "link:extern";
        var targetPath = url.pathname.endsWith("/") ? url.pathname : url.pathname + "/";
        return publicPath(targetPath) ? "link:" + targetPath : "link:overig";
      } catch (_) { return "link:overig"; }
    }
    var id = normalizedIdentifier(node.getAttribute("data-eai-track")) ||
      normalizedIdentifier(node.id);
    if (tag === "select" || tag === "input") return "invoer:" + (id || tag);
    return "knop:" + (id || "overig");
  }
  function handleInteraction(event) {
    if (clickBudget <= 0 || isBlocked()) return;
    var target = event.target;
    if (!target || typeof target.closest !== "function") return;
    var selector = event.type === "change" ? "select,input[type=range]" :
      "a,button,summary,[role=button],input[type=button],input[type=submit]";
    var node = target.closest(selector);
    if (!node || node.hasAttribute("disabled") || node.closest("[data-eai-analytics-ignore]")) return;
    clickBudget--;
    send("click", clickTarget(node));
  }
  document.addEventListener("click", handleInteraction, {capture: true, passive: true});
  document.addEventListener("change", handleInteraction, {capture: true, passive: true});
  window.setInterval(function () { clickBudget = 50; }, 60000);
})();
