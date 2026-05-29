import { parseMolBlocks } from "./parser.js";
import { renderMoleculeCard } from "./renderer.js";
import { applyColorTheme, COLOR_THEME } from "./colorTheme.js";
import "./styles.css";

export const DEFAULT_INPUT = `::mol
title: Starting structure
smiles: O=C1[C-]CCCC1
lonepairs:
  O1: 2
  C2: 1
charges:
  C2: -
arrows:
  C2.lp1 -> C1-C2 curve: left
  C1-O1 -> O1 curve: right
caption: The carbon lone pair forms the new C=C pi bond to the carbonyl carbon, and the C=O pi electrons move onto oxygen.

::mol
title: Resonance form
smiles: [O-]C1=CCCCC1
lonepairs:
  O1: 3
charges:
  O1: -
caption: The negative charge is now on oxygen, and the carbon with a lone pair originally is double-bonded to the former carbonyl carbon.`;

const OLD_DEMO_SIGNATURE = "smiles: O=C1[C-]C=CCC1";

export const GENERAL_LLM_PROMPT = `Format organic chemistry structures as molecule cards in this exact format. Use valid SMILES. Include lone pairs and formal charges as manual annotations, not inferred chemistry.

::mol
title: Starting structure
smiles: ...
lonepairs:
  O1: 2
  C2: 1
charges:
  C2: -
caption: One sentence explanation.

::mol
title: Resonance form
smiles: ...
lonepairs:
  O1: 3
charges:
  O1: -
caption: One sentence explanation.`;

export const ARROW_LLM_PROMPT = `Add curved-arrow annotations only when electron movement needs to be shown. Keep the same molecule-card format and add an arrows section. Do not infer missing lone pairs or charges; include the needed manual annotations.

Arrow endpoint syntax:
- O1.lp1 means the first lone pair drawn on O1.
- O1 means atom O1.
- C1-O1 means the bond between C1 and O1.
- N1-H1 means the first implicit hydrogen attached to N1 when the label includes hydrogens.

Example:

arrows:
  O1.lp1 -> N1-H1 curve: left
  N1-H1 -> N1 curve: right`;

const app = document.querySelector("#app");
const TABS_STORAGE_KEY = "chem-note-tabs";
const ACTIVE_TAB_STORAGE_KEY = "chem-note-active-tab";
const LEGACY_INPUT_STORAGE_KEY = "chem-note-input";
const RENDER_SETTINGS_STORAGE_KEY = "chem-note-render-settings";
const IMPORT_PREFERENCES_STORAGE_KEY = "chem-note-import-preferences";
const DEFAULT_RENDER_SETTINGS = {
  renderMode: "line",
  showExportActions: false
};
const DEFAULT_IMPORT_PREFERENCES = {
  openInNewTab: true
};

applyColorTheme(COLOR_THEME);

