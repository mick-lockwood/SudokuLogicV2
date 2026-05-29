// src/advanced-main.js
import './classic-main.js'; 
import { State, saveState } from './GameState.js';
import * as Renderer from './Renderer.js';
import { Tooltips } from './TooltipDictionary.js';
import { resetGenSafety, cleanPencilsAfterMove, hasConflict } from './SudokuLogic.js';
import { renderTorusBoard } from './TorusBoard.js';
import { renderVariantOverlay } from './VariantOverlay.js';

// import variant rules
import { drawThermo } from './variants/Thermo.js';
import { drawWhisper } from './variants/Whisper.js';
import { drawKiller } from './variants/Killer.js';
import { drawKropki } from './variants/Kropki.js';
import { autoClueNurikabe, generateRandomNurikabe } from './variants/Nurikabe.js';
import { validateNurikabe } from './variants/Nurikabe.js';

// ========== DROPDOWN FUNCTIONS (add these) ==========
window.toggleDropdown = () => {
    const options = document.getElementById('diff-options');
    if (options) options.classList.toggle('show');
};

window.selectDiff = (val) => {
    const hiddenInput = document.getElementById('diff');
    const selectedSpan = document.getElementById('diff-selected');
    if (hiddenInput) hiddenInput.value = val;
    if (selectedSpan) selectedSpan.innerText = val.charAt(0).toUpperCase() + val.slice(1);
    const options = document.getElementById('diff-options');
    if (options) options.classList.remove('show');
};

// Also add a click listener to close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('diff-wrapper');
    const options = document.getElementById('diff-options');
    if (wrapper && options && !wrapper.contains(e.target)) {
        options.classList.remove('show');
    }
});

window.isWiping = false;

// --- AUTO-RESIZE SVGS ---
window.addEventListener('resize', () => {
    if (typeof window.renderSVGLayer === 'function') {
        window.renderSVGLayer();
    }
});

window.AdvancedState = {
    activeTool: 'pointer',
    isDrawing: false,
    currentLine: [],
    currentRegionId: null,
    variantUndoStack: [],
    variantRedoStack: []
};

// --- LEFT PANEL TAB MANAGER ---
window.setLeftTab = (tab) => {
    const drawBtn = document.getElementById('tab-btn-drawing');
    const rulesBtn = document.getElementById('tab-btn-rules');
    const drawContent = document.getElementById('tab-drawing');
    const rulesContent = document.getElementById('tab-rules');

    if (tab === 'drawing') {
        drawBtn.classList.add('active');
        rulesBtn.classList.remove('active');
        drawContent.style.display = 'flex';
        rulesContent.style.display = 'none';
    } else {
        rulesBtn.classList.add('active');
        drawBtn.classList.remove('active');
        rulesContent.style.display = 'flex';
        drawContent.style.display = 'none';
    }
};

// --- TOOL MANAGER ---
window.setTool = (tool) => {
    window.AdvancedState.activeTool = tool;
    window.AdvancedState.fogLinkSource = null; 
    
    document.querySelectorAll('.variant-tool-btn').forEach(btn => {
        btn.classList.remove('active-tool-pointer', 'active-tool-variant', 'active-tool-edit', 'active-tool-eraser');
    });

    const activeBtn = document.getElementById(`tool-${tool}`);
    if (activeBtn) {
        if (tool === 'pointer') {
            activeBtn.classList.add('active-tool-pointer');
        } else if (['edit', 'region', 'fog', 'fog-link'].includes(tool)) {
            activeBtn.classList.add('active-tool-edit'); 
        } else if (tool === 'eraser') {
            activeBtn.classList.add('active-tool-eraser');
        } else {
            activeBtn.classList.add('active-tool-variant');
        }
    }
        if (typeof renderVariantOverlay === 'function') {
        renderVariantOverlay(); 
    }
    
    if (tool !== 'pointer') {
        State.selected = [];
    }
    
    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer(); 
    
    if (typeof Renderer !== 'undefined' && window.updateUI) {
        window.updateUI();
    } else if (typeof window.updateUI === 'function') {
        window.updateUI();
    }
};

window.clearVariantGraphics = () => {
    if (!confirm("Clear all drawn variant lines?")) return;
    State.variants = [];
    renderSVGLayer();
    window.updateUI();
};

// --- INPUT HIJACKER ---
const originalHandleCellSelection = window.handleCellSelection;

window.handleCellSelection = (index, isMulti, isDragging) => {
    const isClueCell = typeof index === 'string';
    const tool = window.AdvancedState.activeTool;

    // --- Completely block grid highlights if painting Nurikabe ---
    if (tool === 'nurikabe') return;

    // --- 1. FOG PAINTER LOGIC ---
    if (tool === 'fog' && State.mode === 'create') {
        if (!isClueCell) { 
            if (!isDragging) window.AdvancedState.paintFogValue = !State.fogMap[index];
            State.fogMap[index] = window.AdvancedState.paintFogValue;
            if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI(); 
        }
        return; 
    }
    
    // --- 2. FOG LINKER LOGIC ---
    else if (tool === 'fog-link' && State.mode === 'create') {
        if (!isClueCell && !isDragging) {
            if (window.AdvancedState.fogLinkSource == null) {
                window.AdvancedState.fogLinkSource = index;
                if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
                
                setTimeout(() => {
                    if (!State.fogTriggers) State.fogTriggers = {};
                    const existing = State.fogTriggers[index] || "";
                    const triggerStr = prompt("Enter the digit (1-9) required to unlock this cell:\n(Leave blank to use the auto-generated solution)", existing);
                    
                    if (triggerStr !== null && triggerStr.trim() !== "") {
                        const triggerVal = parseInt(triggerStr);
                        if (!isNaN(triggerVal) && triggerVal >= 1 && triggerVal <= 9) {
                            State.fogTriggers[index] = triggerVal;
                        }
                    } else if (triggerStr !== null) {
                        delete State.fogTriggers[index]; 
                    }
                    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer(); 
                }, 10);
                
            } else if (window.AdvancedState.fogLinkSource === index) {
                window.AdvancedState.fogLinkSource = null; 
                if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
            } else {
                const sourceKey = String(window.AdvancedState.fogLinkSource);
                if (!State.fogLinks) State.fogLinks = {};
                if (!State.fogLinks[sourceKey]) State.fogLinks[sourceKey] = [];
                
                const targetIdx = State.fogLinks[sourceKey].indexOf(index);
                if (targetIdx > -1) {
                    State.fogLinks[sourceKey].splice(targetIdx, 1); 
                } else {
                    State.fogLinks[sourceKey].push(index); 
                }
                if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer(); 
                if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
            }
        }
        return;
    }

    // --- 3. VARIANT LINE DRAWING ---
    else if (['thermo', 'whisper','killer', 'kropki-white', 'kropki-black'].includes(tool)) {
        handleLineDrawing(index, isDragging);
    } 
        
    // --- 4. REGION PAINTER LOGIC ---
    else if (tool === 'region') {
        if (!isClueCell) { 
            if (!isDragging) {
                window.AdvancedState.currentRegionId = `jigsaw-${Date.now()}`;
                State.board[index].region = window.AdvancedState.currentRegionId;
            } else if (window.AdvancedState.currentRegionId) {
                State.board[index].region = window.AdvancedState.currentRegionId;
            }
            if (typeof Renderer.renderGrid === 'function') Renderer.renderGrid();
            if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI(); 
        }
    }

    // --- NEW: LOCK PAINTER LOGIC ---
    else if (tool === 'lock' && State.mode === 'create') {
        if (!isClueCell && !isDragging) {
            State.lockedMap[index] = !State.lockedMap[index];
            if (typeof window.updateUI === 'function') window.updateUI();
        }
        return;
    }
        
    // --- 5. EDIT LOGIC ---
    else if (tool === 'edit') {
        if (!isDragging) {
            const variantToEdit = State.variants.find(v => v.cells.includes(index));
            if (variantToEdit && variantToEdit.type === 'killer') {
                setTimeout(() => {
                    const sumInput = prompt("Enter new target sum for this cage:", variantToEdit.sum);
                    if (sumInput !== null) { 
                        const sumVal = parseInt(sumInput);
                        if (!isNaN(sumVal) && sumVal > 0) {
                            window.saveVariantState(); 
                            variantToEdit.sum = sumVal; 
                            renderSVGLayer();
                            if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
                        }
                    }
                }, 10);
            }
        }
    } 
        
    // --- 6. ERASER LOGIC ---
    else if (tool === 'eraser') {
        if (!isDragging) {
            const originalLength = State.variants.length;
            const newVariants = State.variants.filter(v => !v.cells.includes(index));
            if (newVariants.length < originalLength) {
                window.saveVariantState(); 
                State.variants = newVariants;
                renderSVGLayer();
                if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
            }
        }
    }
    // --- DEFAULT: NUMBER INPUT ---
    else {
        originalHandleCellSelection(index, isMulti, isDragging);
    }
};

