(function load3D() {
  const sceneEl = document.getElementById("scene");
  const hintEl = document.getElementById("hintLabel");

  const urls = [
    "https://unpkg.com/three@0.160.0/build/three.min.js",
    "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/r160/three.min.js",
  ];

  function showError() {
    if (sceneEl) {
      sceneEl.innerHTML =
        '<div style="height:100%;display:grid;place-items:center;padding:24px;text-align:center;color:#5a3b20;font-weight:700;line-height:1.4">Kunde inte ladda 3D-motorn (Three.js).<br/>Kontrollera internetanslutning eller kör via lokal server.</div>';
    }
    if (hintEl) {
      hintEl.textContent = "3D-laddning misslyckades. Starta om sidan eller testa via lokal server.";
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.crossOrigin = "anonymous";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadApp() {
    const app = document.createElement("script");
    app.src = "script.js";
    app.defer = true;
    app.onload = function () {
      if (!window.THREE) showError();
    };
    app.onerror = showError;
    document.body.appendChild(app);
  }

  function tryNext(i) {
    if (i >= urls.length) {
      showError();
      return;
    }

    loadScript(urls[i])
      .then(() => {
        if (!window.THREE) {
          tryNext(i + 1);
          return;
        }
        loadApp();
      })
      .catch(() => {
        tryNext(i + 1);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => tryNext(0));
  } else {
    tryNext(0);
  }
})();
