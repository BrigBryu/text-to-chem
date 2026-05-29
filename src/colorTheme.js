export const COLOR_THEME = {
  name: "Gruvbox Notes",
  cssVars: {
    "--bg": "#282828",
    "--panel": "#3c3836",
    "--panel-soft": "#504945",
    "--panel-strong": "#32302f",
    "--panel-ink": "#1d2021",
    "--text": "#fbf1c7",
    "--muted": "#d5c4a1",
    "--accent": "#b8bb26",
    "--accent-strong": "#98971a",
    "--accent-soft": "rgba(184, 187, 38, 0.16)",
    "--accent-ring": "rgba(184, 187, 38, 0.18)",
    "--border": "#665c54",
    "--border-rgb": "102 92 84",
    "--paper": "#fbf7ed",
    "--paper-line": "#d5c4a1",
    "--paper-line-soft": "rgba(213, 196, 161, 0.8)",
    "--paper-shadow": "rgba(29, 32, 33, 0.26)",
    "--paper-action": "#f2e5c7",
    "--paper-action-hover": "#ebdbb2",
    "--ink": "#1d2021",
    "--molecule-ink": "#111111",
    "--atom-label-color": "#2563eb",
    "--arrow-color": "#2563eb",
    "--arrow-opacity": "0.72",
    "--warning": "#cc241d",
    "--warning-ink": "#8f3f1f",
    "--warning-strong": "#7c2d12",
    "--warning-bg": "#fff0dd",
    "--warning-action": "#f9dfc0",
    "--warning-action-hover": "#f3cf9f",
    "--error-bg": "#fff4ed",
    "--overlay": "rgba(29, 32, 33, 0.72)",
    "--workbench-overlay": "rgba(40, 40, 40, 0.86)",
    "--workbench-grid": "rgba(213, 196, 161, 0.08)",
    "--dialog-shadow": "rgba(0, 0, 0, 0.5)"
  },
  molecule: {
    C: "#111111",
    O: "#111111",
    N: "#111111",
    F: "#111111",
    CL: "#111111",
    BR: "#111111",
    I: "#111111",
    P: "#111111",
    S: "#111111",
    B: "#111111",
    H: "#111111",
    BACKGROUND: "#fbf7ed"
  },
  arrow: {
    color: "#2563eb",
    opacity: 0.72
  },
  export: {
    background: "#fbf7ed"
  }
};

export function applyColorTheme(theme = COLOR_THEME, root = document.documentElement) {
  Object.entries(theme.cssVars).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
}