// --- UNDO / REDO LOGIC ---
window.saveVariantState = () => {
    window.AdvancedState.variantRedoStack = [];
    window.AdvancedState.variantUndoStack.push(JSON.stringify(State.variants));
};

window.undoVariant = () => {
    if (window.AdvancedState.variantUndoStack.length > 0) {
        window.AdvancedState.variantRedoStack.push(JSON.stringify(State.variants));
        State.variants = JSON.parse(window.AdvancedState.variantUndoStack.pop());
        renderSVGLayer();
        window.updateUI();
    }
};

window.redoVariant = () => {
    if (window.AdvancedState.variantRedoStack.length > 0) {
        window.AdvancedState.variantUndoStack.push(JSON.stringify(State.variants));
        State.variants = JSON.parse(window.AdvancedState.variantRedoStack.pop());
        renderSVGLayer();
        window.updateUI();
    }
};

window.clearVariantGraphics = () => {
    if (!confirm("Clear all drawn variant lines?")) return;
    window.saveVariantState();
    State.variants = [];
    renderSVGLayer();
    window.updateUI(); 
};

// --- UTILITY: AUTO-FILL PENCILS ---
window.autoFillPencils = () => {
    if (State.isWon || State.paused) return;
    saveState();
    
    State.board.forEach((cell, i) => {
        // Prevent auto-filling inside active fog clouds!
        const isHiddenFog = State.mode === 'solve' && State.fogMode && State.fogMap[i] && !State.fogRevealed[i];

        if (cell.val === 0 && !isHiddenFog) {
            cell.notes = []; // Clear existing so we don't duplicate
            for (let n = 1; n <= State.size; n++) {
                // Only pencil it in if it doesn't break a rule!
                if (!hasConflict(State.board, i, n)) {
                    cell.notes.push(n);
                }
            }
        }
    });
    
    if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
};

// --- TOGGLE TIMER ---
window.toggleTimerVis = () => {
    const isVisible = document.getElementById('toggle-timer').checked;
    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.style.visibility = isVisible ? 'visible' : 'hidden';
    }
};

// --- PERIMETER RULE SYNCING ---
window.togglePerimeterRule = () => {
    const isAnyRuleChecked = 
        document.getElementById('rule-sandwich').checked ||
        document.getElementById('rule-skyscraper').checked ||
        document.getElementById('rule-frames').checked ||
        document.getElementById('rule-rooms').checked;

    const outerCluesToggle = document.getElementById('toggle-outer-clues');
    
    if (isAnyRuleChecked && !outerCluesToggle.checked) {
        outerCluesToggle.checked = true;
        window.toggleOuterClues(); 
    } else {
        if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
        if (typeof window.updateUI === 'function') window.updateUI();
    }
};

const originalToggleOuterClues = window.toggleOuterClues;
window.toggleOuterClues = () => {
    const isChecked = document.getElementById('toggle-outer-clues').checked;
    
    if (!isChecked) {
        document.getElementById('rule-sandwich').checked = false;
        document.getElementById('rule-skyscraper').checked = false;
        document.getElementById('rule-frames').checked = false;
        document.getElementById('rule-rooms').checked = false;
    }
    
    if (originalToggleOuterClues) originalToggleOuterClues();
    
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof window.updateUI === 'function') window.updateUI();
};

// --- THE MASTER INPUT HIJACKER ---
// Completely replaces the classic input to ensure absolute control over the assignment and win state
window.handleInput = (val) => {
    // 0. Safety Checks
    if (State.selected.length === 0 || State.paused || State.isWon) return;
    saveState();

    const primary = State.selected[State.selected.length - 1];
    
    // 1. OUTER CLUE MULTI-DIGIT LOGIC
    if (typeof primary === 'string' && primary.startsWith('clue')) {
        if (!State.clues) State.clues = {};
        if (val === 0 || val === '0') {
            State.clues[primary] = ""; 
        } else {
            const current = State.clues[primary] || "";
            State.clues[primary] = (current.length >= 2) ? val.toString() : current + val.toString();
        }
        if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
        return; 
    } 

    // 2. FOG INPUT BLOCKER
    if (State.mode === 'solve' && State.fogMode && primary !== null) {
        if (State.fogMap[primary] && !State.fogRevealed[primary]) {
            return; 
        }
    }
    
    // 3. FOG HYBRID REVEAL LOGIC
    if (State.mode === 'solve' && State.fogMode && !State.pencil && val != 0 && primary !== null) {
        const primaryKey = String(primary);
        let isCorrect = false;

        if (State.fogTriggers && State.fogTriggers[primaryKey] !== undefined) {
            isCorrect = (val == State.fogTriggers[primaryKey]);
        } else if (State.solution && State.solution[primary] !== undefined) {
            isCorrect = (val == State.solution[primary]);
        }

        if (isCorrect) {
            if (!State.fogRevealed) State.fogRevealed = Array(State.size * State.size).fill(false);
            if (!State.fogLinks) State.fogLinks = {};

            if (State.fogLinks[primaryKey] && State.fogLinks[primaryKey].length > 0) {
                State.fogLinks[primaryKey].forEach(targetIdx => { State.fogRevealed[targetIdx] = true; });
            } else {
                const r = Math.floor(primary / State.size), c = primary % State.size;
                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        const nr = r + i, nc = c + j;
                        if (nr >= 0 && nr < State.size && nc >= 0 && nc < State.size) {
                            State.fogRevealed[nr * State.size + nc] = true;
                        }
                    }
                }
            }
            State.fogRevealed[primary] = true;
            propagateFogReveal()
        }
    }
    
    // 4. THE CORE CELL ASSIGNMENT (Bypassing Classic Engine)
    State.selected.forEach(idx => {
        if (typeof idx !== 'number') return;
        const cell = State.board[idx];
        
        if (State.mode === 'solve' && cell.given) return;
        
        if (State.pencil && State.mode === 'solve' && val !== 0) {
            if (cell.val !== 0) return;
            const pos = cell.notes.indexOf(val);
            if (pos > -1) cell.notes.splice(pos, 1); else cell.notes.push(val);
        } else {
            cell.val = val; 
            cell.notes = [];
            cell.given = (State.mode === 'create' && val !== 0);
            if (State.mode === 'solve' && val !== 0) cleanPencilsAfterMove(idx, val);
        }
    });
    
    // 5. RENDER UI
    if (typeof Renderer !== 'undefined' && window.updateUI) {
        window.updateUI();
    }
    
    // 6. CHECK WIN 
    window.checkAdvancedWin();
};

