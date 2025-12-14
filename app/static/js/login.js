// static/js/login.js
document.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;
  const savedTheme = localStorage.getItem("theme") || "light";
  root.setAttribute("data-theme", savedTheme);

  const toggle = document.getElementById("theme-toggle");
  if (toggle) {
    // Estado inicial del switch
    toggle.checked = savedTheme === "dark";

    toggle.addEventListener("change", () => {
      const theme = toggle.checked ? "dark" : "light";
      root.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
    });
  }
});
