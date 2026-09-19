const stage = document.querySelector(".hero-dopamine-3d");
const canvas = document.querySelector("#hero-dopamine-canvas");
const hero = document.querySelector(".hero");

if (stage && canvas) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const motionEnabled = () => document.documentElement.classList.contains("motion-demo") && !reduceMotion.matches;
  const threeUrl = "https://cdn.jsdelivr.net/npm/three@0.181.2/build/three.module.js";
  const loaderUrl = "https://cdn.jsdelivr.net/npm/three@0.181.2/examples/jsm/loaders/GLTFLoader.js";
  const supportsWebGL = (() => {
    try {
      const probe = document.createElement("canvas");
      return Boolean(probe.getContext("webgl") || probe.getContext("experimental-webgl"));
    } catch {
      return false;
    }
  })();
  let renderer;
  let camera;
  let scene;
  let kit;
  let frame = 0;
  let startedAt = 0;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  const fit = three => {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const render = now => {
    frame = 0;
    if (!renderer || !camera || !scene) return;
    const elapsed = (now - startedAt) / 1000;
    currentX += (targetX - currentX) * 0.085;
    currentY += (targetY - currentY) * 0.085;
    if (kit) {
      kit.rotation.y = currentX * 0.42 + Math.sin(elapsed * 0.85) * 0.075;
      kit.rotation.x = -currentY * 0.23 + Math.cos(elapsed * 0.7) * 0.045;
      kit.rotation.z = Math.sin(elapsed * 0.55) * 0.018;
      kit.position.y = Math.sin(elapsed * 1.1) * 0.045;
    }
    renderer.render(scene, camera);
    if (motionEnabled()) frame = window.requestAnimationFrame(render);
  };

  const queue = () => {
    if (!frame && motionEnabled()) frame = window.requestAnimationFrame(render);
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

  const fallback = () => stage.classList.add("is-fallback");

  if (!supportsWebGL) {
    fallback();
    if (hero) {
      hero.addEventListener("pointermove", event => {
        if (!motionEnabled() || !finePointer.matches) return;
        const rect = stage.getBoundingClientRect();
        stage.style.setProperty("--fallback-x", `${((event.clientX - rect.left) / rect.width * 2 - 1) * 10}px`);
        stage.style.setProperty("--fallback-y", `${((event.clientY - rect.top) / rect.height * 2 - 1) * 7}px`);
      }, { passive: true });
      hero.addEventListener("pointerleave", () => {
        stage.style.setProperty("--fallback-x", "0px");
        stage.style.setProperty("--fallback-y", "0px");
      }, { passive: true });
    }
  } else Promise.all([import(threeUrl), import(loaderUrl)])
    .then(([three, loaderModule]) => {
      const { GLTFLoader } = loaderModule;
      renderer = new three.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setClearColor(0x000000, 0);
      if ("outputColorSpace" in renderer) renderer.outputColorSpace = three.SRGBColorSpace;
      scene = new three.Scene();
      camera = new three.PerspectiveCamera(24, 1, 0.1, 100);
      camera.position.set(0, 0.05, 7);
      scene.add(new three.HemisphereLight(0xfffbf2, 0x413943, 2.1));
      const key = new three.DirectionalLight(0xffffff, 2.2);
      key.position.set(-3, 4, 6);
      scene.add(key);
      const rim = new three.DirectionalLight(0xf4c7ab, 1.25);
      rim.position.set(4, 1, 3);
      scene.add(rim);
      fit(three);
      new ResizeObserver(() => fit(three)).observe(stage);
      const loader = new GLTFLoader();
      loader.load("assets/models/dopamine-kit.glb", loaded => {
        kit = loaded.scene;
        stage.classList.add("is-webgl");
        kit.scale.setScalar(1.35);
        kit.position.set(0, -0.18, 0);
        kit.traverse(object => {
          if (!object.isMesh) return;
          object.castShadow = false;
          object.receiveShadow = false;
        });
        scene.add(kit);
        startedAt = performance.now();
        render(startedAt);
      }, undefined, fallback);
      if (hero) {
        hero.addEventListener("pointermove", updatePointer, { passive: true });
        hero.addEventListener("pointerleave", resetPointer, { passive: true });
        hero.addEventListener("pointercancel", resetPointer, { passive: true });
      }
    })
    .catch(fallback);
}