// --- UNIVERSAL WIN CHECKER ---
window.checkAdvancedWin = () => {
    if (State.mode !== 'solve' || State.isWon) return;

    const isNurikabePuzzle = State.solutionShadeMap && State.solutionShadeMap.some(v => v !== 0);

    if (isNurikabePuzzle) {
        // 1. FAST CHECK: Try to match the exact generated solution map
        let isShadeCorrect = State.shadeMap.every((val, i) => val === State.solutionShadeMap[i]);
        
        // 2. STRICT CHECK: If it doesn't match perfectly, validate using topological rules!
        // This allows players to find alternative valid solutions, AND allows custom human-made 
        // puzzles to work seamlessly without relying on a pre-generated answer key.
        if (!isShadeCorrect) {
            isShadeCorrect = validateNurikabe(State.shadeMap, State.board, State.size);
        }

        if (isShadeCorrect) {
            State.isWon = true;
            triggerWinUI();
        }
        return;
    }

    const isFull = State.board.every(cell => cell.val !== 0);
    if (!isFull) return;

    setTimeout(() => {
        if (State.mode !== 'solve') return;
        const hasErrors = document.querySelector('.error') !== null;
        if (!hasErrors) {
            State.isWon = true;
            triggerWinUI();
        }
    }, 50);
};

// ========== FOG PROPAGATION (add this entire block) ==========
function propagateFogReveal() {
    if (!State.fogMode || State.mode !== 'solve') return;
    let changed = true;
    let maxIter = 50;
    let iter = 0;
    while (changed && iter++ < maxIter) {
        changed = false;
        for (let i = 0; i < State.size * State.size; i++) {
            if (State.fogMap[i] && !State.fogRevealed[i]) {
                let shouldReveal = false;
                if (State.fogTriggers && State.fogTriggers[i] !== undefined) {
                    if (State.board[i].val === State.fogTriggers[i]) shouldReveal = true;
                } else if (State.solution && State.solution[i] !== undefined) {
                    if (State.board[i].val === State.solution[i]) shouldReveal = true;
                }
                if (shouldReveal) {
                    State.fogRevealed[i] = true;
                    changed = true;
                    if (State.fogLinks && State.fogLinks[i]) {
                        for (let target of State.fogLinks[i]) {
                            if (!State.fogRevealed[target]) {
                                State.fogRevealed[target] = true;
                                changed = true;
                            }
                        }
                    }
                }
            }
        }
    }
    if (typeof window.updateUI === 'function') window.updateUI();
}

function triggerWinUI() {
    State.selected.length = 0; 
    window.AdvancedState.activeTool = 'pointer';
    if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
    
    if (State.timerInt) clearInterval(State.timerInt);
    const timerEl = document.getElementById('timer');
    const finalTimeEl = document.getElementById('final-time');
    if (timerEl && finalTimeEl) finalTimeEl.textContent = `Final Time: ${timerEl.textContent}`;

    const winOverlay = document.getElementById('win-overlay');
    if (winOverlay) winOverlay.style.display = 'flex';
    
    if (typeof Renderer !== 'undefined' && Renderer.fireConfetti) Renderer.fireConfetti();
}

// --- GLOBAL RULE TOGGLES ---
window.toggleAntiKnight = () => {
    State.antiKnight = document.getElementById('toggle-anti-knight').checked;
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof window.updateUI === 'function') window.updateUI();
};

window.toggleAntiKing = () => {
    State.antiKing = document.getElementById('toggle-anti-king').checked;
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof window.updateUI === 'function') window.updateUI(); 
};

// --- FOG OF WAR LOGIC ---
window.toggleFogMode = () => {
    State.fogMode = document.getElementById('toggle-fog').checked;
    const fogBtn = document.getElementById('tool-fog');
    const fogLinkBtn = document.getElementById('tool-fog-link');
    const clearFogBtn = document.getElementById('btn-clear-fog'); 
    
    if (State.fogMode) {
        if (fogBtn) fogBtn.style.display = 'block';
        if (fogLinkBtn) fogLinkBtn.style.display = 'block';
        if (clearFogBtn) clearFogBtn.style.display = 'block'; 
        window.setTool('fog');
    } else {
        if (fogBtn) fogBtn.style.display = 'none';
        if (fogLinkBtn) fogLinkBtn.style.display = 'none';
        if (clearFogBtn) clearFogBtn.style.display = 'none'; 
        if (['fog', 'fog-link'].includes(window.AdvancedState.activeTool)) {
            window.setTool('pointer');
        }
    }
    if (typeof window.updateGameRules === 'function') window.updateGameRules();
    if (typeof window.updateUI === 'function') window.updateUI();
};

window.clearFogData = () => {
    if (!confirm("Are you sure you want to clear all painted fog, custom links, and trigger keys?")) return;
    State.fogMap = Array(State.size * State.size).fill(false);
    State.fogRevealed = Array(State.size * State.size).fill(false);
    State.fogLinks = {};
    State.fogTriggers = {};
    window.AdvancedState.fogLinkSource = null;

    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
    if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
};

// --- GRID MODIFICATION TOGGLES ---
window.toggleJigsawMode = () => {
    State.jigsawMode = document.getElementById('toggle-jigsaw').checked;
    if (State.jigsawMode) {
        document.getElementById('toggle-suguru').checked = false;
        State.suguruMode = false;
    }
    updateRegionPainterState();
};

window.toggleSuguruMode = () => {
    State.suguruMode = document.getElementById('toggle-suguru').checked;
    if (State.suguruMode) {
        document.getElementById('toggle-jigsaw').checked = false;
        State.jigsawMode = false;
    }
    updateRegionPainterState();
};

window.resetRegions = () => {
    if (!State.jigsawMode && !State.suguruMode) return; 
    State.board.forEach((cell, i) => {
        const r = Math.floor(i / State.size);
        const c = i % State.size;
        const boxIndex = Math.floor(r / State.bH) * (State.size / State.bW) + Math.floor(c / State.bW);
        cell.region = `box-${boxIndex}`;
    });

    if (typeof Renderer !== 'undefined' && Renderer.renderGrid) {
        Renderer.renderGrid();
        window.updateUI();
    }
};

function updateRegionPainterState() {
    const regionToolBtn = document.getElementById('tool-region');
    const resetRegionsBtn = document.getElementById('btn-reset-regions'); 
    
    if (State.jigsawMode || State.suguruMode) {
        if (regionToolBtn) regionToolBtn.style.display = 'block';
        if (resetRegionsBtn) resetRegionsBtn.style.display = 'block'; 
        window.setTool('region'); 
    } else {
        if (regionToolBtn) regionToolBtn.style.display = 'none';
        if (resetRegionsBtn) resetRegionsBtn.style.display = 'none'; 
        if (window.AdvancedState.activeTool === 'region') window.setTool('pointer');
        
        State.board.forEach((cell, i) => {
            const r = Math.floor(i / State.size);
            const c = i % State.size;
            const boxIndex = Math.floor(r / State.bH) * (State.size / State.bW) + Math.floor(c / State.bW);
            cell.region = `box-${boxIndex}`;
        });
        if (typeof Renderer.renderGrid === 'function') Renderer.renderGrid();
    }
    
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof window.updateUI === 'function') window.updateUI();
}

// --- DYNAMIC DRAWING (BACKTRACKING) ---
function handleLineDrawing(index, isDragging) {
    if (!isDragging) {
        window.AdvancedState.isDrawing = true;
        window.AdvancedState.currentLine = [index];
    } else if (window.AdvancedState.isDrawing) {
        const line = window.AdvancedState.currentLine;
        const lastCell = line[line.length - 1];
        const prevCell = line.length > 1 ? line[line.length - 2] : null;

        if (index === prevCell) {
            line.pop();
        } else if (lastCell !== index && !line.includes(index)) {
            line.push(index);
        }
    }
    renderSVGLayer();
}

