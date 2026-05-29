# Sudoku Logic V2

A feature-rich, vanilla JavaScript Sudoku engine designed for puzzle creation, solving, and sharing. This tool features a classic Sudoku engine alongside a modular Advanced Variants engine with a custom SVG graphics layer.

## 🚀 Features

### 🧩 Game Engine
* **Dual Modes:**
   * **CREATE Mode:** Manually input digits to build a custom puzzle. Features real-time validation (Unique, Multiple Solutions, or No Solution). Includes a **Ghost Solution** overlay to preview the generated path.
   * **SOLVE Mode:** Play generated or custom-built puzzles with a timer and progress tracking. UI seamlessly hides creator tools during gameplay.
   * **Play-Only Mode:** Export a custom puzzle to a URL. When shared, the game automatically locks the user into Solve Mode and hides all backend tools.
* **Unique Puzzle Generation:** Recursive backtracking algorithm that ensures every generated puzzle has exactly one solution.
* **Multiple Grid Sizes:** Support for standard **9x9** (3x3 blocks) and **6x6** (2x3 blocks) layouts. Dynamic variants (like German Whispers) automatically adjust their math rules based on grid size.
* **Difficulty Scaling:** Generate puzzles across three difficulty tiers: Easy, Medium, and Hard.

### 🎨 Advanced Variants & Graphics
* **Thermo Sudoku:** Digits must strictly increase from the bulb to the tip.
* **German Whispers:** Adjacent numbers along the line must have a difference of 5 or more (3 or more on 6x6 grids).
* **Killer Sudoku:** Digits in a dashed cage must sum to the target number in the corner without repeating.
* **Kropki Dots (Black/White):** Adjacent cells must be consecutive (white) or a 1:2 ratio (black).
* **Dynamic Drawing:** "Drag-to-draw" interaction with backtracking (rubber-banding) to fix mistakes on the fly without deleting the whole line.

### 🛠 Tools & UX
* **Dual History Stacks:** Independent Undo/Redo stacks for standard grid inputs (50-state depth) and Variant SVG graphics (snapshot-based).
* **Smart Pencil Marks:** Automatic Pencil Cleaning—notes are removed from rows, columns, and blocks as you place correct digits.
* **Highlighter System:** 18-color palette to color-code cells.
* **Native Tooltips:** Centralized JavaScript dictionary powering clean HTML hover tooltips.
* **Dark Mode:** Fully themed dark interface with glowing active states for variant buttons.

### ⌨️ Keyboard Shortcuts
| Key | Action |
| :--- | :--- |
| **WASD / Arrows** | Navigate the grid |
| **1 - 9** | Input number |
| **0 / Backspace** | Erase cell / Erase pencil mark |
| **N** | Toggle Pencil Mode (Solve Mode only) |
| **Esc / V** | Drop drawing tool (Return to Number Input) |
| **Ctrl + Z** | Undo (Context-aware: undoes variant if tool active, else grid) |
| **Ctrl + Y / Shift + Z** | Redo |

---

## 🛠 Technical Stack
* **HTML5 / SVG** - Semantic layout and vector drawing layer.
* **CSS3** - Custom variables for theming and Grid/Flexbox architecture.
* **JavaScript (ES6+)** - Pure Vanilla JS logic split into highly modular files.

---

## 📥 Installation & Usage
No installation is required. This project runs entirely in the browser.

[https://mick-lockwood.github.io/SudokuLogic/]

* **Advanced Engine (Default):** `index.html`
* **Classic Engine:** `classic.html`

---

## 🏗 Developer Guide: Adding a New Variant
To add a new rule to the engine, follow this 5-step checklist:

1. **Create the Logic (`src/variants/YourVariant.js`)**
   * Export a math function: `export function yourVariantConflict(variant, arr, idx, val, isFlatArray = false)`
   * Export an SVG function: `export function drawYourVariant(variant, svgElement)`
2. **Add the Tooltip (`src/TooltipDictionary.js`)**
   * Add the ID and instructions: `'tool-yourvariant': 'Rule description here.'`
3. **Add the UI Button (`index.html`)**
   * Insert into the Variant Tools panel: `<button id="tool-yourvariant" class="variant-tool-btn" onclick="setTool('yourvariant')">Your Variant</button>`
4. **Route the Math (`src/SudokuLogic.js`)**
   * Import your math function at the top.
   * Add the routing `if` statement to both `hasConflict` and `hasConflictGen`.
5. **Route the Drawing & Input (`src/advanced-main.js`)**
   * Import your drawing function at the top.
   * Add `'yourvariant'` to the array in `window.handleCellSelection` so the clicker recognizes it.
   * Add logic to the `pointerup` listener to define how it saves to the state (e.g., requires 2 cells? requires a prompt?).
   * Add the routing `if` statement to `drawVariantLine`.