app.innerHTML = `
  <main class="app-shell">
    <section class="topbar" aria-label="Import controls">
      <div class="brand-block">
        <h1>Text to Chem</h1>
        <p>Browser-only renderer: no account, paste structured molecule blocks, not a full chemistry editor.</p>
      </div>
      <div class="topbar-actions">
        <span id="parseStatus"></span>
        <span id="profileStatus" class="profile-status"></span>
        <button id="importPackage" type="button" title="Paste molecule-card package">Import package</button>
        <button id="profileSettings" type="button" title="Rendering profile">Profile</button>
        <button id="copyPrompt" type="button" title="Copy base molecule-card prompt">Card prompt</button>
        <button id="copyArrowPrompt" type="button" title="Copy arrow syntax add-on">Arrow add-on</button>
      </div>
    </section>
    <nav class="source-tabs-bar" aria-label="Imported source tabs">
      <div id="sourceTabs" class="source-tabs"></div>
    </nav>
    <section class="workbench" aria-label="Render workbench">
      <section class="output-pane" aria-live="polite" aria-label="Rendered molecule cards">
        <div class="output-bar">
          <strong>Rendered cards</strong>
        </div>
        <div id="cards" class="cards"></div>
      </section>
    </section>
    <footer class="bottom-status" aria-live="polite">
      <span id="flowStatus">Ready</span>
      <span id="statusLog" class="status-log">Import package -> Review cards</span>
    </footer>
  </main>
  <dialog id="importDialog" aria-labelledby="importTitle">
    <form method="dialog" class="import-panel">
      <div class="import-heading">
        <div>
          <h2 id="importTitle">Import molecule package</h2>
          <p>Paste molecule-card text here. After import, the source closes and the app shows rendered chemistry only.</p>
        </div>
        <button id="cancelImport" type="button" aria-label="Close import panel">Close</button>
      </div>
      <div class="import-console-header">
        <strong>Package source</strong>
        <span id="importStatus">0 molecules</span>
      </div>
      <textarea id="sourceInput" spellcheck="false" aria-label="Molecule package input"></textarea>
      <div class="input-toolbar">
        <label class="new-tab-option">
          <input id="openInNewTab" type="checkbox" />
          <span>Open in new tab</span>
        </label>
        <div class="input-actions">
          <button id="clearSource" type="button" title="Clear import input">Clear</button>
          <button id="resetDemo" type="button" title="Load example package">Example</button>
          <button id="applyImport" type="button" title="Import and render package (Cmd/Ctrl+Enter)">Import</button>
        </div>
      </div>
      <details id="shortcutsPanel" class="shortcuts-panel">
        <summary>Shortcuts</summary>
        <dl>
          <div><dt>Cmd/Ctrl+Enter</dt><dd>Import package when this panel is open</dd></div>
          <div><dt>Cmd/Ctrl+/</dt><dd>Toggle shortcuts</dd></div>
          <div><dt>Esc</dt><dd>Close open panel</dd></div>
        </dl>
      </details>
    </form>
  </dialog>
  <dialog id="settingsDialog" aria-labelledby="settingsTitle">
    <form method="dialog" class="settings-panel">
      <div class="import-heading">
        <div>
          <h2 id="settingsTitle">Study profile</h2>
          <p>Choose how molecule cards render across imported tabs.</p>
        </div>
        <button id="closeSettings" type="button" aria-label="Close profile settings">Close</button>
      </div>
      <fieldset class="settings-group">
        <legend>Render style</legend>
        <label class="render-mode-option">
          <input type="radio" name="renderMode" value="line" />
          <span>
            <strong>Line drawing</strong>
            <small>Skeletal organic notation, matching the current card style.</small>
          </span>
        </label>
        <label class="render-mode-option">
          <input type="radio" name="renderMode" value="lewis" />
          <span>
            <strong>Condensed C/H labels</strong>
            <small>Labels every carbon and shows attached hydrogens as compact C/H text like CH3.</small>
          </span>
        </label>
        <label class="render-mode-option">
          <input type="radio" name="renderMode" value="expandedHydrogens" />
          <span>
            <strong>Expanded H bonds</strong>
            <small>Draws separate bond lines to individual H labels instead of condensed H2/H3 text.</small>
          </span>
        </label>
      </fieldset>
      <fieldset class="settings-group">
        <legend>Card controls</legend>
        <label class="settings-check-option">
          <input id="showExportActions" type="checkbox" />
          <span>
            <strong>Show SVG/PNG export buttons</strong>
            <small>Adds export controls to each rendered molecule card.</small>
          </span>
        </label>
      </fieldset>
    </form>
  </dialog>
`;

const input = document.querySelector("#sourceInput");
const cards = document.querySelector("#cards");
const parseStatus = document.querySelector("#parseStatus");
const profileStatus = document.querySelector("#profileStatus");
const importStatus = document.querySelector("#importStatus");
const statusLog = document.querySelector("#statusLog");
const flowStatus = document.querySelector("#flowStatus");
const shortcutsPanel = document.querySelector("#shortcutsPanel");
const sourceTabs = document.querySelector("#sourceTabs");
const importDialog = document.querySelector("#importDialog");
const settingsDialog = document.querySelector("#settingsDialog");
const importPackage = document.querySelector("#importPackage");
const profileSettings = document.querySelector("#profileSettings");
const openInNewTab = document.querySelector("#openInNewTab");
const copyPrompt = document.querySelector("#copyPrompt");
const copyArrowPrompt = document.querySelector("#copyArrowPrompt");
const closeSettings = document.querySelector("#closeSettings");
const cancelImport = document.querySelector("#cancelImport");
const applyImport = document.querySelector("#applyImport");
const clearSource = document.querySelector("#clearSource");
const resetDemo = document.querySelector("#resetDemo");
const renderModeInputs = Array.from(document.querySelectorAll("input[name='renderMode']"));
const showExportActions = document.querySelector("#showExportActions");
let renderSequence = 0;
let inputVersion = 0;
let tabs = loadTabs();
let activeTabId = loadActiveTabId(tabs);
let renderSettings = loadRenderSettings();
let importPreferences = loadImportPreferences();

input.value = "";
openInNewTab.checked = importPreferences.openInNewTab;
syncSettingsUi();
updateProfileStatus();
updateImportStatus();

