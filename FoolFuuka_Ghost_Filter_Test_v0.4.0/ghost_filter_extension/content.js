(() => {
  "use strict";

  const STORAGE_KEY = "ghostFilterHiddenPosts";
  const HIDDEN_MARKER = "data-ghost-filter-key";
  const BUTTON_MARKER = "data-gf-hide-button-added";
  const ORIGINAL_DISPLAY = "data-gf-original-display";
  const ORIGINAL_DISPLAY_PRIORITY = "data-gf-original-display-priority";

  let hidden = new Set();
  let scanQueued = false;
  let scanning = false;

  const style = document.createElement("style");
  style.id = "ghost-filter-styles";
  style.textContent = `
    .gf-hidden-placeholder {
      box-sizing: border-box; margin: 8px 0; padding: 8px 10px;
      border: 1px dashed #777; border-radius: 4px;
      color: #aaa; background: #292929;
      font: 12px/1.4 Arial, sans-serif;
    }
    .gf-hidden-placeholder button {
      margin-left: 8px; padding: 3px 8px;
      border: 1px solid #666; border-radius: 3px;
      background: #3b3b3b; color: #bbb;
      cursor: pointer; font: 12px Arial, sans-serif;
    }
    .gf-hide-button {
      display: inline-block !important; visibility: visible !important;
      opacity: 1 !important; margin: 3px 0 3px 7px !important;
      padding: 2px 8px !important; border: 1px solid #555 !important;
      border-radius: 3px !important; background: #3b3b3b !important;
      color: #bdbdbd !important; font: 11px/1.5 Arial,sans-serif !important;
      cursor: pointer !important; vertical-align: middle !important;
      box-shadow: none !important; text-shadow: none !important;
    }
    .gf-hide-button:hover {
      background: #4a4a4a !important; color: #e0e0e0 !important;
      border-color: #777 !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  function load() {
    return new Promise(resolve => {
      chrome.storage.local.get({ [STORAGE_KEY]: [] }, data => {
        hidden = new Set(Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : []);
        resolve();
      });
    });
  }

  function save() {
    return new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY]: [...hidden] }, resolve));
  }

  function boardName() {
    return location.pathname.split("/").filter(Boolean)[0] || "unknown";
  }

  function parsePost(node) {
    const candidates = [
      node.getAttribute("data-post-id"),
      node.getAttribute("data-num"),
      node.id
    ].filter(Boolean);

    for (const raw of candidates) {
      const match = String(raw).match(/(?:^|[^0-9])(\d+)(?:_(\d+))?$/);
      if (match) return { num: match[1], subnum: match[2] || null };
    }

    for (const link of node.querySelectorAll('a[href*="#"], a[href*="/thread/"]')) {
      const raw = `${link.getAttribute("href") || ""} ${link.id || ""}`;
      const match = raw.match(/(?:#|\/)(\d+)(?:_(\d+))?(?:$|[/?&])/);
      if (match) return { num: match[1], subnum: match[2] || null };
    }
    return null;
  }

  function isGhost(node, parsed) {
    if (!parsed || parsed.subnum === null || !/^[1-9]\d*$/.test(parsed.subnum)) return false;
    const cls = typeof node.className === "string" ? node.className : "";
    const marker = [
      node.id || "", cls,
      node.getAttribute("data-post-id") || "",
      node.getAttribute("data-num") || ""
    ].join(" ").toLowerCase();

    return node.matches(".post, .post_wrapper, .thread, [data-post-id], [data-num]") &&
      (/post|reply|thread/.test(marker) || node.matches(".post, .post_wrapper"));
  }

  function postNodes() {
    const nodes = document.querySelectorAll(".post, .post_wrapper, .thread .post, [data-post-id], [data-num]");
    return [...new Set(nodes)].filter(node => node instanceof HTMLElement);
  }

  function keyFor(parsed) {
    return `${location.hostname}|${boardName()}|${parsed.num}_${parsed.subnum}`;
  }

  function postIdFromKey(key) {
    return key.split("|").pop();
  }

  function actuallyHide(post) {
    // Preserve any inline display setting, then override site CSS with !important.
    if (!post.hasAttribute(ORIGINAL_DISPLAY)) {
      post.setAttribute(ORIGINAL_DISPLAY, post.style.getPropertyValue("display"));
      post.setAttribute(ORIGINAL_DISPLAY_PRIORITY, post.style.getPropertyPriority("display"));
    }
    post.hidden = true;
    post.style.setProperty("display", "none", "important");
    post.style.setProperty("visibility", "hidden", "important");
  }

  function restoreVisibility(post) {
    post.hidden = false;
    post.style.removeProperty("visibility");

    const oldDisplay = post.getAttribute(ORIGINAL_DISPLAY);
    const oldPriority = post.getAttribute(ORIGINAL_DISPLAY_PRIORITY) || "";
    if (oldDisplay) post.style.setProperty("display", oldDisplay, oldPriority);
    else post.style.removeProperty("display");

    post.removeAttribute(ORIGINAL_DISPLAY);
    post.removeAttribute(ORIGINAL_DISPLAY_PRIORITY);
  }

  function hidePost(post, key) {
    if (post.hasAttribute(HIDDEN_MARKER)) {
      actuallyHide(post);
      return;
    }

    const placeholder = document.createElement("div");
    placeholder.className = "gf-hidden-placeholder";
    placeholder.textContent = `Ghost post hidden (${postIdFromKey(key)}). `;

    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.textContent = "Reveal";
    reveal.addEventListener("click", async () => {
      hidden.delete(key);
      await save();
      restoreVisibility(post);
      post.removeAttribute(HIDDEN_MARKER);
      post.removeAttribute(BUTTON_MARKER);
      placeholder.replaceWith(post);
      scheduleScan();
    });

    placeholder.appendChild(reveal);
    post.setAttribute(HIDDEN_MARKER, key);
    post.insertAdjacentElement("beforebegin", placeholder);
    actuallyHide(post);
  }

  function addHideButton(post, key) {
    if (post.hasAttribute(BUTTON_MARKER) || post.hasAttribute(HIDDEN_MARKER)) return;
    post.setAttribute(BUTTON_MARKER, "1");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "gf-hide-button";
    button.textContent = "Hide";
    button.title = "Hide this individual ghost post";

    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      hidden.add(key);
      await save();
      hidePost(post, key);
    });

    const header = post.querySelector(".post_head, .post-header, .posthead, header");
    if (header) header.appendChild(button);
    else post.insertBefore(button, post.firstChild);
  }

  function scan() {
    if (scanning) return;
    scanning = true;
    scanQueued = false;

    try {
      for (const post of postNodes()) {
        if (post.hasAttribute(HIDDEN_MARKER)) {
          actuallyHide(post);
          continue;
        }
        const parsed = parsePost(post);
        if (!isGhost(post, parsed)) continue;

        const key = keyFor(parsed);
        if (hidden.has(key)) hidePost(post, key);
        else addHideButton(post, key);
      }
    } finally {
      scanning = false;
    }
  }

  function scheduleScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }

  async function init() {
    await load();
    scan();

    new MutationObserver(mutations => {
      const relevant = mutations.some(mutation => {
        const changed = [...mutation.addedNodes, ...mutation.removedNodes];
        return changed.some(node => {
          if (!(node instanceof Element)) return true;
          return !node.matches(".gf-hide-button, .gf-hidden-placeholder, #ghost-filter-styles") &&
            !node.closest(".gf-hide-button, .gf-hidden-placeholder, #ghost-filter-styles");
        });
      });
      if (relevant) scheduleScan();
    }).observe(document.documentElement, { childList: true, subtree: true });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[STORAGE_KEY]) {
        hidden = new Set(changes[STORAGE_KEY].newValue || []);
        scheduleScan();
      }
    });
  }

  init();
})();