window.addEventListener('pointerup', () => {
    const tool = window.AdvancedState.activeTool;
    
    if (tool === 'region') {
        const visited = new Set();
        const newRegions = Array(State.size * State.size).fill(null);
        let nextId = 0;
        
        for (let i = 0; i < State.size * State.size; i++) {
            if (visited.has(i)) continue;
            
            const originalId = State.board[i].region;
            const baseName = originalId.split('_chunk_')[0]; 
            const newAssignedId = `${baseName}_chunk_${nextId++}`;
            
            const queue = [i];
            visited.add(i);
            
            while(queue.length > 0) {
                const curr = queue.shift();
                newRegions[curr] = newAssignedId;
                
                const r = Math.floor(curr / State.size);
                const c = curr % State.size;
                
                const neighbors = [];
                if (r > 0) neighbors.push(curr - State.size);
                if (r < State.size - 1) neighbors.push(curr + State.size);
                if (c > 0) neighbors.push(curr - 1);
                if (c < State.size - 1) neighbors.push(curr + 1);
                
                for (let n of neighbors) {
                    if (!visited.has(n) && State.board[n].region === originalId) {
                        visited.add(n);
                        queue.push(n);
                    }
                }
            }
        }
        
        for (let i = 0; i < State.size * State.size; i++) {
            State.board[i].region = newRegions[i];
        }
        
        if (typeof Renderer !== 'undefined' && Renderer.renderGrid) {
            Renderer.renderGrid();
            window.updateUI();
        }
    }
    
    if (['thermo', 'whisper', 'killer', 'kropki-white', 'kropki-black'].includes(tool) && window.AdvancedState.isDrawing) {
        window.AdvancedState.isDrawing = false;
        
        if (window.AdvancedState.currentLine.length > 0) {
            
            if (tool === 'killer') {
                setTimeout(() => {
                    const sumInput = prompt("Enter the target sum for this cage:");
                    const sumVal = parseInt(sumInput);
                    
                    if (!isNaN(sumVal) && sumVal > 0) {
                        window.saveVariantState(); 
                        State.variants.push({
                            type: tool,
                            cells: [...window.AdvancedState.currentLine],
                            sum: sumVal
                        });
                    }
                    window.AdvancedState.currentLine = [];
                    window.updateUI(); 
                    renderSVGLayer();
                }, 10);
                return; 
                
            } else if (tool.startsWith('kropki') && window.AdvancedState.currentLine.length > 1) {
                window.saveVariantState(); 
                const line = window.AdvancedState.currentLine;
                
                for (let i = 0; i < line.length - 1; i++) {
                    State.variants.push({
                        type: tool,
                        cells: [line[i], line[i + 1]]
                    });
                }
                window.updateUI(); 
                
            } else if (window.AdvancedState.currentLine.length > 1) {
                window.saveVariantState(); 
                State.variants.push({
                    type: tool,
                    cells: [...window.AdvancedState.currentLine]
                });
                window.updateUI(); 
            }
        }
        
        window.AdvancedState.currentLine = [];
        renderSVGLayer();
    }
});

// =====================================================================
// --- SHIFT MODE (TORUS) ENGINE ---
// =====================================================================
window.toggleShiftMode = () => {
    State.shiftMode = document.getElementById('toggle-shift').checked;
    document.body.classList.toggle('torus-active', State.shiftMode);
    
    // UI Elements
    const diffWrapper = document.getElementById('diff-wrapper');
    const genBtn = document.getElementById('gen-btn');
    const genPill = genBtn ? genBtn.parentElement : null;
    
    const lockBtn = document.getElementById('tool-lock');
    const scrambleBtn = document.getElementById('btn-scramble-torus');
    
    const labelSeen = document.getElementById('toggle-seen')?.closest('label');
    const labelMatch = document.getElementById('toggle-match')?.closest('label');
    
    const clearInputsLink = document.getElementById('clear-inputs-link');
    const cleanPencilsLink = document.getElementById('clean-pencils-link');
    const autoFillBtn = document.getElementById('btn-autofill-pencils');
    
    const classicGrid = document.getElementById('grid');
    const torusGrid = document.getElementById('torus-grid');

    // --- THE FIX: GRAB CONFLICTING TOGGLES ---
    const fogToggle = document.getElementById('toggle-fog');
    const jigsawToggle = document.getElementById('toggle-jigsaw');
    const suguruToggle = document.getElementById('toggle-suguru');
    
    if (State.shiftMode) {
        // Uncheck and physically disable the checkboxes!
        if (fogToggle) { fogToggle.checked = false; fogToggle.disabled = true; }
        if (jigsawToggle) { jigsawToggle.checked = false; jigsawToggle.disabled = true; }
        if (suguruToggle) { suguruToggle.checked = false; suguruToggle.disabled = true; }
        
        // Let their native functions securely hide their side-bar tools
        if (typeof window.toggleFogMode === 'function') window.toggleFogMode();
        if (typeof updateRegionPainterState === 'function') updateRegionPainterState();
        
        if (lockBtn) lockBtn.style.display = 'block';
        if (scrambleBtn) scrambleBtn.style.display = 'block';
        
        if (labelSeen) labelSeen.style.display = 'none'; 
        if (labelMatch) labelMatch.style.display = 'none'; 
        
        if (clearInputsLink) clearInputsLink.style.display = 'none';
        if (cleanPencilsLink) cleanPencilsLink.style.display = 'none';
        if (autoFillBtn) autoFillBtn.style.display = 'none';
        
        if (classicGrid) classicGrid.classList.add('torus-active'); 
        if (torusGrid) torusGrid.style.display = 'block';

        if (diffWrapper) diffWrapper.style.display = 'none';
        if (genBtn) genBtn.style.display = 'none';
        if (genPill) genPill.style.display = 'none';
        
    } else {
        // Re-enable the checkboxes so the user can play them again
        if (fogToggle) fogToggle.disabled = false;
        if (jigsawToggle) jigsawToggle.disabled = false;
        if (suguruToggle) suguruToggle.disabled = false;

        if (lockBtn) lockBtn.style.display = 'none';
        if (scrambleBtn) scrambleBtn.style.display = 'none';
        if (window.AdvancedState.activeTool === 'lock') window.setTool('pointer');
        
        if (labelSeen) labelSeen.style.display = 'flex'; 
        if (labelMatch) labelMatch.style.display = 'flex'; 
        
        if (clearInputsLink) clearInputsLink.style.display = 'inline';
        if (cleanPencilsLink) cleanPencilsLink.style.display = 'inline';
        if (autoFillBtn && State.mode === 'solve') autoFillBtn.style.display = 'inline';
        
        if (classicGrid) classicGrid.classList.remove('torus-active'); 
        if (torusGrid) torusGrid.style.display = 'none';

        if (diffWrapper) diffWrapper.style.display = 'flex';
        if (genBtn) genBtn.style.display = 'block';
        if (genPill) genPill.style.display = 'flex';

        State.lockedMap.fill(false);
    }
    
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof window.updateUI === 'function') window.updateUI();
};

