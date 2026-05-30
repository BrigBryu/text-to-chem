import { parseMolBlocks } from "./parser.js";
import { renderMoleculeCard } from "./renderer.js";
import { applyColorTheme, COLOR_THEME, THEMES, DEFAULT_THEME_ID, setColorTheme, getThemeId } from "./colorTheme.js";
import { bucketCount, initAnalytics, trackUsageEvent } from "./analytics.js";
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

export const GENERAL_LLM_PROMPT = `Format organic chemistry structures as molecule cards. CRITICAL: Put ALL molecules in a SINGLE code block.

Use valid SMILES. Include lone pairs and formal charges as manual annotations (not inferred from SMILES).

ATOM NUMBERING: Count each element type left-to-right as it appears in the SMILES string.
Example: In "O=CC(O)C", C1 is the first carbon, C2 is the second, C3 is the third; O1 is the first oxygen, O2 is the second.

FORMAT:
::mol
title: Starting structure
smiles: O=C1[C-]CCCC1
lonepairs:
  O1: 2
  C2: 1
charges:
  C2: -
caption: One sentence explanation.

::mol
title: Resonance form
smiles: [O-]C1=CCCCC1
lonepairs:
  O1: 3
charges:
  O1: -
caption: One sentence explanation.

CRITICAL NOTES:
- ALL molecules must be in ONE code block, each starting with ::mol
- Atom refs like O1, C2 are element+count, NOT position in SMILES
- Always include lonepairs/charges sections even if empty
- Cards are numbered 1, 2, 3... in render order for easy reference`;

export const ARROW_LLM_PROMPT = `Add curved-arrow annotations for electron movement. Keep the same molecule-card format and add an arrows section.

ARROW ENDPOINT REFERENCE:
- Lone pair: O1.lp1 (first lone pair on O1), N1.lp2 (second lone pair on N1)
- Atom: O1, C2, N1 (just the atom reference)
- Bond: C1-O1 (bond between C1 and O1), C2-C3 (bond between C2 and C3)
- Implicit H: N1-H1 (first H attached to N1)

EXAMPLES:
arrows:
  O1.lp1 -> C1-O1 curve: left    # lone pair attacks a bond
  C1-O1 -> O1 curve: right       # pi electrons move to oxygen
  N1.lp1 -> N1-H1 curve: left    # lone pair attacks leaving group
  N1-H1 -> H1 curve: right       # bond breaks, H leaves

CRITICAL: Each arrow is FROM -> TO with optional curve: left/right.
Include lonepairs annotations for any atom that needs an arrow from a lone pair.`;

const app = document.querySelector("#app");
const TABS_STORAGE_KEY = "chem-note-tabs";
const ACTIVE_TAB_STORAGE_KEY = "chem-note-active-tab";
const LEGACY_INPUT_STORAGE_KEY = "chem-note-input";
const RENDER_SETTINGS_STORAGE_KEY = "chem-note-render-settings";
const IMPORT_PREFERENCES_STORAGE_KEY = "chem-note-import-preferences";
const THEME_STORAGE_KEY = "chem-note-theme";
const TOPBAR_COLLAPSED_STORAGE_KEY = "chem-note-topbar-collapsed";
const DEFAULT_RENDER_SETTINGS = {
  renderMode: "line",
  showExportActions: false,
  maxTabs: 10,
  transparentBackground: false
};
const DEFAULT_IMPORT_PREFERENCES = {
  openInNewTab: true
};

loadAndApplyTheme();