input.addEventListener("input", () => {
  updateImportStatus();
});

input.addEventListener("dragover", (event) => {
  event.preventDefault();
});

input.addEventListener("drop", async (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    input.value = await file.text();
  } else {
    input.value = event.dataTransfer?.getData("text/plain") || input.value;
  }
  updateImportStatus();
  flowStatus.textContent = "Source loaded";
});

openInNewTab.addEventListener("change", () => {
  importPreferences.openInNewTab = openInNewTab.checked;
  saveImportPreferences();
});

profileSettings.addEventListener("click", () => settingsDialog.showModal());
closeSettings.addEventListener("click", () => settingsDialog.close());
importPackage.addEventListener("click", () => {
  input.value = "";
  updateImportStatus();
  importDialog.showModal();
  input.focus();
});
cancelImport.addEventListener("click", () => importDialog.close());

settingsDialog.addEventListener("change", (event) => {
  if (event.target.name === "renderMode") {
    renderSettings = normalizeRenderSettings({
      ...renderSettings,
      renderMode: event.target.value
    });
  } else if (event.target === showExportActions) {
    renderSettings = normalizeRenderSettings({
      ...renderSettings,
      showExportActions: showExportActions.checked
    });
  } else {
    return;
  }

  saveRenderSettings();
  updateProfileStatus();
  inputVersion += 1;
  renderFromInput();
});

applyImport.addEventListener("click", (event) => {
  event.preventDefault();
  applyImportedSource();
});

clearSource.addEventListener("click", () => {
  input.value = "";
  updateImportStatus();
  flowStatus.textContent = "Cleared";
  input.focus();
});

sourceTabs.addEventListener("click", (event) => {
  const closeButton = event.target.closest("button[data-close-tab]");
  if (closeButton) {
    closeTab(closeButton.dataset.closeTab);
    return;
  }

  const tabButton = event.target.closest("button[data-tab-id]");
  if (!tabButton) {
    return;
  }

  setActiveTab(tabButton.dataset.tabId);
});

cards.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const card = button.closest(".molecule-card");
  if (!card) {
    return;
  }

  if (button.dataset.action === "copy-warnings") {
    const warning = button.closest(".annotation-warning");
    const warningText = warning?.dataset.warningText || warning?.innerText || "";
    try {
      await navigator.clipboard.writeText(warningText);
      flashButton(button, "Copied");
    } catch {
      flashButton(button, "Failed");
    }
    return;
  }

  const svg = card?.querySelector(".molecule-svg");
  if (!svg) {
    return;
  }

  try {
    if (button.dataset.action === "download-svg") {
      downloadText(`${getFileName(card)}.svg`, serializeSvg(svg), "image/svg+xml");
    } else if (button.dataset.action === "download-png") {
      await downloadPng(card, svg);
    }
    flashButton(button, "Saved");
  } catch (error) {
    flashButton(button, "Failed");
  }
});

copyPrompt.addEventListener("click", async () => {
  await copyPromptText(copyPrompt, GENERAL_LLM_PROMPT, "Copy card prompt");
});

copyArrowPrompt.addEventListener("click", async () => {
  await copyPromptText(copyArrowPrompt, ARROW_LLM_PROMPT, "Copy arrow add-on");
});

resetDemo.addEventListener("click", () => {
  input.value = DEFAULT_INPUT;
  updateImportStatus();
  flowStatus.textContent = "Example loaded";
});

document.addEventListener("keydown", (event) => {
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && event.key === "Enter" && importDialog.open) {
    event.preventDefault();
    applyImportedSource();
  } else if (modifier && event.key === "/" && importDialog.open) {
    event.preventDefault();
    shortcutsPanel.open = !shortcutsPanel.open;
  } else if (event.key === "Escape" && importDialog.open) {
    importDialog.close();
  } else if (event.key === "Escape" && settingsDialog.open) {
    settingsDialog.close();
  }
});

renderTabs();
renderFromInput();
registerServiceWorker();

function updateImportStatus() {
  const mols = parseMolBlocks(input.value);
  const countText = `${mols.length} molecule${mols.length === 1 ? "" : "s"}`;
  importStatus.textContent = countText;
  const parseWarningCount = mols.reduce((sum, mol) => sum + (mol.parseWarnings?.length || 0), 0);
  if (mols.length === 0) {
    if (importDialog.open) {
      statusLog.textContent = "No ::mol blocks found in the import package.";
      flowStatus.textContent = "Waiting for import";
    }
  } else if (parseWarningCount > 0) {
    statusLog.textContent = `${parseWarningCount} parse warning${parseWarningCount === 1 ? "" : "s"} before render. Render to see card details.`;
    flowStatus.textContent = "Warnings";
  } else {
    statusLog.textContent = `Ready to render ${countText}.`;
    flowStatus.textContent = "Ready";
  }
}