// --- GENERALIZED SVG RENDERER ---
window.renderSVGLayer = function renderSVGLayer() {
    const svg = document.getElementById('svg-layer');
    const grid = document.getElementById('grid');
    if (!svg || !grid) return;

    // --- THE FIX: PIXEL-PERFECT SYNC ---
    // This forces the SVG coordinate system to match the grid exactly.
    const width = grid.offsetWidth;
    const height = grid.offsetHeight;
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.style.width = width + 'px';
    svg.style.height = height + 'px';

    svg.innerHTML = ''; 
    
    State.variants.forEach(drawVariantLine); 
    
    if (window.AdvancedState.currentLine && window.AdvancedState.currentLine.length > 0) {
        drawVariantLine({
            type: window.AdvancedState.activeTool,
            cells: window.AdvancedState.currentLine
        });
    }
    
    // --- FOG LINK VISUALIZER ---
    if (State.mode === 'create' && window.AdvancedState.activeTool === 'fog-link' && State.fogLinks) {
        let defs = svg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            svg.appendChild(defs);
        }
        if (!document.getElementById('fog-arrow')) {
            defs.innerHTML += `<marker id="fog-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ec4899" /></marker>`;
        }

        Object.keys(State.fogLinks).forEach(sourceIdx => {
            const s = parseInt(sourceIdx);
            if (isNaN(s)) return;
            const sourcePos = Renderer.getCellCenter(s); 
            
            State.fogLinks[sourceIdx].forEach(targetIdx => {
                const targetPos = Renderer.getCellCenter(targetIdx);
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", sourcePos.x); line.setAttribute("y1", sourcePos.y);
                line.setAttribute("x2", targetPos.x); line.setAttribute("y2", targetPos.y);
                line.setAttribute("stroke", "#ec4899"); line.setAttribute("stroke-width", "3");
                line.setAttribute("stroke-dasharray", "5,5"); line.setAttribute("marker-end", "url(#fog-arrow)");
                svg.appendChild(line);
            });

            if (State.fogTriggers && State.fogTriggers[sourceIdx]) {
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", sourcePos.x - 22);
                text.setAttribute("y", sourcePos.y - 12);
                text.setAttribute("fill", "#a855f7"); 
                text.setAttribute("font-size", "14px");
                text.setAttribute("font-weight", "900");
                text.style.pointerEvents = "none";
                text.textContent = `🔑 ${State.fogTriggers[sourceIdx]}`;
                svg.appendChild(text);
            }
        });
    }

    if (typeof window.updateDynamicTitle === 'function') {
        window.updateDynamicTitle();
    }
}

function drawVariantLine(variant) {
    const svg = document.getElementById('svg-layer');
    if (!svg) return;

    if (variant.type === 'thermo') drawThermo(variant, svg);
    if (variant.type === 'whisper') drawWhisper(variant, svg);
    if (variant.type === 'killer') drawKiller(variant, svg);
    if (variant.type.startsWith('kropki')) drawKropki(variant, svg);
}

// --- UX ENHANCEMENTS ---
window.addEventListener('keydown', (e) => {
    if (State.paused || State.isWon) return;
    
    const isZ = e.key.toLowerCase() === 'z';
    const isY = e.key.toLowerCase() === 'y';
    const isCtrl = e.ctrlKey || e.metaKey;
    const tool = window.AdvancedState.activeTool;
    const isVariantTool = ['thermo', 'whisper', 'killer', 'kropki-white', 'kropki-black', 'eraser', 'edit'].includes(tool);
    
    if (isCtrl && (isZ || isY)) {
        e.preventDefault();
        e.stopImmediatePropagation(); 
        
        if (isY || (isZ && e.shiftKey)) {
            if (isVariantTool) window.redoVariant();
            else if (typeof window.triggerRedo === 'function') window.triggerRedo();
        } 
        else if (isZ && !e.shiftKey) {
            if (isVariantTool) window.undoVariant();
            else if (typeof window.triggerUndo === 'function') window.triggerUndo();
        }
        return;
    }

    if (!isCtrl && isZ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
    }

    if (e.key === '0') {
        e.preventDefault();
        e.stopImmediatePropagation(); 
        
        const primary = State.selected.length > 0 ? State.selected[State.selected.length - 1] : null;
        if (typeof primary === 'string' && primary.startsWith('clue')) {
            if (!State.clues) State.clues = {};
            const current = State.clues[primary] || "";
            
            if (current.length < 2 && current.length > 0) {
                State.clues[primary] = current + "0";
                if (typeof window.updateUI === 'function') window.updateUI();
            }
        }
        return; 
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        const primary = State.selected.length > 0 ? State.selected[State.selected.length - 1] : null;
        
        if (typeof primary === 'string' && primary.startsWith('clue')) {
            if (!State.clues) State.clues = {};
            const current = State.clues[primary] || "";
            
            State.clues[primary] = current.slice(0, -1);
            if (typeof window.updateUI === 'function') window.updateUI();
        } else {
            if (typeof window.handleInput === 'function') window.handleInput(0);
        }
        return;
    }

    if (e.key.toLowerCase() === 's' && State.mode === 'solve') {
        const isNurikabePuzzle = State.solutionShadeMap && State.solutionShadeMap.some(v => v !== 0);
        if (isNurikabePuzzle) {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.setTool(window.AdvancedState.activeTool === 'nurikabe' ? 'pointer' : 'nurikabe');
            if (typeof Renderer !== 'undefined' && Renderer.renderNumpad) Renderer.renderNumpad();
            return;
        }
    }
    
    if (e.key === 'Tab') {
        e.preventDefault(); 
        e.stopImmediatePropagation();
        
        State.pencil = !State.pencil;
        
        if (typeof Renderer !== 'undefined' && Renderer.renderNumpad) {
            Renderer.renderNumpad();
        } else if (typeof window.updateUI === 'function') {
            window.updateUI(); 
        }
        return;
    }
    
    if (e.key === 'Escape' || e.key.toLowerCase() === 'v') {
        if (window.AdvancedState.activeTool !== 'pointer') {
            window.setTool('pointer');
        }
    }
}, true);

// --- OVERRIDE MODE SWITCHER ---
const originalSetAppMode = window.setAppMode;

window.setAppMode = (m) => {
    State.isWon = false; 
    
    // --- NURIKABE MEMORY HOOK FIX ---
    if (m === 'solve' && State.mode === 'create') {
        // ONLY overwrite the solution if the user manually painted something
        const hasManualShading = State.shadeMap && State.shadeMap.some(v => v !== 0);
        if (hasManualShading) {
            State.solutionShadeMap = [...State.shadeMap];
            State.shadeMap = Array(State.size * State.size).fill(0);
            if (State.undoStack) State.undoStack = [];
            if (State.redoStack) State.redoStack = [];
        }
    } else if (m === 'create' && State.mode === 'solve') {
        // Restore setter's map so they can edit it
        if (State.solutionShadeMap && State.solutionShadeMap.some(v => v !== 0)) {
            State.shadeMap = [...State.solutionShadeMap];
        }
    }
    // ----------------------------
    
    if (m === 'solve') {
        State.fogRevealed = Array(State.size * State.size).fill(false);
        const winOverlay = document.getElementById('win-overlay');
        if (winOverlay) winOverlay.style.display = 'none';
        if (typeof Renderer !== 'undefined' && Renderer.stopConfetti) Renderer.stopConfetti();
        // Re-evaluate fog after reset (in case saved game already had correct digits)
        setTimeout(() => propagateFogReveal(), 10);
    }
    
    try {
        // The classic engine runs here and unhides the pencil buttons...
        if (originalSetAppMode) originalSetAppMode(m);
    } catch(e) { console.error("Classic Engine Error:", e); }
    
    const variantPanel = document.getElementById('variant-tools-panel');
    if (variantPanel) variantPanel.style.display = (m === 'create') ? 'flex' : 'none';
    
    // --- THE FIX: AGGRESSIVELY OVERRIDE THE CLASSIC ENGINE ---
    const autoFillBtn = document.getElementById('btn-autofill-pencils');
    const cleanPencilsLink = document.getElementById('clean-pencils-link');
    const clearInputsLink = document.getElementById('clear-inputs-link');
    
    if (autoFillBtn) autoFillBtn.style.display = (m === 'solve' && !State.shiftMode) ? 'inline' : 'none';
    if (cleanPencilsLink) cleanPencilsLink.style.display = (m === 'solve' && !State.shiftMode) ? 'inline' : 'none';
    if (clearInputsLink) clearInputsLink.style.display = (m === 'solve' && !State.shiftMode) ? 'inline' : 'none';
    // ----------------------------------------------------------
    
    const createActions = document.getElementById('create-mode-actions');
    const solveActions = document.getElementById('solve-mode-actions');
    if (createActions) createActions.style.display = (m === 'create') ? 'flex' : 'none';
    if (solveActions) solveActions.style.display = (m === 'solve') ? 'flex' : 'none';
    
    window.setTool('pointer');
    
    setTimeout(() => {
        const svg = document.getElementById('svg-layer');
        if (svg) svg.innerHTML = '';
        if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
        if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
    }, 15);
};