app.innerHTML = `
  <main class="app-shell">
    <section class="topbar" aria-label="Import controls">
      <button id="topbarToggle" type="button" class="topbar-toggle" aria-label="Toggle top bar" title="Collapse/expand toolbar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.5 6.5L8 10L11.5 6.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="topbar-actions">
        <button id="importPackage" type="button" title="Paste molecule-card package">Import</button>
        <button id="copyPackage" type="button" title="Copy the active molecule-card package">Copy All</button>
        <button id="copyPrompt" type="button" title="Copy base molecule-card prompt">Prompt</button>
        <button id="copyArrowPrompt" type="button" title="Copy arrow syntax add-on">Arrow Guide</button>
        <button id="profileSettings" type="button" title="Rendering settings">Settings</button>
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
        <summary>Vim Shortcuts</summary>
        <dl>
          <div><dt>j / k</dt><dd>Next / previous card</dd></div>
          <div><dt>g g</dt><dd>Go to first card</dd></div>
          <div><dt>G</dt><dd>Go to last card</dd></div>
          <div><dt>g 1-9</dt><dd>Go to card by number</dd></div>
          <div><dt>y</dt><dd>Yank selected card</dd></div>
          <div><dt>Y / y y</dt><dd>Yank all cards</dd></div>
          <div><dt>y p</dt><dd>Yank prompt</dd></div>
          <div><dt>y a</dt><dd>Yank arrow guide</dd></div>
          <div><dt>p</dt><dd>Put (replace selected card)</dd></div>
          <div><dt>i</dt><dd>Import from clipboard</dd></div>
          <div><dt>g s</dt><dd>Go to settings</dd></div>
          <div><dt>?</dt><dd>Help (this menu)</dd></div>
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
        <label class="settings-check-option">
          <input id="transparentBackground" type="checkbox" />
          <span>
            <strong>Transparent background</strong>
            <small>Use transparent backgrounds for card exports and reduced opacity for panels.</small>
          </span>
        </label>
      </fieldset>
      <fieldset class="settings-group">
        <legend>Color theme</legend>
        <div class="theme-selector">
          <select id="themeSelect">
            ${Object.entries(THEMES).map(([id, theme]) =>
              `<option value="${id}">${theme.name}</option>`
            ).join("")}
          </select>
        </div>
      </fieldset>
      <fieldset class="settings-group">
        <legend>Tab limit</legend>
        <div class="max-tabs-setting">
          <input type="range" id="maxTabsSlider" min="1" max="50" />
          <span id="maxTabsValue">10</span>
        </div>
        <small class="settings-hint">Maximum number of open tabs. Oldest tabs are removed when limit is exceeded.</small>
      </fieldset>
    </form>
  </dialog>
`;

const input = document.querySelector("#sourceInput");
const cards = document.querySelector("#cards");
const importStatus = document.querySelector("#importStatus");
const shortcutsPanel = document.querySelector("#shortcutsPanel");
const sourceTabs = document.querySelector("#sourceTabs");
const importDialog = document.querySelector("#importDialog");
const settingsDialog = document.querySelector("#settingsDialog");
const importPackage = document.querySelector("#importPackage");
const profileSettings = document.querySelector("#profileSettings");
const openInNewTab = document.querySelector("#openInNewTab");
const copyPackage = document.querySelector("#copyPackage");
const copyPrompt = document.querySelector("#copyPrompt");
const copyArrowPrompt = document.querySelector("#copyArrowPrompt");
const closeSettings = document.querySelector("#closeSettings");
const cancelImport = document.querySelector("#cancelImport");
const applyImport = document.querySelector("#applyImport");
const clearSource = document.querySelector("#clearSource");
const resetDemo = document.querySelector("#resetDemo");
const renderModeInputs = Array.from(document.querySelectorAll("input[name='renderMode']"));
const showExportActions = document.querySelector("#showExportActions");
const transparentBackground = document.querySelector("#transparentBackground");
const themeSelect = document.querySelector("#themeSelect");
const maxTabsSlider = document.querySelector("#maxTabsSlider");
const maxTabsValue = document.querySelector("#maxTabsValue");
const topbarToggle = document.querySelector("#topbarToggle");
const topbar = document.querySelector(".topbar");
const appShell = document.querySelector(".app-shell");
let renderSequence = 0;
let inputVersion = 0;
let tabs = loadTabs();
let activeTabId = loadActiveTabId(tabs);
let renderSettings = loadRenderSettings();
let importPreferences = loadImportPreferences();
let pendingTrackedRender = null;

initAnalytics();
input.value = "";
openInNewTab.checked = importPreferences.openInNewTab;
syncSettingsUi();
updateImportStatus();
initTopbarCollapse();

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
});

openInNewTab.addEventListener("change", () => {
  importPreferences.openInNewTab = openInNewTab.checked;
  saveImportPreferences();
});

