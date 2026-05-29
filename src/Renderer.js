import { State } from './GameState.js';
import { hasConflict, getCount, countSolutions } from './SudokuLogic.js';
import { getLineValues, checkSandwich, checkSkyscraper, checkFrames, checkNumberedRoom } from './variants/Perimeter.js';
import { GameRules } from './RuleDictionary.js';

export function initHighlighter() {
    const container = document.getElementById('highlighter-tools');
    if (!container) return;
    container.innerHTML = '';
    
    State.colors.forEach(c => {
        // If the array item is our special divider keyword, draw the line
        if (c === 'divider') {
            const hr = document.createElement('hr');
            hr.className = 'tool-divider';
            // Force the divider to stretch across all 3 grid columns
            hr.style.gridColumn = 'span 3'; 
            hr.style.margin = '4px 0';
            container.appendChild(hr);
            return; // Skip the rest of the loop so it doesn't make a button
        }
        
        // Otherwise, draw the standard color button
        const btn = document.createElement('button');
        btn.className = 'color-btn'; 
        btn.style.backgroundColor = c;
        btn.onclick = () => window.applyColor(c); 
        container.appendChild(btn);
    });
}

export function updateUI() {
    const primaryActive = State.selected.length > 0 ? State.selected[State.selected.length - 1] : null;
    const isBoardCell = primaryActive !== null && typeof primaryActive === 'number';

    const selVal = isBoardCell ? State.board[primaryActive].val : 0;
    const selR = isBoardCell ? Math.floor(primaryActive / State.size) : -1;
    const selC = isBoardCell ? primaryActive % State.size : -1;
    
    const selRegion = isBoardCell && State.board[primaryActive] ? State.board[primaryActive].region : null;

    const isNurikabePuzzle = State.solutionShadeMap && State.solutionShadeMap.some(v => v !== 0);
    const isNurikabeSolve = State.mode === 'solve' && isNurikabePuzzle;

    // --- NURIKABE ISOLATION FIX ---
    let showSeen = document.getElementById('toggle-seen')?.checked ?? true;
    let showMatch = document.getElementById('toggle-match')?.checked ?? true;
    let showErrors = document.getElementById('toggle-errors')?.checked ?? true;

    const safeDisplay = (id, displayStyle) => {
        const el = document.getElementById(id);
        if (el && el.parentElement) el.parentElement.style.display = displayStyle;
    };

    if (isNurikabeSolve) {
        // 1. Force Sudoku highlight math completely OFF
        showSeen = false;
        showMatch = false;
        showErrors = false;
        
        // 2. Hide Sudoku menus
        safeDisplay('highlighter-tools', 'none');
        safeDisplay('toggle-seen', 'none');
        safeDisplay('toggle-match', 'none');
        safeDisplay('toggle-errors', 'none');
        safeDisplay('toggle-timer', 'flex'); // Keep timer
        
        const clearInputsLink = document.getElementById('clear-inputs-link');
        const cleanPencilsLink = document.getElementById('clean-pencils-link');
        const autoFillBtn = document.getElementById('btn-autofill-pencils');
        if (clearInputsLink) clearInputsLink.style.display = 'none';
        if (cleanPencilsLink) cleanPencilsLink.style.display = 'none';
        if (autoFillBtn) autoFillBtn.style.display = 'none';
    } else {
        safeDisplay('highlighter-tools', 'flex');
        safeDisplay('toggle-seen', 'flex');
        safeDisplay('toggle-match', 'flex');
        safeDisplay('toggle-errors', 'flex');
    }
    // -----------------------------
    // ---DELETE THIS IF IT BREAKS---
    const isSeen = (idx, activeIdx) => {
        if (!isBoardCell || activeIdx === null) return false;
        const r1 = Math.floor(idx / State.size), c1 = idx % State.size;
        return r1 === selR || c1 === selC || State.board[idx].region === selRegion;
    };

    State.board.forEach((cell, i) => {
        const cellEl = document.getElementById(`cell-${i}`);
        if (!cellEl) return;
        
        cellEl.className = 'cell';
        if (cell.given) cellEl.classList.add('given');
        else if (cell.val !== 0) cellEl.classList.add('user');

        if (State.selected.includes(i)) {
            // 3. Suppress the blue highlight border when clicking a clue in Nurikabe mode
            if (!isNurikabeSolve) cellEl.classList.add('selected'); 
        }

        // 4. Suppress red text errors
        if (showErrors && State.mode === 'solve' && cell.val !== 0) {
            import('./SudokuLogic.js').then(module => {
                if (module.hasConflict(State.board, i, cell.val)) cellEl.classList.add('error');
            });
        }

        let bgColor = cell.color || '';
        if (showSeen && isSeen(i, primaryActive)) bgColor = 'rgba(100, 116, 139, 0.1)';
        if (showMatch && cell.val !== 0 && cell.val === selVal) bgColor = 'rgba(52, 152, 219, 0.2)';
        
        cellEl.style.backgroundColor = bgColor;

        if (State.mode === 'solve' && State.fogMode && State.fogMap[i] && !State.fogRevealed[i]) {
            cellEl.innerText = '';
            cellEl.style.backgroundColor = '#1e293b'; 
        } else if (cell.val !== 0) {
            cellEl.innerText = cell.val;
        } else if (cell.notes.length > 0 && State.mode === 'solve') {
            cellEl.innerText = '';
            const pGrid = document.createElement('div');
            pGrid.className = 'pencil-grid';
            for (let n = 1; n <= State.size; n++) {
                const pNum = document.createElement('div');
                pNum.className = 'pencil-num';
                if (cell.notes.includes(n)) {
                    pNum.innerText = n;
                    if (showErrors) {
                        import('./SudokuLogic.js').then(module => {
                            if (module.hasConflict(State.board, i, n)) pNum.classList.add('error');
                        });
                    }
                }
                pGrid.appendChild(pNum);
            }
            cellEl.appendChild(pGrid);
        } else {
            cellEl.innerText = '';
        }
    });

    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    //---DELETE ABOVE HERE IF IT BREAKS---
    
    // --- NEW: JIGSAW PAINTER MATH (CONTIGUOUS FLOOD FILL) ---
    const isRegionTool = typeof window !== 'undefined' && window.AdvancedState && window.AdvancedState.activeTool === 'region';
    const cellRegionCounts = Array(State.size * State.size).fill(0);
    
    if (isRegionTool) {
        const visited = new Set();
        for (let i = 0; i < State.size * State.size; i++) {
            if (visited.has(i)) continue;
            
            const targetRegion = State.board[i].region;
            const queue = [i];
            const component = [i];
            visited.add(i);
            
            while(queue.length > 0) {
                const curr = queue.shift();
                const r = Math.floor(curr / State.size);
                const c = curr % State.size;
                
                // Find physical neighbors (Up, Down, Left, Right)
                const neighbors = [];
                if (r > 0) neighbors.push(curr - State.size);
                if (r < State.size - 1) neighbors.push(curr + State.size);
                if (c > 0) neighbors.push(curr - 1);
                if (c < State.size - 1) neighbors.push(curr + 1);
                
                for (const n of neighbors) {
                    // If neighbor shares the exact same name AND hasn't been counted yet
                    if (!visited.has(n) && State.board[n].region === targetRegion) {
                        visited.add(n);
                        queue.push(n);
                        component.push(n); // Add to this specific blob
                    }
                }
            }
            
            // Assign the total blob count to every cell that belongs to it
            const count = component.length;
            for (const cellIdx of component) {
                cellRegionCounts[cellIdx] = count;
            }
        }
    }
    // --------------------------------------------------------

    // --- NEW: FOG CONFLICT MASK ---
    // Creates a temporary copy of the board where fogged cells are treated as empty (val: 0)
    // This completely prevents "spidey-sense" cheating!
    const maskedBoard = State.board.map((cell, idx) => {
        const isHidden = State.mode === 'solve' && State.fogMode && State.fogMap && State.fogMap[idx] && State.fogRevealed && !State.fogRevealed[idx];
        return isHidden ? { ...cell, val: 0 } : cell;
    });

    try {
        State.board.forEach((data, i) => {
            const el = document.getElementById(`cell-${i}`);
            if (!el) return;

            el.innerHTML = '';
            el.className = el.className.split(' ').filter(c => !['selected', 'highlight', 'match', 'given', 'user', 'error'].includes(c)).join(' ');

            const r = Math.floor(i / State.size), c = i % State.size;

            let tint = "rgba(255, 255, 255, 0)"; 
            el.style.boxShadow = 'none';

            // --- NEW: REGION PAINTER COLOR LOGIC ---
            if (isRegionTool) {
                const count = cellRegionCounts[i];
                if (count === State.size) {
                    tint = State.darkMode ? "rgba(74, 222, 128, 0.25)" : "rgba(46, 204, 113, 0.25)"; // PERFECT: Faded Green
                } else if (count > State.size) {
                    tint = State.darkMode ? "rgba(248, 113, 113, 0.25)" : "rgba(231, 76, 60, 0.25)"; // OVERFLOW: Faded Red
                } else {
                    tint = State.darkMode ? "rgba(148, 163, 184, 0.3)" : "rgba(203, 213, 225, 0.6)"; // IN-PROGRESS: Faded Grey
                }
            } 
            // ---------------------------------------
            else if (State.selected.includes(i)) {
                el.classList.add('selected');
                tint = State.darkMode ? "rgba(56, 189, 248, 0.5)" : "rgba(52, 152, 219, 0.4)"; 

                const hasTop = r > 0 && State.selected.includes(i - State.size);
                const hasBottom = r < State.size - 1 && State.selected.includes(i + State.size);
                const hasLeft = c > 0 && State.selected.includes(i - 1);
                const hasRight = c < State.size - 1 && State.selected.includes(i + 1);

                const selColor = State.darkMode ? "#74b9ff" : "#3498db";
                let shadows = [];
                if (!hasTop) shadows.push(`inset 0 2px 0 0 ${selColor}`);
                if (!hasBottom) shadows.push(`inset 0 -2px 0 0 ${selColor}`);
                if (!hasLeft) shadows.push(`inset 2px 0 0 0 ${selColor}`);
                if (!hasRight) shadows.push(`inset -2px 0 0 0 ${selColor}`);
                if (shadows.length > 0) el.style.boxShadow = shadows.join(', ');

            } else if (showSeen && (r === selR || c === selC || data.region === selRegion)) {
                el.classList.add('highlight');
                tint = State.darkMode ? "rgba(56, 189, 248, 0.15)" : "rgba(52, 152, 219, 0.1)"; 
            } else if (showMatch && selVal !== 0 && data.val === selVal) {
                el.classList.add('match');
                tint = State.darkMode ? "rgba(74, 222, 128, 0.4)" : "rgba(46, 204, 113, 0.3)"; 
            }

            let highlightBase = data.color || (State.darkMode ? "#1e293b" : "white");
            el.style.background = `linear-gradient(${tint}, ${tint}), ${highlightBase}`;

            // --- NEW: RENDER LOCK OVERLAY ---
            if (State.lockedMap && State.lockedMap[i]) {
                el.style.boxShadow = `inset 0 0 0 3px rgba(255, 255, 255, 0.4), inset 0 0 10px rgba(0,0,0,0.5)`;
                // Optional: Add a faint padlock icon in the corner
                el.innerHTML += `<div style="position: absolute; top: 2px; right: 4px; font-size: 10px; opacity: 0.5; pointer-events: none; z-index: 5;">🔒</div>`;
            }

            // --- NEW: FOG RENDERING ---
            const isFogged = State.fogMode && State.fogMap && State.fogMap[i];
            const isRevealed = State.mode === 'solve' && State.fogRevealed && State.fogRevealed[i];

            if (State.mode === 'solve' && isFogged && !isRevealed) {
                // PURE FOG: Hides everything underneath
                const fogColor = State.darkMode ? '#0f172a' : '#94a3b8';
                
                // Highlight the fog cloud if the user has clicked it!
                const isSelectedFog = State.selected.includes(i);
                const focusStyle = isSelectedFog ? `box-shadow: inset 0 0 0 2px #38bdf8, inset 0 0 15px rgba(56,189,248,0.4);` : '';

                el.innerHTML = `<div style="position: absolute; inset: -1px; background: ${fogColor}; ${focusStyle} z-index: 100; display: flex; align-items: center; justify-content: center; font-size: 20px; opacity: 0.98; transition: all 0.2s;">☁️</div>`;
                return; // Skips rendering numbers!
            }
            // --------------------------

            if (data.val !== 0) {
                el.innerHTML = `<span style="position: relative; z-index: 20;">${data.val}</span>`;
                el.classList.add(data.given ? 'given' : 'user');
                // Check if errors are turned on!
                if (showErrors && hasConflict(maskedBoard, i, data.val)) el.classList.add('error');
                
            } else if (State.mode === 'create' && State.showGhost && State.solution && State.solution[i]) {
                const ghostColor = State.darkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(30, 41, 59, 0.2)";
                el.innerHTML = `<span style="position: relative; z-index: 20; color: ${ghostColor}; font-style: italic;">${State.solution[i]}</span>`;
                
            } else if (data.notes.length > 0) {
                const pGrid = document.createElement('div');
                pGrid.className = 'pencil-grid';
                pGrid.style.zIndex = '20'; 
                for(let n = 1; n <= 9; n++) {
                    const nDiv = document.createElement('div'); 
                    nDiv.className = 'pencil-num';
                    if (data.notes.includes(n)) {
                        nDiv.innerHTML = `<span style="position: relative; z-index: 20;">${n}</span>`;
                        // THE FIX: Force the color change directly so it doesn't rely on CSS
                        if (showErrors && hasConflict(maskedBoard, i, n)) {
                            nDiv.classList.add('error');
                            nDiv.style.color = "var(--danger)"; 
                        }
                    }
                    pGrid.appendChild(nDiv);
                }
                el.appendChild(pGrid);
            } else if (isRegionTool) {
                
                // --- NEW: DYNAMIC REGION TEXT OVERLAY ---
                const count = cellRegionCounts[i]; 
                const textStr = State.suguruMode ? count : `${count}/${State.size}`;
                const ghostColor = State.darkMode ? "rgba(255, 255, 255, 0.3)" : "rgba(30, 41, 59, 0.3)";
                el.innerHTML = `<span style="position: relative; z-index: 20; color: ${ghostColor}; font-size: 13px; font-weight: 800;">${textStr}</span>`;
            }
            
            // --- NEW: CREATE MODE VISUALS ---
            const isFogLinkTool = typeof window !== 'undefined' && window.AdvancedState && window.AdvancedState.activeTool === 'fog-link';
            const fogSource = isFogLinkTool ? window.AdvancedState.fogLinkSource : null;
            const fogTargets = (isFogLinkTool && fogSource !== null && State.fogLinks[fogSource]) ? State.fogLinks[fogSource] : [];

            if (State.mode === 'create') {
                if (isFogged) {
                    // Translucent overlay so you can see where fog is
                    const fogColor = State.darkMode ? '#0f172a' : '#cbd5e1';
                    el.innerHTML += `<div style="position: absolute; inset: 0; background: ${fogColor}; opacity: 0.6; z-index: 40; pointer-events: none;"></div>`;
                }
                
                // Highlight the Linker Source (Purple) and Targets (Pink)
                if (isFogLinkTool) {
                    if (i === fogSource) {
                        el.style.boxShadow = `inset 0 0 0 3px #a855f7`;
                        el.innerHTML += `<div style="position: absolute; inset: 0; background: rgba(168, 85, 247, 0.3); z-index: 45; pointer-events: none;"></div>`;
                    } else if (fogTargets.includes(i)) {
                        el.style.boxShadow = `inset 0 0 0 3px #ec4899`;
                        el.innerHTML += `<div style="position: absolute; inset: 0; background: rgba(236, 72, 153, 0.3); z-index: 45; pointer-events: none;"></div>`;
                    }
                }
            }
        });
    } catch (e) {
        console.error("Renderer crash prevented safely:", e);
    }
    
    if (State.mode === 'create') validateStatus();
    renderNumpad();

    // --- RENDER PERIMETER CLUES ---
    if (State.showOuterClues) {
        for (let r = -1; r <= State.size; r++) {
            for (let c = -1; c <= State.size; c++) {
                const isOuter = (r === -1 || r === State.size || c === -1 || c === State.size);
                if (!isOuter) continue;

                const id = `clue-${r}-${c}`;
                const el = document.getElementById(id);
                
                if (el) {
                    const val = State.clues?.[id] || "";
                    let isError = false;

                    if (val !== "") {
                        const lineVals = getLineValues(id);
                        const isSandwich = document.getElementById('rule-sandwich')?.checked;
                        const isSkyscraper = document.getElementById('rule-skyscraper')?.checked;
                        const isFrames = document.getElementById('rule-frames')?.checked;
                        const isRooms = document.getElementById('rule-rooms')?.checked;

                        if (isSandwich && checkSandwich(val, lineVals)) isError = true;
                        if (isSkyscraper && checkSkyscraper(val, lineVals)) isError = true;
                        if (isFrames && checkFrames(val, lineVals)) isError = true;
                        if (isRooms && checkNumberedRoom(val, lineVals)) isError = true;
                    }
                    
                    el.innerHTML = val !== "" ? `<span style="position: relative; z-index: 20;">${val}</span>` : "";
                    
                    if (isError) {
                        el.classList.add('error');
                        el.style.color = State.darkMode ? "#fb923c" : "#e74c3c"; 
                    } else {
                        el.classList.remove('error');
                        el.style.color = "var(--text-main)"; 
                    }

                    const isSel = State.selected.includes(id);
                    el.classList.toggle('selected', isSel);
                    
                    const hasVariant = State.variants.some(v => v.cells.includes(id));
                    
                    if (val !== "" || hasVariant) {
                        el.classList.add('active-clue');
                    } else {
                        el.classList.remove('active-clue');
                    }
                    
                    if (isSel) {
                        const selColor = State.darkMode ? "#74b9ff" : "#3498db";
                        el.style.boxShadow = `inset 0 0 0 2px ${selColor}`;
                    } else {
                        el.style.boxShadow = 'none';
                    }
                }
            }
        }
    }
    
    updateGameRules(); 
    
}