// --- GRID SIZE INTERCEPTOR ---
const originalSetGridSize = window.setGridSize;
window.isBootingForAutosave = true; // Engage the boot shield

window.setGridSize = (s) => {
    // --- NEW: THE AUTOSAVE BOOTLOADER ---
    // Catch the classic engine right as it tries to build the default blank board!
    if (window.isBootingForAutosave) {
        window.isBootingForAutosave = false; // Drop the shield instantly
        
        // If they are loading a shared URL puzzle, ignore the autosave!
        if (!new URLSearchParams(window.location.search).get('puzzle')) {
            if (localStorage.getItem('sudoku_autosave')) {
                window.loadAutosave();
                return; // Abort the classic grid wipe entirely!
            }
        }
    }
    // ------------------------------------

    // 1. Check if there is currently any data that would be lost
    const hasNumbers = State.board && State.board.some(c => c.val !== 0);
    const hasVariants = State.variants && State.variants.length > 0;
    const hasFog = State.fogMap && State.fogMap.some(f => f === true); 

    if (hasNumbers || hasVariants || hasFog) {
        if (!confirm("Changing grid size will clear your current board, variant rules, and fog data. Continue?")) {
            return; 
        }
    }

    // 2. Clear variants data before the swap
    State.variants = [];
    window.AdvancedState.variantUndoStack = [];
    window.AdvancedState.variantRedoStack = [];

    // --- THE FIX: SAFELY ABORT TORUS MODE BEFORE RESIZING ---
    const shiftToggle = document.getElementById('toggle-shift');
    if (shiftToggle && shiftToggle.checked) {
        shiftToggle.checked = false;
        window.toggleShiftMode(); // Turn it off completely to avoid ghost math crashes
    }
    // --------------------------------------------------------

    // 3. Run the original classic grid swap logic
    if (originalSetGridSize) originalSetGridSize(s);
    
    // 4. Wipe & resize fog data
    State.fogMap = Array(s * s).fill(false);
    State.fogRevealed = Array(s * s).fill(false);
    State.fogLinks = {};
    State.fogTriggers = {};
    window.AdvancedState.fogLinkSource = null;

    // 5. Force the UI to clear its visuals
    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
    if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
};

// --- JIGSAW GENERATOR SAFETY INTERCEPTOR ---
const originalGenerateNew = window.generateNew;

const generateWithRetry = (attemptsLeft) => {
    if (attemptsLeft <= 0) {
        State.board.forEach(c => { c.val = 0; c.given = false; c.notes = []; });
        if (typeof window.updateUI === 'function') window.updateUI();
        
        const label = document.getElementById('status-label');
        if (label) {
            label.textContent = "Generation Failed";
            label.style.color = "var(--danger)";
        }
        alert("This specific Jigsaw layout is too highly constrained to generate quickly. Please adjust your regions to be slightly less intertwined and try again.");
        return;
    }

    try {
        resetGenSafety();
        if (originalGenerateNew) originalGenerateNew();
        if (State.mode === 'solve' && State.fogMode) {
            setTimeout(() => propagateFogReveal(), 50);
        }
    } catch (e) {
        if (e.message === "JIGSAW_TIMEOUT") {
            console.log(`Jigsaw branch stuck. Restarting... (Attempt ${15 - attemptsLeft + 1}/15)`);
            setTimeout(() => generateWithRetry(attemptsLeft - 1), 10);
        } else {
            console.error("Generator Error:", e);
        }
    }
};

const generateNurikabeWithRetry = (attemptsLeft) => {
    if (attemptsLeft <= 0) {
        State.board.forEach(c => { c.val = 0; c.given = false; c.notes = []; });
        State.shadeMap = Array(State.size * State.size).fill(0);
        State.solutionShadeMap = Array(State.size * State.size).fill(0);
        if (typeof window.updateUI === 'function') window.updateUI();
        
        const label = document.getElementById('status-label');
        if (label) {
            label.textContent = "Generation Failed";
            label.style.color = "var(--danger)";
        }
        alert("The dynamic algorithm struggled to find a valid layout for this grid size. Please try again.");
        return;
    }

    try {
        // Runs the mathematical generator
        const puzzle = generateNurikabeGrid(State.size);
        
        State.board.forEach(c => { c.val = 0; c.given = false; c.notes = []; });
        State.solutionShadeMap = puzzle.shades;
        
        puzzle.clues.forEach(clue => {
            State.board[clue.i].val = clue.v;
            State.board[clue.i].given = true;
        });

        // Ensure the active shade map is clear for the player
        State.shadeMap = Array(State.size * State.size).fill(0); 
        saveState();
        
        const label = document.getElementById('status-label');
        if (label) { label.textContent = "Puzzle Ready!"; label.style.color = "var(--success)"; }
        
        if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
        if (typeof window.updateUI === 'function') window.updateUI();
        
    } catch (e) {
        // If the algorithm backs itself into a corner, silently restart it!
        console.log(`Nurikabe branch stuck. Restarting... (Attempt ${50 - attemptsLeft + 1}/50)`);
        setTimeout(() => generateNurikabeWithRetry(attemptsLeft - 1), 5);
    }
};

window.generateNew = () => {
    // 1. Clean, Centralized Nurikabe Generator
    if (window.AdvancedState.activeTool === 'nurikabe') {
        const hasCustomShading = State.shadeMap.some(v => v !== 0);
        if (hasCustomShading) {
            autoClueNurikabe();
        } else {
            generateRandomNurikabe();
        }
        return;
    }
    
    // 2. Jigsaw / Suguru Generator
    if (State.jigsawMode || State.suguruMode) {
        const regionCounts = {};
        State.board.forEach(c => {
            regionCounts[c.region] = (regionCounts[c.region] || 0) + 1;
        });

        if (State.jigsawMode) {
            const invalidRegions = Object.values(regionCounts).some(count => count !== State.size);
            if (invalidRegions) {
                alert(`Generation Failed: Jigsaw rules require every painted region to contain exactly ${State.size} cells.`);
                return; 
            }
        } else if (State.suguruMode) {
            const invalidRegions = Object.values(regionCounts).some(count => count > 9);
            if (invalidRegions) {
                alert(`Generation Failed: Suguru regions cannot exceed 9 cells!`);
                return; 
            }
        }

        const label = document.getElementById('status-label');
        if (label) {
            label.textContent = State.suguruMode ? "Generating Suguru..." : "Generating Jigsaw...";
            label.style.color = "var(--text-main)";
        }
        setTimeout(() => generateWithRetry(15), 10);
    } else {
        // 3. Classic Sudoku Generator
        if (originalGenerateNew) originalGenerateNew();
        if (State.mode === 'solve' && State.fogMode) {
            setTimeout(() => propagateFogReveal(), 50);
        }
    }
};

// --- INITIALIZE TOOLTIPS ---
Object.keys(Tooltips).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        const parentLabel = el.closest('label');
        if (parentLabel) {
            parentLabel.title = Tooltips[id];
        } else {
            el.title = Tooltips[id];
        }
    }
});

// --- INITIALIZE DEFAULT STATE ---
window.setTool('pointer');

window.isCustomTitle = false;

setTimeout(() => {
    const titleEl = document.getElementById('puzzle-title');
    if (titleEl) {
        titleEl.addEventListener('input', () => {
            window.isCustomTitle = true;
        });
    }
}, 200);