profileSettings.addEventListener("click", () => settingsDialog.showModal());
closeSettings.addEventListener("click", () => settingsDialog.close());
importPackage.addEventListener("click", () => {
  trackUsageEvent("import-opened");
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
    saveRenderSettings();
    trackUsageEvent("profile-changed", event.target.value);
    inputVersion += 1;
    renderFromInput();
  } else if (event.target === showExportActions) {
    renderSettings = normalizeRenderSettings({
      ...renderSettings,
      showExportActions: showExportActions.checked
    });
    saveRenderSettings();
    trackUsageEvent("profile-changed", "export-controls");
    inputVersion += 1;
    renderFromInput();
  } else if (event.target === themeSelect) {
    const themeId = themeSelect.value;
    if (setColorTheme(themeId)) {
      applyColorTheme(COLOR_THEME);
      saveTheme(themeId);
      trackUsageEvent("theme-changed", themeId);
      inputVersion += 1;
      renderFromInput();
    }
  } else if (event.target === maxTabsSlider) {
    const maxTabs = Number.parseInt(maxTabsSlider.value, 10);
    renderSettings = normalizeRenderSettings({
      ...renderSettings,
      maxTabs
    });
    maxTabsValue.textContent = String(maxTabs);
    saveRenderSettings();
    enforceMaxTabs();
    trackUsageEvent("profile-changed", `max-tabs-${maxTabs}`);
  } else if (event.target === transparentBackground) {
    renderSettings = normalizeRenderSettings({
      ...renderSettings,
      transparentBackground: transparentBackground.checked
    });
    saveRenderSettings();
    applyTransparentMode(renderSettings.transparentBackground);
    trackUsageEvent("profile-changed", "transparent-background");
    inputVersion += 1;
    renderFromInput();
  }
});

applyImport.addEventListener("click", (event) => {
  event.preventDefault();
  applyImportedSource();
});

clearSource.addEventListener("click", () => {
  input.value = "";
  updateImportStatus();
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
      trackUsageEvent("warnings-copied");
      flashButton(button, "Copied");
    } catch {
      flashButton(button, "Failed");
    }
    return;
  }

  if (button.dataset.action === "copy-card") {
    const cardIndex = Number.parseInt(card.dataset.cardIndex || "0", 10);
    const cardSource = extractMolBlock(getActiveTab()?.source || "", cardIndex);
    if (!cardSource) {
      flashButton(button, "Empty");
      return;
    }
    try {
      await navigator.clipboard.writeText(cardSource);
      trackUsageEvent("card-copied");
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
      trackUsageEvent("export-clicked", "svg");
    } else if (button.dataset.action === "download-png") {
      await downloadPng(card, svg);
      trackUsageEvent("export-clicked", "png");
    }
    flashButton(button, "Saved");
  } catch (error) {
    flashButton(button, "Failed");
  }
});

copyPrompt.addEventListener("click", async () => {
  await copyPromptText(copyPrompt, GENERAL_LLM_PROMPT, "Prompt");
});

copyArrowPrompt.addEventListener("click", async () => {
  await copyPromptText(copyArrowPrompt, ARROW_LLM_PROMPT, "Arrow Guide");
});

copyPackage.addEventListener("click", async () => {
  const source = getActiveTab()?.source || "";
  if (!source.trim()) {
    flashButton(copyPackage, "Empty");
    return;
  }

  try {
    await navigator.clipboard.writeText(source);
    trackUsageEvent("package-copied");
    flashButton(copyPackage, "Copied");
  } catch {
    flashButton(copyPackage, "Failed");
  }
});

topbarToggle.addEventListener("click", () => {
  toggleTopbarCollapse();
});

resetDemo.addEventListener("click", () => {
  input.value = DEFAULT_INPUT;
  updateImportStatus();
});

let pendingChordKey = null;
let pendingChordTimestamp = 0;
let selectedCardIndex = 0;
const CHORD_TIMEOUT = 500;