function applyImportedSource() {
  const source = input.value;
  const mols = parseMolBlocks(source);
  if (mols.length === 0) {
    statusLog.textContent = "Import failed: no ::mol blocks found.";
    flowStatus.textContent = "Import failed";
    return;
  }

  importPreferences.openInNewTab = openInNewTab.checked;
  saveImportPreferences();

  if (openInNewTab.checked || !getActiveTab()) {
    const tab = createTab(source);
    tabs.push(tab);
    activeTabId = tab.id;
  } else {
    const activeTab = getActiveTab();
    activeTab.source = source;
    activeTab.title = makeTabTitle(source);
  }

  inputVersion += 1;
  saveTabs();
  renderTabs();
  closeImportPanel();
  renderFromInput();
}

async function renderFromInput() {
  const sequence = ++renderSequence;
  const version = inputVersion;
  const mols = getActiveMols();
  parseStatus.textContent = `${mols.length} molecule${mols.length === 1 ? "" : "s"}`;

  if (mols.length === 0) {
    cards.innerHTML = `<div class="empty-state">No molecule blocks found.</div>`;
    flowStatus.textContent = "No cards";
    return;
  }

  const fragments = document.createDocumentFragment();
  const renderContext = { layoutsByTitle: new Map() };
  const renderedCards = [];
  for (let index = 0; index < mols.length; index += 1) {
    renderedCards.push(await renderMoleculeCard(mols[index], index, renderSettings, renderContext));
  }
  if (sequence !== renderSequence || version !== inputVersion) {
    return;
  }

  cards.innerHTML = "";
  renderedCards.forEach((card) => fragments.appendChild(card));
  cards.appendChild(fragments);
  const warningTexts = Array.from(cards.querySelectorAll(".annotation-warning"))
    .map((warning) => warning.dataset.warningText)
    .filter(Boolean);
  flowStatus.textContent = warningTexts.length ? `${warningTexts.length} warning${warningTexts.length === 1 ? "" : "s"}` : "Rendered";
  statusLog.textContent = warningTexts.length
    ? warningTexts.join("\n\n")
    : `Rendered ${mols.length} molecule card${mols.length === 1 ? "" : "s"} without warnings.`;
}

function renderTabs() {
  sourceTabs.innerHTML = "";

  tabs.forEach((tab) => {
    const wrapper = document.createElement("div");
    wrapper.className = `source-tab${tab.id === activeTabId ? " is-active" : ""}`;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.tabId = tab.id;
    button.textContent = tab.title;

    const close = document.createElement("button");
    close.type = "button";
    close.dataset.closeTab = tab.id;
    close.setAttribute("aria-label", `Close ${tab.title}`);
    close.textContent = "x";

    wrapper.append(button, close);
    sourceTabs.appendChild(wrapper);
  });
}

function setActiveTab(tabId) {
  if (!tabs.some((tab) => tab.id === tabId)) {
    return;
  }

  activeTabId = tabId;
  inputVersion += 1;
  saveTabs();
  renderTabs();
  closeImportPanel();
  renderFromInput();
}

function closeTab(tabId) {
  if (tabs.length === 1) {
    tabs = [createTab(DEFAULT_INPUT, "Demo")];
    activeTabId = tabs[0].id;
  } else {
    const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
    tabs = tabs.filter((tab) => tab.id !== tabId);
    if (activeTabId === tabId) {
      activeTabId = tabs[Math.max(0, closingIndex - 1)]?.id || tabs[0].id;
    }
  }

  inputVersion += 1;
  saveTabs();
  renderTabs();
  closeImportPanel();
  renderFromInput();
}

function closeImportPanel() {
  input.value = "";
  updateImportStatus();
  if (importDialog.open) {
    importDialog.close();
  }
}

function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId) || tabs[0];
}

function getActiveMols() {
  return parseMolBlocks(getActiveTab()?.source || "");
}

