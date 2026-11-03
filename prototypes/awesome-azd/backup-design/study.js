(() => {
  const root = document.documentElement;
  const buttons = document.querySelectorAll(".theme-toggle");
  function applyTheme(theme) {
    root.dataset.theme = theme;
    for (const button of buttons) {
      button.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} theme`);
    }
  }
  let savedTheme;
  try {
    savedTheme = localStorage.getItem("azd-study-theme");
  } catch (error) {
    console.warn("Theme preference is unavailable; using the browser preference.", error);
  }
  applyTheme(savedTheme === "light" || savedTheme === "dark" ? savedTheme : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const theme = root.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(theme);
      try {
        localStorage.setItem("azd-study-theme", theme);
      } catch (error) {
        console.warn("The theme changed, but its preference could not be saved.", error);
      }
    });
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.hidden = true;
  document.body.append(toast);
  let timer;
  window.announce = message => {
    clearTimeout(timer);
    toast.textContent = message;
    toast.hidden = false;
    timer = setTimeout(() => { toast.hidden = true; }, 5000);
  };
  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    const text = button.dataset.copy;
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API is not available in this browser context.");
      await navigator.clipboard.writeText(text);
      window.announce("Copied to clipboard.");
    } catch (error) {
      console.warn("Clipboard write failed.", error);
      window.announce("Could not copy. Select the visible text and copy it manually.");
    }
  });
})();