function handleChordKey(event) {
  const now = Date.now();
  const isInputFocused = document.activeElement?.tagName === "INPUT" ||
    document.activeElement?.tagName === "TEXTAREA" ||
    document.activeElement?.tagName === "SELECT";

  if (isInputFocused || importDialog.open || settingsDialog.open) {
    pendingChordKey = null;
    return false;
  }

  const noMod = !event.metaKey && !event.ctrlKey && !event.altKey;

  // Single key commands
  if (event.key === "?" && noMod) {
    event.preventDefault();
    openShortcutsMenu();
    pendingChordKey = null;
    return true;
  }

  // j/k navigation
  if (event.key === "j" && noMod && !event.shiftKey) {
    event.preventDefault();
    selectCard(selectedCardIndex + 1);
    pendingChordKey = null;
    return true;
  }

  if (event.key === "k" && noMod && !event.shiftKey) {
    event.preventDefault();
    selectCard(selectedCardIndex - 1);
    pendingChordKey = null;
    return true;
  }

  // G - go to last card
  if (event.key === "G" && noMod) {
    event.preventDefault();
    selectCard(getCardCount() - 1);
    pendingChordKey = null;
    return true;
  }

  // Y - yank all
  if (event.key === "Y" && noMod) {
    event.preventDefault();
    yankAllCards();
    pendingChordKey = null;
    return true;
  }

  // y (no shift) - yank selected card
  if (event.key === "y" && noMod && !event.shiftKey && !pendingChordKey) {
    pendingChordKey = "y";
    pendingChordTimestamp = now;
    return false;
  }

  // p - destructive put (replace selected card)
  if (event.key === "p" && noMod && !event.shiftKey) {
    event.preventDefault();
    putReplaceCard();
    pendingChordKey = null;
    return true;
  }

  // i - import from clipboard (add new)
  if (event.key === "i" && noMod && !event.shiftKey) {
    event.preventDefault();
    importFromClipboard();
    pendingChordKey = null;
    return true;
  }

  // Handle chord sequences
  if (pendingChordKey && now - pendingChordTimestamp < CHORD_TIMEOUT) {
    // y chords
    if (pendingChordKey === "y") {
      // y y - yank all
      if (event.key === "y") {
        event.preventDefault();
        yankAllCards();
        pendingChordKey = null;
        return true;
      }
      // y p - yank prompt
      if (event.key === "p") {
        event.preventDefault();
        copyPrompt.click();
        pendingChordKey = null;
        return true;
      }
      // y a - yank arrow guide
      if (event.key === "a") {
        event.preventDefault();
        copyArrowPrompt.click();
        pendingChordKey = null;
        return true;
      }
      // Single y with no follow-up after timeout will yank selected card
    }

    // g chords (go to)
    if (pendingChordKey === "g") {
      // g g - go to first card
      if (event.key === "g") {
        event.preventDefault();
        selectCard(0);
        pendingChordKey = null;
        return true;
      }
      // g 1-9 - go to specific card
      const cardNum = Number.parseInt(event.key, 10);
      if (cardNum >= 1 && cardNum <= 9) {
        event.preventDefault();
        selectCard(cardNum - 1);
        pendingChordKey = null;
        return true;
      }
      // g s - go to settings
      if (event.key === "s") {
        event.preventDefault();
        profileSettings.click();
        pendingChordKey = null;
        return true;
      }
    }
  }

  // Start g chord
  if (event.key === "g" && noMod && !event.shiftKey) {
    pendingChordKey = "g";
    pendingChordTimestamp = now;
    return false;
  }

  // If y was pressed and no valid follow-up, yank selected card
  if (pendingChordKey === "y" && now - pendingChordTimestamp >= CHORD_TIMEOUT) {
    yankSelectedCard();
  }

  pendingChordKey = null;
  return false;
}

// Handle y timeout to yank selected card
setInterval(() => {
  if (pendingChordKey === "y" && Date.now() - pendingChordTimestamp >= CHORD_TIMEOUT) {
    yankSelectedCard();
    pendingChordKey = null;
  }
}, 100);

function getCardCount() {
  return cards.querySelectorAll(".molecule-card").length;
}

