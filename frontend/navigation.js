/* Livestock Manager v4.0.8 — navigation that does not depend on page-specific CSS/JS */
(function () {
  "use strict";

  function toggleMenu(button) {
    var nav = document.getElementById("navLinks");
    if (!nav) return false;

    var open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    nav.style.setProperty("display", open ? "flex" : "", "important");
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    return false;
  }

  window.LMNavToggle = toggleMenu;

  function closeMenu() {
    var nav = document.getElementById("navLinks");
    var button = document.getElementById("menuButton");
    if (!nav) return;
    nav.classList.remove("open");
    nav.style.removeProperty("display");
    if (button) {
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open navigation");
    }
  }

  function init() {
    var button = document.getElementById("menuButton");
    var nav = document.getElementById("navLinks");
    if (!button || !nav) return;

    // Keep an inline fallback on the button so navigation still works even if
    // another page script fails before navigation.js runs.
    // Capture the click before any older page-specific handlers can toggle twice.
    // The HTML retains a fallback onclick for users with blocked scripts.
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleMenu(button);
    }, true);

    nav.addEventListener("click", function (event) {
      var link = event.target.closest ? event.target.closest("a") : null;
      if (link && nav.contains(link)) closeMenu();
    });

    document.addEventListener("click", function (event) {
      if (!nav.classList.contains("open")) return;
      if (button.contains(event.target) || nav.contains(event.target)) return;
      closeMenu();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) closeMenu();
    });

    closeMenu();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
