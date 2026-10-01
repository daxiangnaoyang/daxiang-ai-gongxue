const stage = document.querySelector(".hero-dopamine-3d");
const anchor = document.querySelector(".dopamine-anchor-elephant");
const hero = document.querySelector(".hero");
const workbench = document.querySelector(".hero-workbench");

if (stage && anchor) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const forceMotionPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).get("motion") === "on";
  const motionEnabled = () => document.documentElement.classList.contains("motion-demo")
    && (forceMotionPreview || !reduceMotion.matches);

  let frame = 0;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  const paint = () => {
    frame = 0;
    if (!motionEnabled()) {
      currentX = 0;
      currentY = 0;
      return;
    }

    currentX += (targetX - currentX) * 0.095;
    currentY += (targetY - currentY) * 0.095;
    stage.style.setProperty("--anchor-x", `${(currentX * 16).toFixed(2)}px`);
    stage.style.setProperty("--anchor-y", `${(currentY * 11).toFixed(2)}px`);
    stage.style.setProperty("--anchor-rotate-y", `${(currentX * 8).toFixed(2)}deg`);
    stage.style.setProperty("--anchor-rotate-x", `${(-currentY * 6).toFixed(2)}deg`);
    stage.style.setProperty("--fallback-x", `${(currentX * 10).toFixed(2)}px`);
    stage.style.setProperty("--fallback-y", `${(currentY * 7).toFixed(2)}px`);

    if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
      frame = window.requestAnimationFrame(paint);
    }
  };

  const queue = () => {
    if (!frame && motionEnabled()) frame = window.requestAnimationFrame(paint);
  };

  const resetPointer = () => {
    targetX = 0;
    targetY = 0;
    queue();
  };

  const updatePointer = event => {
    if (!motionEnabled() || !finePointer.matches) return;
    const rect = stage.getBoundingClientRect();
    targetX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
    targetY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
    queue();
  };

  const markReady = () => {
    stage.classList.add("is-elephant");
    workbench?.classList.add("elephant-mode");
  };

  anchor.addEventListener("load", markReady, { once: true });
  anchor.addEventListener("error", () => {
    stage.classList.add("is-fallback");
    workbench?.classList.add("elephant-mode");
  }, { once: true });
  if (anchor.complete && anchor.naturalWidth > 0) markReady();

  if (hero) {
    hero.addEventListener("pointermove", updatePointer, { passive: true });
    hero.addEventListener("pointerleave", resetPointer, { passive: true });
    hero.addEventListener("pointercancel", resetPointer, { passive: true });
  }
}
