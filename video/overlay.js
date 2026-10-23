// Injected into every recorded page: a visible cursor, click ripples and a caption bar.
(() => {
  if (window.__fbOverlay) return;
  window.__fbOverlay = true;
  const add = () => {
    const style = document.createElement("style");
    style.textContent = `
      #fb-cursor { position: fixed; z-index: 99999; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%;
        background: rgba(163, 74, 37, 0.35); border: 2px solid #a34a25; pointer-events: none; transition: transform 120ms; }
      #fb-cursor.down { transform: scale(0.7); }
      nextjs-portal { display: none !important; }
      #fb-caption { position: fixed; z-index: 99998; right: 24px; bottom: 24px; max-width: 34%;
        padding: 10px 18px; border-radius: 10px; background: rgba(30, 27, 26, 0.88); color: #fff;
        font: 500 21px/1.35 "Segoe UI", system-ui, sans-serif; text-align: left; pointer-events: none;
        border: 1px solid rgba(240, 163, 127, 0.5); }
      #fb-caption:empty { display: none; }`;
    document.head.appendChild(style);
    const cursor = document.createElement("div");
    cursor.id = "fb-cursor";
    const caption = document.createElement("div");
    caption.id = "fb-caption";
    document.body.append(cursor, caption);
    addEventListener("mousemove", (e) => { cursor.style.left = e.clientX + "px"; cursor.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => cursor.classList.add("down"), true);
    addEventListener("mouseup", () => cursor.classList.remove("down"), true);
  };
  if (document.body) add();
  else addEventListener("DOMContentLoaded", add);
})();