function selectCard(index) {
  const cardElements = cards.querySelectorAll(".molecule-card");
  const count = cardElements.length;
  if (count === 0) {
    return;
  }

  // Clamp index
  const newIndex = Math.max(0, Math.min(count - 1, index));
  selectedCardIndex = newIndex;

  // Update selection styling
  cardElements.forEach((card, i) => {
    card.classList.toggle("selected", i === newIndex);
  });

  // Scroll to card
  const selectedCard = cardElements[newIndex];
  if (selectedCard) {
    selectedCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  showVimFeedback(`Card ${newIndex + 1}/${count}`);
}

function yankSelectedCard() {
  const cardSource = extractMolBlock(getActiveTab()?.source || "", selectedCardIndex);
  if (!cardSource) {
    showVimFeedback("No card to yank");
    return;
  }
  navigator.clipboard.writeText(cardSource).then(() => {
    trackUsageEvent("card-yanked");
    showVimFeedback(`Yanked card ${selectedCardIndex + 1}`);
  }).catch(() => {
    showVimFeedback("Yank failed");
  });
}

function yankAllCards() {
  const source = getActiveTab()?.source || "";
  if (!source.trim()) {
    showVimFeedback("Nothing to yank");
    return;
  }
  navigator.clipboard.writeText(source).then(() => {
    trackUsageEvent("package-copied");
    showVimFeedback("Yanked all cards");
  }).catch(() => {
    showVimFeedback("Yank failed");
  });
}

async function putReplaceCard() {
  try {
    const clipboardText = await navigator.clipboard.readText();
    if (!clipboardText.trim()) {
      showVimFeedback("Clipboard empty");
      return;
    }

    const source = getActiveTab()?.source || "";
    const newSource = replaceMolBlock(source, selectedCardIndex, clipboardText.trim());

    if (newSource === source) {
      showVimFeedback("No card to replace");
      return;
    }

    const activeTab = getActiveTab();
    if (activeTab) {
      activeTab.source = newSource;
      activeTab.title = makeTabTitle(newSource);
      saveTabs();
      inputVersion += 1;
      renderFromInput();
      trackUsageEvent("card-put");
      showVimFeedback(`Replaced card ${selectedCardIndex + 1}`);
    }
  } catch {
    showVimFeedback("Put failed");
  }
}

async function importFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showVimFeedback("Clipboard empty");
      return;
    }
    input.value = text;
    updateImportStatus();
    applyImportedSource();
    trackUsageEvent("vim-import");
    showVimFeedback("Imported");
  } catch {
    showVimFeedback("Import failed");
  }
}

function replaceMolBlock(source, index, newContent) {
  const blocks = [];
  const molPattern = /::mol\b/g;
  let match;
  while ((match = molPattern.exec(source)) !== null) {
    blocks.push(match.index);
  }

  if (index < 0 || index >= blocks.length) {
    return source;
  }

  const start = blocks[index];
  const end = index + 1 < blocks.length ? blocks[index + 1] : source.length;

  // Ensure newContent starts with ::mol if it doesn't
  const normalizedContent = newContent.startsWith("::mol") ? newContent : `::mol\n${newContent}`;

  return source.slice(0, start) + normalizedContent + "\n\n" + source.slice(end).trimStart();
}

function showVimFeedback(message) {
  const existing = document.querySelector(".vim-feedback");
  if (existing) {
    existing.remove();
  }
  const feedback = document.createElement("div");
  feedback.className = "vim-feedback";
  feedback.textContent = message;
  document.body.appendChild(feedback);
  window.setTimeout(() => feedback.remove(), 1200);
}

function openShortcutsMenu() {
  importDialog.showModal();
  shortcutsPanel.open = true;
  input.focus();
}

