export const THEMES = {
  "gruvbox-dark": {
    name: "Gruvbox Dark",
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
      C: "#111111", O: "#111111", N: "#111111", F: "#111111",
      CL: "#111111", BR: "#111111", I: "#111111", P: "#111111",
      S: "#111111", B: "#111111", H: "#111111", BACKGROUND: "#fbf7ed"
    },
    arrow: { color: "#2563eb", opacity: 0.72 },
    export: { background: "#fbf7ed" }
  },
  "gruvbox-light": {
    name: "Gruvbox Light",
    cssVars: {
      "--bg": "#fbf1c7",
      "--panel": "#ebdbb2",
      "--panel-soft": "#d5c4a1",
      "--panel-strong": "#f2e5bc",
      "--panel-ink": "#f9f5d7",
      "--text": "#3c3836",
      "--muted": "#665c54",
      "--accent": "#79740e",
      "--accent-strong": "#98971a",
      "--accent-soft": "rgba(121, 116, 14, 0.16)",
      "--accent-ring": "rgba(121, 116, 14, 0.18)",
      "--border": "#bdae93",
      "--border-rgb": "189 174 147",
      "--paper": "#ffffff",
      "--paper-line": "#d5c4a1",
      "--paper-line-soft": "rgba(213, 196, 161, 0.8)",
      "--paper-shadow": "rgba(60, 56, 54, 0.15)",
      "--paper-action": "#f2e5c7",
      "--paper-action-hover": "#ebdbb2",
      "--ink": "#3c3836",
      "--molecule-ink": "#282828",
      "--atom-label-color": "#1d4ed8",
      "--arrow-color": "#1d4ed8",
      "--arrow-opacity": "0.8",
      "--warning": "#cc241d",
      "--warning-ink": "#9d0006",
      "--warning-strong": "#9d0006",
      "--warning-bg": "#fef3c7",
      "--warning-action": "#fde68a",
      "--warning-action-hover": "#fcd34d",
      "--error-bg": "#fee2e2",
      "--overlay": "rgba(251, 241, 199, 0.85)",
      "--workbench-overlay": "rgba(251, 241, 199, 0.92)",
      "--workbench-grid": "rgba(60, 56, 54, 0.06)",
      "--dialog-shadow": "rgba(0, 0, 0, 0.25)"
    },
    molecule: {
      C: "#282828", O: "#282828", N: "#282828", F: "#282828",
      CL: "#282828", BR: "#282828", I: "#282828", P: "#282828",
      S: "#282828", B: "#282828", H: "#282828", BACKGROUND: "#ffffff"
    },
    arrow: { color: "#1d4ed8", opacity: 0.8 },
    export: { background: "#ffffff" }
  },
  "solarized-dark": {
    name: "Solarized Dark",
    cssVars: {
      "--bg": "#002b36",
      "--panel": "#073642",
      "--panel-soft": "#094959",
      "--panel-strong": "#001f27",
      "--panel-ink": "#00212b",
      "--text": "#fdf6e3",
      "--muted": "#93a1a1",
      "--accent": "#859900",
      "--accent-strong": "#6b7d00",
      "--accent-soft": "rgba(133, 153, 0, 0.16)",
      "--accent-ring": "rgba(133, 153, 0, 0.18)",
      "--border": "#586e75",
      "--border-rgb": "88 110 117",
      "--paper": "#fdf6e3",
      "--paper-line": "#eee8d5",
      "--paper-line-soft": "rgba(238, 232, 213, 0.8)",
      "--paper-shadow": "rgba(0, 43, 54, 0.3)",
      "--paper-action": "#eee8d5",
      "--paper-action-hover": "#ddd6c4",
      "--ink": "#073642",
      "--molecule-ink": "#002b36",
      "--atom-label-color": "#268bd2",
      "--arrow-color": "#268bd2",
      "--arrow-opacity": "0.75",
      "--warning": "#dc322f",
      "--warning-ink": "#cb4b16",
      "--warning-strong": "#cb4b16",
      "--warning-bg": "#fef3c7",
      "--warning-action": "#fde68a",
      "--warning-action-hover": "#fcd34d",
      "--error-bg": "#fee2e2",
      "--overlay": "rgba(0, 43, 54, 0.8)",
      "--workbench-overlay": "rgba(0, 43, 54, 0.9)",
      "--workbench-grid": "rgba(147, 161, 161, 0.06)",
      "--dialog-shadow": "rgba(0, 0, 0, 0.5)"
    },
    molecule: {
      C: "#002b36", O: "#002b36", N: "#002b36", F: "#002b36",
      CL: "#002b36", BR: "#002b36", I: "#002b36", P: "#002b36",
      S: "#002b36", B: "#002b36", H: "#002b36", BACKGROUND: "#fdf6e3"
    },
    arrow: { color: "#268bd2", opacity: 0.75 },
    export: { background: "#fdf6e3" }
  },
  "solarized-light": {
    name: "Solarized Light",
    cssVars: {
      "--bg": "#fdf6e3",
      "--panel": "#eee8d5",
      "--panel-soft": "#ddd6c4",
      "--panel-strong": "#f5efdc",
      "--panel-ink": "#fdf6e3",
      "--text": "#073642",
      "--muted": "#657b83",
      "--accent": "#859900",
      "--accent-strong": "#6b7d00",
      "--accent-soft": "rgba(133, 153, 0, 0.16)",
      "--accent-ring": "rgba(133, 153, 0, 0.18)",
      "--border": "#93a1a1",
      "--border-rgb": "147 161 161",
      "--paper": "#ffffff",
      "--paper-line": "#eee8d5",
      "--paper-line-soft": "rgba(238, 232, 213, 0.8)",
      "--paper-shadow": "rgba(7, 54, 66, 0.12)",
      "--paper-action": "#eee8d5",
      "--paper-action-hover": "#ddd6c4",
      "--ink": "#073642",
      "--molecule-ink": "#002b36",
      "--atom-label-color": "#268bd2",
      "--arrow-color": "#268bd2",
      "--arrow-opacity": "0.8",
      "--warning": "#dc322f",
      "--warning-ink": "#cb4b16",
      "--warning-strong": "#cb4b16",
      "--warning-bg": "#fef3c7",
      "--warning-action": "#fde68a",
      "--warning-action-hover": "#fcd34d",
      "--error-bg": "#fee2e2",
      "--overlay": "rgba(253, 246, 227, 0.85)",
      "--workbench-overlay": "rgba(253, 246, 227, 0.92)",
      "--workbench-grid": "rgba(7, 54, 66, 0.05)",
      "--dialog-shadow": "rgba(0, 0, 0, 0.2)"
    },
    molecule: {
      C: "#002b36", O: "#002b36", N: "#002b36", F: "#002b36",
      CL: "#002b36", BR: "#002b36", I: "#002b36", P: "#002b36",
      S: "#002b36", B: "#002b36", H: "#002b36", BACKGROUND: "#ffffff"
    },
    arrow: { color: "#268bd2", opacity: 0.8 },
    export: { background: "#ffffff" }
  },
  "nord": {
    name: "Nord",
    cssVars: {
      "--bg": "#2e3440",
      "--panel": "#3b4252",
      "--panel-soft": "#434c5e",
      "--panel-strong": "#2e3440",
      "--panel-ink": "#242933",
      "--text": "#eceff4",
      "--muted": "#d8dee9",
      "--accent": "#a3be8c",
      "--accent-strong": "#8fbcbb",
      "--accent-soft": "rgba(163, 190, 140, 0.16)",
      "--accent-ring": "rgba(163, 190, 140, 0.18)",
      "--border": "#4c566a",
      "--border-rgb": "76 86 106",
      "--paper": "#eceff4",
      "--paper-line": "#d8dee9",
      "--paper-line-soft": "rgba(216, 222, 233, 0.8)",
      "--paper-shadow": "rgba(46, 52, 64, 0.25)",
      "--paper-action": "#e5e9f0",
      "--paper-action-hover": "#d8dee9",
      "--ink": "#2e3440",
      "--molecule-ink": "#2e3440",
      "--atom-label-color": "#5e81ac",
      "--arrow-color": "#5e81ac",
      "--arrow-opacity": "0.75",
      "--warning": "#bf616a",
      "--warning-ink": "#a54d56",
      "--warning-strong": "#a54d56",
      "--warning-bg": "#fef3c7",
      "--warning-action": "#fde68a",
      "--warning-action-hover": "#fcd34d",
      "--error-bg": "#fee2e2",
      "--overlay": "rgba(46, 52, 64, 0.8)",
      "--workbench-overlay": "rgba(46, 52, 64, 0.9)",
      "--workbench-grid": "rgba(216, 222, 233, 0.06)",
      "--dialog-shadow": "rgba(0, 0, 0, 0.4)"
    },
    molecule: {
      C: "#2e3440", O: "#2e3440", N: "#2e3440", F: "#2e3440",
      CL: "#2e3440", BR: "#2e3440", I: "#2e3440", P: "#2e3440",
      S: "#2e3440", B: "#2e3440", H: "#2e3440", BACKGROUND: "#eceff4"
    },
    arrow: { color: "#5e81ac", opacity: 0.75 },
    export: { background: "#eceff4" }
  },
  "dracula": {
    name: "Dracula",
    cssVars: {
      "--bg": "#282a36",
      "--panel": "#343746",
      "--panel-soft": "#44475a",
      "--panel-strong": "#21222c",
      "--panel-ink": "#1e1f29",
      "--text": "#f8f8f2",
      "--muted": "#bfbfbf",
      "--accent": "#50fa7b",
      "--accent-strong": "#3dd667",
      "--accent-soft": "rgba(80, 250, 123, 0.16)",
      "--accent-ring": "rgba(80, 250, 123, 0.18)",
      "--border": "#6272a4",
      "--border-rgb": "98 114 164",
      "--paper": "#f8f8f2",
      "--paper-line": "#e6e6e0",
      "--paper-line-soft": "rgba(230, 230, 224, 0.8)",
      "--paper-shadow": "rgba(40, 42, 54, 0.3)",
      "--paper-action": "#e6e6e0",
      "--paper-action-hover": "#d4d4ce",
      "--ink": "#282a36",
      "--molecule-ink": "#21222c",
      "--atom-label-color": "#bd93f9",
      "--arrow-color": "#bd93f9",
      "--arrow-opacity": "0.8",
      "--warning": "#ff5555",
      "--warning-ink": "#ff7979",
      "--warning-strong": "#ff5555",
      "--warning-bg": "#ffb86c20",
      "--warning-action": "#ffb86c40",
      "--warning-action-hover": "#ffb86c60",
      "--error-bg": "#ff555520",
      "--overlay": "rgba(40, 42, 54, 0.85)",
      "--workbench-overlay": "rgba(40, 42, 54, 0.92)",
      "--workbench-grid": "rgba(248, 248, 242, 0.05)",
      "--dialog-shadow": "rgba(0, 0, 0, 0.5)"
    },
    molecule: {
      C: "#21222c", O: "#21222c", N: "#21222c", F: "#21222c",
      CL: "#21222c", BR: "#21222c", I: "#21222c", P: "#21222c",
      S: "#21222c", B: "#21222c", H: "#21222c", BACKGROUND: "#f8f8f2"
    },
    arrow: { color: "#bd93f9", opacity: 0.8 },
    export: { background: "#f8f8f2" }
  }
};

export const DEFAULT_THEME_ID = "gruvbox-dark";

export let COLOR_THEME = THEMES[DEFAULT_THEME_ID];

export function setColorTheme(themeId) {
  const theme = THEMES[themeId];
  if (!theme) {
    return false;
  }
  COLOR_THEME = theme;
  return true;
}

export function getThemeId() {
  return Object.entries(THEMES).find(([, theme]) => theme === COLOR_THEME)?.[0] || DEFAULT_THEME_ID;
}

export function applyColorTheme(theme = COLOR_THEME, root = document.documentElement) {
  Object.entries(theme.cssVars).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
}
