const HIGHLIGHT_CLASS = "optia-highlight";
const STYLE_ID = "optia-styles";

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      outline: 3px solid #DC2626 !important;
      outline-offset: 2px;
      position: relative;
    }
    .${HIGHLIGHT_CLASS}::after {
      content: attr(data-seo-issue);
      position: absolute;
      top: -24px;
      left: 0;
      background: #DC2626;
      color: white;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
      z-index: 10000;
      font-family: system-ui, sans-serif;
    }
  `;
  document.head.appendChild(style);
}

export function highlightIssues() {
  injectStyles();
  clearHighlights();

  document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    if (!img.alt || img.alt.trim() === "") {
      img.classList.add(HIGHLIGHT_CLASS);
      img.setAttribute("data-seo-issue", "Missing alt text");
    }
  });
}

export function clearHighlights() {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
    el.classList.remove(HIGHLIGHT_CLASS);
    el.removeAttribute("data-seo-issue");
  });
}