document.addEventListener("keydown", (event) => {
  if (handleChordKey(event)) {
    return;
  }

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
}

function applyImportedSource() {
  const source = input.value;
  const mols = parseMolBlocks(source);
  if (mols.length === 0) {
    trackUsageEvent("import-failed", "empty");
    return;
  }

  importPreferences.openInNewTab = openInNewTab.checked;
  saveImportPreferences();

  if (openInNewTab.checked || !getActiveTab()) {
    const tab = createTab(source);
    tabs.push(tab);
    activeTabId = tab.id;
    enforceMaxTabs();
  } else {
    const activeTab = getActiveTab();
    activeTab.source = source;
    activeTab.title = makeTabTitle(source);
  }

  inputVersion += 1;
  pendingTrackedRender = { molCount: mols.length };
  trackUsageEvent("import-applied", `cards-${bucketCount(mols.length)}`);
  saveTabs();
  renderTabs();
  closeImportPanel();
  renderFromInput();
}

async function renderFromInput() {
  const sequence = ++renderSequence;
  const version = inputVersion;
  const mols = getActiveMols();

  if (mols.length === 0) {
    cards.innerHTML = `<div class="empty-state">No molecule blocks found.</div>`;
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
  const errorCount = cards.querySelectorAll(".render-error").length;
  trackRenderCompletion(mols.length, warningTexts.length, errorCount);

  // Initialize card selection
  selectedCardIndex = Math.min(selectedCardIndex, mols.length - 1);
  const cardElements = cards.querySelectorAll(".molecule-card");
  cardElements.forEach((card, i) => {
    card.classList.toggle("selected", i === selectedCardIndex);
  });
}

function trackRenderCompletion(cardCount, warningCount, errorCount) {
  if (!pendingTrackedRender) {
    return;
  }

  pendingTrackedRender = null;
  trackUsageEvent("render-completed", `cards-${bucketCount(cardCount)}`);
  trackUsageEvent("render-warnings", `warnings-${bucketCount(warningCount)}`);
  if (errorCount > 0) {
    trackUsageEvent("render-errors", `errors-${bucketCount(errorCount)}`);
  }
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
  const rawMaxTabs = Number.parseInt(settings?.maxTabs, 10);
  return {
    ...DEFAULT_RENDER_SETTINGS,
    ...settings,
    renderMode: validModes.has(settings?.renderMode) ? settings.renderMode : "line",
    showExportActions: typeof settings?.showExportActions === "boolean"
      ? settings.showExportActions
      : DEFAULT_RENDER_SETTINGS.showExportActions,
    maxTabs: Number.isFinite(rawMaxTabs) && rawMaxTabs >= 1 && rawMaxTabs <= 50
      ? rawMaxTabs
      : DEFAULT_RENDER_SETTINGS.maxTabs,
    transparentBackground: typeof settings?.transparentBackground === "boolean"
      ? settings.transparentBackground
      : DEFAULT_RENDER_SETTINGS.transparentBackground
  };
}

function syncSettingsUi() {
  renderModeInputs.forEach((inputElement) => {
    inputElement.checked = inputElement.value === renderSettings.renderMode;
  });
  showExportActions.checked = renderSettings.showExportActions;
  transparentBackground.checked = renderSettings.transparentBackground;
  themeSelect.value = getThemeId();
  maxTabsSlider.value = String(renderSettings.maxTabs);
  maxTabsValue.textContent = String(renderSettings.maxTabs);
  applyTransparentMode(renderSettings.transparentBackground);
}

function applyTransparentMode(enabled) {
  appShell.classList.toggle("transparent-mode", enabled);
}

function loadAndApplyTheme() {
  const savedThemeId = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME_ID;
  setColorTheme(savedThemeId);
  applyColorTheme(COLOR_THEME);
}

function saveTheme(themeId) {
  localStorage.setItem(THEME_STORAGE_KEY, themeId);
}

function initTopbarCollapse() {
  const isCollapsed = localStorage.getItem(TOPBAR_COLLAPSED_STORAGE_KEY) === "true";
  topbar.classList.toggle("is-collapsed", isCollapsed);
}

function toggleTopbarCollapse() {
  const isCollapsed = topbar.classList.toggle("is-collapsed");
  localStorage.setItem(TOPBAR_COLLAPSED_STORAGE_KEY, String(isCollapsed));
}

function enforceMaxTabs() {
  const maxTabs = renderSettings.maxTabs || DEFAULT_RENDER_SETTINGS.maxTabs;
  if (tabs.length <= maxTabs) {
    return;
  }

  const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);
  while (tabs.length > maxTabs) {
    const removeIndex = activeIndex === 0 ? 1 : 0;
    tabs.splice(removeIndex, 1);
  }

  if (!tabs.some((tab) => tab.id === activeTabId)) {
    activeTabId = tabs[0]?.id;
  }

  saveTabs();
  renderTabs();
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

  if (!renderSettings.transparentBackground) {
    const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", "520");
    background.setAttribute("height", "300");
    background.setAttribute("fill", COLOR_THEME.export.background);
    clone.insertBefore(background, clone.firstChild);
  }

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
    if (!renderSettings.transparentBackground) {
      context.fillStyle = COLOR_THEME.export.background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
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

function extractMolBlock(source, index) {
  const blocks = [];
  const molPattern = /::mol\b/g;
  let match;
  while ((match = molPattern.exec(source)) !== null) {
    blocks.push(match.index);
  }

  if (index < 0 || index >= blocks.length) {
    return "";
  }

  const start = blocks[index];
  const end = index + 1 < blocks.length ? blocks[index + 1] : source.length;
  return source.slice(start, end).trim();
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