window.updateDynamicTitle = () => {
    if (window.isCustomTitle || State.isPlayOnly) return;

    const isNurikabePuzzle = State.solutionShadeMap && State.solutionShadeMap.some(v => v !== 0);
    // Declared ONCE right here:
    const titleEl = document.getElementById('puzzle-title');

    if (isNurikabePuzzle) {
        if (titleEl) titleEl.innerText = "Nurikabe";
        return;
    }

    // --- THE FIX: SPLIT PREFIXES FROM CORE MODES ---
    const prefixTypes = new Set();
    const coreTypes = new Set();
    
    if (State.variants) {
        State.variants.forEach(v => {
            if (v.type === 'thermo') prefixTypes.add('Thermo');
            if (v.type === 'whisper') prefixTypes.add('German Whisper');
            if (v.type === 'killer') prefixTypes.add('Killer');
            if (v.type.startsWith('kropki')) prefixTypes.add('Kropki');
        });
    }
    
    if (State.antiKnight) prefixTypes.add('Anti-Knight');
    if (State.antiKing) prefixTypes.add('Anti-King');
    if (document.getElementById('rule-sandwich')?.checked) prefixTypes.add('Sandwich');
    if (document.getElementById('rule-skyscraper')?.checked) prefixTypes.add('Skyscraper');
    if (document.getElementById('rule-frames')?.checked) prefixTypes.add('Frames');
    if (document.getElementById('rule-rooms')?.checked) prefixTypes.add('Rooms');
    
    // Core modes glue directly next to "Sudoku"
    if (State.fogMode) coreTypes.add('Fog of War');
    if (State.shiftMode) coreTypes.add('Torus');
    if (State.jigsawMode) coreTypes.add('Jigsaw');
    if (State.suguruMode) coreTypes.add('Suguru');
    
    // We reuse the titleEl from the top of the function here!
    if (titleEl) {
        let parts = [];
        if (prefixTypes.size > 0) parts.push(Array.from(prefixTypes).join(' '));
        if (coreTypes.size > 0) parts.push(Array.from(coreTypes).join(' '));
        parts.push('Sudoku');
        
        titleEl.innerText = parts.join(' ');
    }
};

// --- MASTER RESET CONTROLS ---

// 1. CREATE MODE: Nuclear Wipe
window.handleClearAllCreate = () => {
    if (!confirm("Wipe the entire board? This will delete all digits, variants, clues, and fog.")) return;
    State.board.forEach(c => { c.val = 0; c.given = false; c.notes = []; c.color = null; });
    State.variants = [];
    State.fogMap = Array(State.size * State.size).fill(false);
    State.fogRevealed = Array(State.size * State.size).fill(false);
    State.fogLinks = {};
    State.fogTriggers = {};
    State.shadeMap = Array(State.size * State.size).fill(0);
    State.solutionShadeMap = Array(State.size * State.size).fill(0);
    State.clues = {};
    window.AdvancedState.fogLinkSource = null;
    window.AdvancedState.variantUndoStack = [];
    window.AdvancedState.variantRedoStack = [];
    window.isCustomTitle = false; 
    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
};

// 2. CREATE MODE: Digits Only
window.handleClearDigitsCreate = () => {
    if (!confirm("Clear all digits? Variants and fog will remain.")) return;
    State.board.forEach(c => { c.val = 0; c.given = false; c.notes = []; });
    if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
};

// 3. SOLVE MODE: Full Restart
window.handleResetSolve = () => {
    // --- TORUS RESTART LOGIC ---
    if (State.shiftMode) {
        if (!confirm("Restart Torus puzzle? This will undo all your shifts and return the board to its initial scrambled state.")) return;
        
        if (State.torusScrambleStart) {
            State.board = JSON.parse(State.torusScrambleStart);
            State.isWon = false;
            
            const winOverlay = document.getElementById('win-overlay');
            if (winOverlay) winOverlay.style.display = 'none';
            if (typeof Renderer !== 'undefined' && Renderer.stopConfetti) Renderer.stopConfetti();
            if (typeof window.updateUI === 'function') window.updateUI();
        } else {
            alert("No starting state found. Please click 'Generate Torus' to scramble a new puzzle!");
        }
        return;
    }

    // --- CLASSIC RESTART LOGIC ---
    if (!confirm("Restart puzzle? This will clear your inputs, pencils, and reset the fog.")) return;
    
    // Clear digits and pencils
    State.board.forEach(c => { if(!c.given) { c.val = 0; c.notes = []; c.color = null; } });
    
    // Clear Nurikabe Shading
    if (State.solutionShadeMap && State.solutionShadeMap.some(v => v !== 0)) {
        State.shadeMap = Array(State.size * State.size).fill(0);
    }
    
    if (State.fogMode) State.fogRevealed = Array(State.size * State.size).fill(false);
    State.isWon = false;
    
    const winOverlay = document.getElementById('win-overlay');
    if (winOverlay) winOverlay.style.display = 'none';
    if (typeof Renderer !== 'undefined' && Renderer.stopConfetti) Renderer.stopConfetti();
    if (typeof window.updateUI === 'function') window.updateUI();
};

// 4. SOLVE MODE: Inputs Only
window.handleClearUserInputs = () => {
    if (!confirm("Clear all your main digit inputs? (Pencil marks will remain)")) return;
    State.board.forEach(c => { if(!c.given) c.val = 0; });
    if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
};

// 5. SOLVE MODE: Pencils Only
window.handleClearPencils = () => {
    if (!confirm("Clear all pencil marks?")) return;
    State.board.forEach(c => { if(!c.given) c.notes = []; });
    if (typeof Renderer !== 'undefined' && window.updateUI) window.updateUI();
};

window.hardResetApp = () => {
    if (confirm("Are you absolutely sure?\n\nThis will permanently delete your autosave and restore all default settings.")) {
        window.isWiping = true; // <-- This blocks the autosave from re-firing!
        localStorage.removeItem('sudoku_autosave');
        
        // Force a redirect to the clean URL (strips any ?puzzle= params too)
        window.location.href = window.location.origin + window.location.pathname;
    }
};

// =====================================================================
// --- AUTOSAVE SYSTEM (SESSION PERSISTENCE) ---
// =====================================================================

window.autoSaveTimeout = null;

window.forceAutosave = () => {
    // BLOCK the save if we are wiping or the engine is still booting
    if (window.isWiping || window.isBootingForAutosave) return; 

    if (!State.board || State.board.length === 0) return;

    const sessionData = {
        // Core Data
        size: State.size,
        mode: State.mode,
        board: State.board,
        variants: State.variants,
        clues: State.clues || {},
        timerVal: State.timerVal,
        isWon: State.isWon,
        darkMode: State.darkMode,
        shiftMode: State.shiftMode,
        lockedMap: State.lockedMap,
        shadeMap: State.shadeMap,
        solutionShadeMap: State.solutionShadeMap || [],
        torusScrambleStart: State.torusScrambleStart,
        
        // Toggles & Rules
        antiKnight: State.antiKnight,
        antiKing: State.antiKing,
        jigsawMode: State.jigsawMode,
        suguruMode: State.suguruMode,
        fogMode: State.fogMode,
        showOuterClues: State.showOuterClues,
        
        // Fog Data
        fogMap: State.fogMap,
        fogRevealed: State.fogRevealed,
        fogLinks: State.fogLinks || {},
        fogTriggers: State.fogTriggers || {},

        // --- ADDED: UI & Visibility Toggles ---
        visSeen: document.getElementById('toggle-seen')?.checked ?? true,
        visMatch: document.getElementById('toggle-match')?.checked ?? true,
        visErrors: document.getElementById('toggle-errors')?.checked ?? true,
        visTimer: document.getElementById('toggle-timer')?.checked ?? true,
        ruleSandwich: document.getElementById('rule-sandwich')?.checked ?? false,
        ruleSkyscraper: document.getElementById('rule-skyscraper')?.checked ?? false,
        ruleFrames: document.getElementById('rule-frames')?.checked ?? false,
        ruleRooms: document.getElementById('rule-rooms')?.checked ?? false
    };
    
    const titleEl = document.getElementById('puzzle-title');
    if (titleEl) sessionData.title = titleEl.innerText;
    
    sessionData.isCustomTitle = window.isCustomTitle;

    localStorage.setItem('sudoku_autosave', JSON.stringify(sessionData));
};