export function renderGrid() {
    const container = document.getElementById('grid');
    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.width = 'fit-content'; 
    container.style.gap = '0px';     
    container.style.border = 'none'; 
    
    // Dynamically sets columns to 9x9 or 11x11
    const show = State.showOuterClues;
    container.style.gridTemplateColumns = `repeat(${show ? State.size + 2 : State.size}, var(--cell-size))`; 
    
    // --- NEW: SPLIT GRID LINES FOR HIGH CONTRAST ---
    const thinGridLine = State.darkMode ? "#475569" : "#1e293b"; 
    const thickGridLine = State.darkMode ? "#ffffff" : "#1e293b";

    const wrapper = document.getElementById('grid-wrapper');
    
    wrapper.style.background = 'transparent'; 
    wrapper.style.width = 'fit-content'; 
    wrapper.style.margin = '0 auto';     
    container.style.background = 'transparent';

    // Shrinks the loop to skip the -1 and +1 perimeter if hidden
    const start = show ? -1 : 0;
    const end = show ? State.size : State.size - 1;

    for (let r = start; r <= end; r++) {
        for (let c = start; c <= end; c++) {
            const isOuter = (r === -1 || r === State.size || c === -1 || c === State.size);
            const isCorner = isOuter && (r === -1 || r === State.size) && (c === -1 || c === State.size);

            const div = document.createElement('div');
            
            if (isCorner) {
                // 1. Dead Corners (Invisible)
                div.className = 'clue-corner';
            } else if (isOuter) {
                // 2. The Sandbox Clue Cells
                div.className = 'clue-cell';
                const clueId = `clue-${r}-${c}`;
                div.id = clueId;
                
                div.addEventListener('pointerdown', (e) => {
                    if (State.paused || State.isWon) return;
                    e.target.releasePointerCapture(e.pointerId); // Added for smooth dragging
                    window.handleCellSelection(clueId, e.ctrlKey || e.metaKey, false);
                });
                
                // --- THE MISSING PIECE ---
                // This tells the drawing tools when your mouse enters the clue cell!
                div.addEventListener('pointerenter', (e) => {
                    if (State.paused || State.isWon) return;
                    if (e.buttons === 1) { 
                        window.handleCellSelection(clueId, true, true); 
                    }
                });

                div.addEventListener('contextmenu', (e) => e.preventDefault());
                
            } else {
                // 3. The Standard Sudoku Cells
                const i = r * State.size + c;
                div.className = 'cell'; 
                div.id = `cell-${i}`;
                
                const currentRegion = State.board[i].region;

                // --- DYNAMIC INNER BORDERS (Map-Based using thinGridLine) ---
                div.style.borderRight = `1px solid ${thinGridLine}`; 
                div.style.borderBottom = `1px solid ${thinGridLine}`; 
                
                // Outer Top/Left Thick Borders (using thickGridLine)
                if (r === 0) div.style.borderTop = `3px solid ${thickGridLine}`;
                if (c === 0) div.style.borderLeft = `3px solid ${thickGridLine}`;
                
                // Dynamic Right Border
                if (c < State.size - 1) {
                    const rightNeighborRegion = State.board[i + 1].region;
                    if (currentRegion !== rightNeighborRegion) {
                        div.style.borderRight = `3px solid ${thickGridLine}`; 
                    }
                } else {
                    div.style.borderRight = `3px solid ${thickGridLine}`; 
                }

                // Dynamic Bottom Border
                if (r < State.size - 1) {
                    const bottomNeighborRegion = State.board[i + State.size].region;
                    if (currentRegion !== bottomNeighborRegion) {
                        div.style.borderBottom = `3px solid ${thickGridLine}`; 
                    }
                } else {
                    div.style.borderBottom = `3px solid ${thickGridLine}`; 
                }
                // ------------------------------
          
                div.addEventListener('pointerdown', (e) => {
                    if (State.paused || State.isWon) return;
                    e.target.releasePointerCapture(e.pointerId); 
                    window.handleCellSelection(i, e.ctrlKey || e.metaKey, false);
                });

                div.addEventListener('pointerenter', (e) => {
                    if (State.paused || State.isWon) return;
                    if (e.buttons === 1) { 
                        window.handleCellSelection(i, true, true); 
                    }
                });

                div.addEventListener('contextmenu', (e) => e.preventDefault());
            }
            container.appendChild(div);
        }
    }
}