function loadTabs() {
  try {
    const savedTabs = JSON.parse(localStorage.getItem(TABS_STORAGE_KEY) || "[]");
    if (Array.isArray(savedTabs) && savedTabs.length > 0) {
      return savedTabs
        .filter((tab) => tab && typeof tab.source === "string")
        .map((tab) => ({
          id: tab.id || makeTabId(),
          title: tab.title || makeTabTitle(tab.source),
          source: normalizeSavedSource(tab.source, tab.title)
        }));
    }
  } catch {
    // Fall through to legacy/default state.
  }

  return [createTab(normalizeSavedSource(localStorage.getItem(LEGACY_INPUT_STORAGE_KEY) || DEFAULT_INPUT, "Demo"), "Demo")];
}

function normalizeSavedSource(source, title = "") {
  if ((title === "Demo" || title === "Starting structure") && source.includes(OLD_DEMO_SIGNATURE)) {
    return DEFAULT_INPUT;
  }

  return source;
}

function loadActiveTabId(tabList) {
  const savedId = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
  return tabList.some((tab) => tab.id === savedId) ? savedId : tabList[0].id;
}

function saveTabs() {
  localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
  localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTabId);
}

function loadRenderSettings() {
  try {
    return normalizeRenderSettings(JSON.parse(localStorage.getItem(RENDER_SETTINGS_STORAGE_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_RENDER_SETTINGS };
  }
}

function saveRenderSettings() {
  localStorage.setItem(RENDER_SETTINGS_STORAGE_KEY, JSON.stringify(renderSettings));
}

function loadImportPreferences() {
  try {
    return normalizeImportPreferences(JSON.parse(localStorage.getItem(IMPORT_PREFERENCES_STORAGE_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_IMPORT_PREFERENCES };
  }
}

function saveImportPreferences() {
  localStorage.setItem(IMPORT_PREFERENCES_STORAGE_KEY, JSON.stringify(importPreferences));
}

function normalizeImportPreferences(preferences) {
  return {
    ...DEFAULT_IMPORT_PREFERENCES,
    ...preferences,
    openInNewTab: typeof preferences?.openInNewTab === "boolean"
      ? preferences.openInNewTab
      : DEFAULT_IMPORT_PREFERENCES.openInNewTab
  };
}

function normalizeRenderSettings(settings) {
  const validModes = new Set(["line", "lewis", "expandedHydrogens"]);
  return {
    ...DEFAULT_RENDER_SETTINGS,
    ...settings,
    renderMode: validModes.has(settings?.renderMode) ? settings.renderMode : "line",
    showExportActions: typeof settings?.showExportActions === "boolean"
      ? settings.showExportActions
      : DEFAULT_RENDER_SETTINGS.showExportActions
  };
}

function syncSettingsUi() {
  renderModeInputs.forEach((inputElement) => {
    inputElement.checked = inputElement.value === renderSettings.renderMode;
  });
  showExportActions.checked = renderSettings.showExportActions;
}

function updateProfileStatus() {
  const labels = {
    line: "Line drawing",
    lewis: "Condensed C/H",
    expandedHydrogens: "Expanded H bonds"
  };
  profileStatus.textContent = labels[renderSettings.renderMode] || labels.line;
}

function createTab(source, fallbackTitle = "") {
  return {
    id: makeTabId(),
    title: makeTabTitle(source, fallbackTitle),
    source
  };
}

function makeTabId() {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeTabTitle(source, fallbackTitle = "Import") {
  const firstMol = parseMolBlocks(source)[0];
  const title = firstMol?.title?.trim() || fallbackTitle;
  return title || "Untitled";
}

function serializeSvg(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", "1040");
  clone.setAttribute("height", "600");

  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", "520");
  background.setAttribute("height", "300");
  background.setAttribute("fill", COLOR_THEME.export.background);
  clone.insertBefore(background, clone.firstChild);

  return new XMLSerializer().serializeToString(clone);
}

async function downloadPng(card, svg) {
  const image = new Image();
  const blob = new Blob([serializeSvg(svg)], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    image.src = url;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = 1040;
    canvas.height = 600;
    const context = canvas.getContext("2d");
    context.fillStyle = COLOR_THEME.export.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
    downloadBlob(`${getFileName(card)}.png`, pngBlob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadText(fileName, text, type) {
  downloadBlob(fileName, new Blob([text], { type: `${type};charset=utf-8` }));
}

function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function getFileName(card) {
  const title = card.dataset.title || "molecule";
  const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return safeTitle || "molecule";
}

function flashButton(button, label) {
  const original = button.textContent;
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1000);
}

async function copyPromptText(button, text, originalLabel) {
  await navigator.clipboard.writeText(text);
  button.textContent = "Copied";
  window.setTimeout(() => {
    button.textContent = originalLabel;
  }, 1200);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Offline install is best-effort; rendering should never depend on it.
    });
  });
}