window.triggerAutosave = () => {
    if (window.autoSaveTimeout) clearTimeout(window.autoSaveTimeout);
    window.autoSaveTimeout = setTimeout(window.forceAutosave, 500); 
};

window.addEventListener('beforeunload', () => window.forceAutosave());

// --- THE MASTER HOOK ---
const originalUpdateUI = window.updateUI;
window.updateUI = () => {
    if (originalUpdateUI) originalUpdateUI();
    // Win check must run after EVERY UI update (covers Nurikabe shading, etc.)
    if (typeof window.checkAdvancedWin === 'function') window.checkAdvancedWin();
    if (typeof window.triggerAutosave === 'function') window.triggerAutosave();
    if (typeof renderTorusBoard === 'function') renderTorusBoard();
    if (typeof renderVariantOverlay === 'function') renderVariantOverlay();
};

// --- STATE REHYDRATOR ---
window.loadAutosave = () => {
    const saved = localStorage.getItem('sudoku_autosave');
    if (!saved) return false;
    
    try {
        const data = JSON.parse(saved);
        
        State.size = data.size || 9;
        State.mode = data.mode || 'create';
        State.board = data.board;
        State.variants = data.variants || [];
        State.clues = data.clues || {};
        State.timerVal = data.timerVal || 0;
        State.isWon = data.isWon || false;
        State.darkMode = data.darkMode !== undefined ? data.darkMode : true;
        
        State.antiKnight = data.antiKnight || false;
        State.antiKing = data.antiKing || false;
        State.jigsawMode = data.jigsawMode || false;
        State.suguruMode = data.suguruMode || false;
        State.fogMode = data.fogMode || false;
        State.showOuterClues = data.showOuterClues || false;
        
        State.fogMap = data.fogMap || Array(data.size * data.size).fill(false);
        State.fogRevealed = data.fogRevealed || Array(data.size * data.size).fill(false);
        State.fogLinks = data.fogLinks || {};
        State.fogTriggers = data.fogTriggers || {};

        State.shiftMode = data.shiftMode || false;
        State.lockedMap = data.lockedMap || Array(data.size * data.size).fill(false);
        State.shadeMap = data.shadeMap || Array(data.size * data.size).fill(0);
        State.solutionShadeMap = data.solutionShadeMap || Array(data.size * data.size).fill(0);
        State.torusScrambleStart = data.torusScrambleStart || null;
        
        // --- 1. RESTORE ALL CHECKBOXES ---
        const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
        
        setCheck('toggle-anti-knight', State.antiKnight);
        setCheck('toggle-anti-king', State.antiKing);
        setCheck('toggle-jigsaw', State.jigsawMode);
        setCheck('toggle-suguru', State.suguruMode);
        setCheck('toggle-fog', State.fogMode);
        setCheck('toggle-outer-clues', State.showOuterClues);
        
        setCheck('toggle-shift', State.shiftMode);
        if (typeof window.toggleShiftMode === 'function') window.toggleShiftMode();
        
        setCheck('toggle-seen', data.visSeen !== undefined ? data.visSeen : true);
        setCheck('toggle-match', data.visMatch !== undefined ? data.visMatch : true);
        setCheck('toggle-errors', data.visErrors !== undefined ? data.visErrors : true);
        setCheck('toggle-timer', data.visTimer !== undefined ? data.visTimer : true);
        
        setCheck('rule-sandwich', data.ruleSandwich || false);
        setCheck('rule-skyscraper', data.ruleSkyscraper || false);
        setCheck('rule-frames', data.ruleFrames || false);
        setCheck('rule-rooms', data.ruleRooms || false);
        
        // --- THE FIX: Restore the boolean state first! ---
        window.isCustomTitle = data.isCustomTitle || false;
        
        if (data.title && window.isCustomTitle) {
            const titleEl = document.getElementById('puzzle-title');
            if (titleEl) titleEl.innerText = data.title;
        } else {
            if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
        }
        
        // --- 2. RESTORE THEME VISUALS ---
        document.body.classList.toggle('dark-mode', State.darkMode);
        document.querySelectorAll('.btn-theme').forEach(btn => {
            btn.innerText = State.darkMode ? "Toggle Light Mode" : "Toggle Dark Mode";
        });
        
        // --- 3. RESTORE 6x6 / 9x9 BUTTON STATE ---
        const size6Btn = document.getElementById('size6');
        const size9Btn = document.getElementById('size9');
        if (size6Btn) size6Btn.className = (State.size === 6) ? 'active' : '';
        if (size9Btn) size9Btn.className = (State.size === 9) ? 'active' : '';
        
        // --- 4. RELOAD GRID ---
        if (State.jigsawMode || State.suguruMode) {
            const regionToolBtn = document.getElementById('tool-region');
            const resetRegionsBtn = document.getElementById('btn-reset-regions'); 
            if (regionToolBtn) regionToolBtn.style.display = 'block';
            if (resetRegionsBtn) resetRegionsBtn.style.display = 'block'; 
        }
        
        if (typeof window.toggleFogMode === 'function') window.toggleFogMode();
        if (typeof Renderer.renderGrid === 'function') Renderer.renderGrid();
        if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
        if (typeof Renderer.updateUI === 'function') Renderer.updateUI();
        
        // --- 5. RESTORE CREATE / SOLVE LAYOUT ---
        const m = State.mode;
        document.getElementById('modeCreate').classList.toggle('active', m === 'create');
        document.getElementById('modeSolve').classList.toggle('active', m === 'solve');
        document.getElementById('gen-controls').style.display = m === 'create' ? 'grid' : 'none';
        document.getElementById('size-selector').style.display = m === 'create' ? 'flex' : 'none';
        document.getElementById('timer').style.display = m === 'create' ? 'none' : 'block';
        document.getElementById('pause-btn').style.display = m === 'create' ? 'none' : 'block';
        
        const variantPanel = document.getElementById('variant-tools-panel');
        if (variantPanel) variantPanel.style.display = (m === 'create') ? 'flex' : 'none';
        
        const statusLabel = document.getElementById('status-label');
        if (statusLabel) statusLabel.style.display = (m === 'create') ? 'block' : 'none';

        const createActions = document.getElementById('create-mode-actions');
        const solveActions = document.getElementById('solve-mode-actions');
        if (createActions) createActions.style.display = (m === 'create') ? 'flex' : 'none';
        if (solveActions) solveActions.style.display = (m === 'solve') ? 'flex' : 'none';
        
        const autoFillBtn = document.getElementById('btn-autofill-pencils');
        const cleanPencilsLink = document.getElementById('clean-pencils-link');
        const clearInputsLink = document.getElementById('clear-inputs-link');
        
        if (autoFillBtn) autoFillBtn.style.display = (m === 'solve' && !State.shiftMode) ? 'inline' : 'none';
        if (cleanPencilsLink) cleanPencilsLink.style.display = (m === 'solve' && !State.shiftMode) ? 'inline' : 'none';
        if (clearInputsLink) clearInputsLink.style.display = (m === 'solve' && !State.shiftMode) ? 'inline' : 'none';
        
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.style.visibility = (data.visTimer !== false) ? 'visible' : 'hidden';
        
        if (m === 'solve' && !State.isWon) {
            if (typeof window.startTimer === 'function') window.startTimer();
        }

        window.setAppMode(State.mode); 
        if (State.shiftMode) window.toggleShiftMode();
        
        console.log("Autosave restored seamlessly!");

        // After everything is loaded, refresh fog visibility
        if (State.mode === 'solve' && State.fogMode) {
            setTimeout(() => propagateFogReveal(), 50);
        }
        
        return true;
    } catch(e) {
        console.error("Failed to load autosave", e);
        return false;
    }
};

// Expose fog propagation for other modules (like Nurikabe.js)
window.propagateFogReveal = propagateFogReveal;

// End of advanced-main.js