export function renderNumpad() {
    const pad = document.getElementById('numpad'); pad.innerHTML = '';
    
    const isNurikabePuzzle = State.solutionShadeMap && State.solutionShadeMap.some(v => v !== 0);
    const tool = window.AdvancedState?.activeTool || 'pointer';

    // --- NURIKABE DEDICATED TOOLBAR ---
    if (State.mode === 'solve' && isNurikabePuzzle) {
        const row1 = document.createElement('div'); row1.className = 'numpad-row';
        
        const modes = [
            { id: 'cycle', icon: '🔲', title: 'Cycle' },
            { id: 'black', icon: '⬛', title: 'Black / Dot' },
            { id: 'dot', icon: '⏺', title: 'Dot / Black' },
            { id: 'erase', icon: '🗑️', title: 'Erase' }
        ];

        window.AdvancedState.nurikabePaintMode = window.AdvancedState.nurikabePaintMode || 'cycle';

        modes.forEach(m => {
            const b = document.createElement('button');
            b.className = 'n-btn'; 
            b.style.width = '70px'; 
            b.style.fontSize = '18px';
            b.innerHTML = `${m.icon}<br><span style="font-size:9px; font-weight:600;">${m.title}</span>`;
            
            if (window.AdvancedState.nurikabePaintMode === m.id) {
                b.classList.add('pencil-active'); // Re-uses your gold active glow!
            }
            b.onclick = () => {
                window.AdvancedState.nurikabePaintMode = m.id;
                renderNumpad();
            };
            row1.appendChild(b);
        });
        pad.appendChild(row1);

        const row2 = document.createElement('div'); row2.className = 'numpad-row';
        const undoBtn = document.createElement('button'); undoBtn.className = 'n-btn'; undoBtn.style.width = '85px'; undoBtn.style.fontSize = '10px'; undoBtn.innerText = 'Undo\n(Ctrl + Z)';
        undoBtn.disabled = State.undoStack.length === 0 || State.isWon; undoBtn.onclick = window.triggerUndo;
        const redoBtn = document.createElement('button'); redoBtn.className = 'n-btn'; redoBtn.style.width = '85px'; redoBtn.style.fontSize = '10px'; redoBtn.innerText = 'Redo\n(Ctrl + Y)';
        redoBtn.disabled = State.redoStack.length === 0 || State.isWon; redoBtn.onclick = window.triggerRedo;
        
        row2.appendChild(undoBtn); row2.appendChild(redoBtn);
        pad.appendChild(row2);
        return; // Skip rendering the 1-9 Sudoku buttons completely!
    }

    // --- CLASSIC SUDOKU NUMPAD ---
    const row1 = document.createElement('div'); row1.className = 'numpad-row';
    for (let i = 1; i <= State.size; i++) {
        const b = document.createElement('button'); b.className = 'n-btn'; b.textContent = i;
        if (getCount(i) >= State.size) b.disabled = true;
        b.onclick = () => window.handleInput(i); 
        row1.appendChild(b);
    }
    pad.appendChild(row1);

    const row2 = document.createElement('div'); row2.className = 'numpad-row';
    const isVariantTool = ['thermo', 'whisper', 'killer', 'kropki-white', 'kropki-black', 'eraser', 'edit'].includes(tool);
    
    const canUndo = isVariantTool ? window.AdvancedState.variantUndoStack.length > 0 : State.undoStack.length > 0;
    const canRedo = isVariantTool ? window.AdvancedState.variantRedoStack.length > 0 : State.redoStack.length > 0;
    const undoAction = isVariantTool ? window.undoVariant : window.triggerUndo;
    const redoAction = isVariantTool ? window.redoVariant : window.triggerRedo;

    const btns = [
        { text: 'Undo\n(Ctrl + Z)', action: undoAction, disabled: !canUndo },
        { text: 'Redo\n(Ctrl + Y)', action: redoAction, disabled: !canRedo },
        { text: State.pencil ? 'Pencil ON\n(Tab)' : 'Pencil OFF\n(Tab)', action: () => { State.pencil = !State.pencil; renderNumpad(); }, solveOnly: true, isPencil: true },
        { text: 'Erase\n(Del)', action: () => window.handleInput(0), danger: true }
    ];

    btns.forEach(cfg => {
        if (cfg.solveOnly && State.mode !== 'solve') return;
        const b = document.createElement('button');
        b.className = 'n-btn'; b.style.width = '85px'; b.style.fontSize = '10px'; b.innerText = cfg.text;
        if (cfg.disabled || State.isWon) b.disabled = true;
        if (cfg.danger) b.style.color = 'var(--danger)';
        if (cfg.isPencil && State.pencil) b.classList.add('pencil-active');
        b.onclick = cfg.action;
        row2.appendChild(b);
    });
    pad.appendChild(row2);
}

export function validateStatus() {
    const label = document.getElementById('status-label');
    const currentBoard = State.board.map(c => c.val);
    const filledCount = currentBoard.filter(v => v !== 0).length;

    if (filledCount === 0) {
        label.textContent = "Enter Digits...";
        label.style.color = "var(--text-main)";
        return;
    }

    // SAFETY CHECK: Abort instantly if the user just placed a conflicting number!
    const hasExistingConflict = State.board.some((c, i) => hasConflict(State.board, i, c.val));
    if (hasExistingConflict) {
        label.textContent = "Rule Conflict";
        label.style.color = "var(--danger)";
        return; 
    }

    const solutions = countSolutions([...currentBoard], 0, true);
    
    // Handles the new abort code from the solver
    if (solutions === -1) {
        label.textContent = "Validating...";
        label.style.color = "#94a3b8"; 
    } else if (solutions === 1) {
        label.textContent = "Unique Puzzle";
        label.style.color = "var(--success)";
    } else if (solutions > 1) {
        label.textContent = "Multiple Solutions";
        label.style.color = "#f1c40f"; 
    } else {
        label.textContent = "No Valid Solution";
        label.style.color = "var(--danger)";
    }
}

export function fireConfetti() {
    const canvas = document.getElementById('confetti');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight;
    let particles = [];
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
    
    for (let i = 0; i < 150; i++) {
        particles.push({
            x: Math.random() * canvas.width, 
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 8 + 4, 
            color: colors[Math.floor(Math.random() * colors.length)],
            velX: Math.random() * 4 - 2, 
            velY: Math.random() * 10 + 5, 
            angle: Math.random() * 360
        });
    }
    window.confettiActive = true;
    function draw() {
        if (!window.confettiActive) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((p, i) => {
            p.y += p.velY; p.x += p.velX; p.angle += 5;
            ctx.save(); 
            ctx.translate(p.x, p.y); 
            ctx.rotate(p.angle * Math.PI / 180);
            ctx.fillStyle = p.color; 
            ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); 
            ctx.restore();
            if (p.y > canvas.height) particles[i].y = -20;
        });
        requestAnimationFrame(draw);
    }
    draw();
}

export function stopConfetti() {
    window.confettiActive = false;
    const canvas = document.getElementById('confetti');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// --- SVG DRAWING ENGINE ---
export function getCellCenter(index) {
    // This allows it to find coordinates for BOTH "45" and "clue--1-4"
    const data = getCellData(index);
    const el = document.getElementById(data.id);
    const svg = document.getElementById('svg-layer');
    if (!el || !svg) return { x: 0, y: 0 };

    const cellRect = el.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();

    return {
        x: (cellRect.left - svgRect.left) + (cellRect.width / 2),
        y: (cellRect.top - svgRect.top) + (cellRect.height / 2)
    };
}

// UNIVERSAL CELL PARSER
// Helps your variants draw lines seamlessly between inner and outer cells!
export function getCellData(idx) {
    if (typeof idx === 'string') {
        const match = idx.match(/clue-(-?\d+)-(-?\d+)/);
        return {
            id: idx,
            r: parseInt(match[1]),
            c: parseInt(match[2]),
            isOuter: true
        };
    } else {
        return {
            id: `cell-${idx}`,
            r: Math.floor(idx / State.size),
            c: idx % State.size,
            isOuter: false
        };
    }
}

// --- DYNAMIC RULE GENERATOR ---
export function updateGameRules() {
    const panel = document.getElementById('game-rules-panel');
    const list = document.getElementById('game-rules-list');
    if (!panel || !list) return;

    if (State.mode === 'create') {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';
    list.innerHTML = ''; 
    const rules = [];
    const isNurikabePuzzle = State.solutionShadeMap && State.solutionShadeMap.some(v => v !== 0);

    if (isNurikabePuzzle) {
        // ONLY show Nurikabe rules
        rules.push(GameRules.nurikabe());
    } else {
        // Show standard Sudoku rule stack
        if (State.suguruMode) rules.push(GameRules.suguru());
        else if (State.jigsawMode) rules.push(GameRules.jigsaw(State.size));
        else rules.push(GameRules.classic(State.size));

        if (State.fogMode) rules.push(GameRules.fog());
        if (State.shiftMode) rules.push(GameRules.torus());
        if (State.antiKnight) rules.push(GameRules.antiKnight());
        if (State.antiKing && !State.suguruMode) rules.push(GameRules.antiKing());

        const hasVar = (type) => State.variants && State.variants.some(v => v.type === type || v.type.startsWith(type));
        if (hasVar('thermo')) rules.push(GameRules.thermo());
        if (hasVar('whisper')) rules.push(GameRules.whisper());
        if (hasVar('killer')) rules.push(GameRules.killer());
        if (hasVar('kropki-white')) rules.push(GameRules.kropkiWhite());
        if (hasVar('kropki-black')) rules.push(GameRules.kropkiBlack());

        if (document.getElementById('rule-sandwich')?.checked) rules.push(GameRules.sandwich());
        if (document.getElementById('rule-skyscraper')?.checked) rules.push(GameRules.skyscraper());
        if (document.getElementById('rule-frames')?.checked) rules.push(GameRules.frames());
        if (document.getElementById('rule-rooms')?.checked) rules.push(GameRules.rooms());
    }

    rules.forEach(r => {
        const li = document.createElement('li');
        li.innerHTML = r;
        li.style.marginBottom = '10px';
        list.appendChild(li);
    });
}
