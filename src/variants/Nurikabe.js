// src/variants/Nurikabe.js
import { State, saveState } from '../GameState.js';

// ========== HELPER FUNCTIONS (must be defined first) ==========
function getNeighbors(i, size) {
    const r = Math.floor(i / size);
    const c = i % size;
    const n = [];
    if (r > 0) n.push(i - size);
    if (r < size - 1) n.push(i + size);
    if (c > 0) n.push(i - 1);
    if (c < size - 1) n.push(i + 1);
    return n;
}

function checkRiverContinuity(grid, size) {
    let firstRiver = grid.indexOf(2);
    if (firstRiver === -1) return true;
    let riverCount = grid.filter(s => s === 2).length;
    let visited = new Set([firstRiver]);
    let queue = [firstRiver];
    while (queue.length > 0) {
        let curr = queue.shift();
        for (let n of getNeighbors(curr, size)) {
            if (grid[n] === 2 && !visited.has(n)) {
                visited.add(n);
                queue.push(n);
            }
        }
    }
    return visited.size === riverCount;
}

function find2x2(grid, size) {
    for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size - 1; c++) {
            let i = r * size + c;
            if (grid[i] === 2 && grid[i+1] === 2 && grid[i+size] === 2 && grid[i+size+1] === 2) {
                return [i, i+1, i+size, i+size+1];
            }
        }
    }
    return null;
}

// ========== GENERATOR ==========
export function generateNurikabeGrid(size) {
    const totalCells = size * size;
    let grid = Array(totalCells).fill(2); 
    const targetWhite = Math.floor(totalCells * 0.45); 
    let currentWhite = 0;
    let islandRoots = [];
    const numIslands = Math.max(3, Math.floor(size * 1.2)); 

    for (let i = 0; i < numIslands; i++) {
        let rCell = Math.floor(Math.random() * totalCells);
        let touches = getNeighbors(rCell, size).some(n => grid[n] === 1);
        if (grid[rCell] === 2 && !touches) {
            grid[rCell] = 1;
            islandRoots.push([rCell]);
            currentWhite++;
        }
    }

    let growing = true;
    let attempts = 0;
    while (growing && currentWhite < targetWhite && attempts < 1000) {
        growing = false;
        attempts++;
        islandRoots.sort(() => Math.random() - 0.5); 
        
        for (let island of islandRoots) {
            let candidates = new Set();
            for (let cell of island) {
                getNeighbors(cell, size).forEach(n => { if (grid[n] === 2) candidates.add(n); });
            }
            
            let valid = Array.from(candidates).filter(c => {
                let adjacentWhite = getNeighbors(c, size).filter(n => grid[n] === 1);
                let touchesOther = adjacentWhite.some(n => !island.includes(n));
                if (touchesOther) return false;
                
                grid[c] = 1;
                let isConnected = checkRiverContinuity(grid, size);
                grid[c] = 2; 
                return isConnected;
            });
            
            if (valid.length > 0) {
                let pick = valid[Math.floor(Math.random() * valid.length)];
                grid[pick] = 1;
                island.push(pick);
                currentWhite++;
                growing = true;
            }
        }
    }

    let has2x2 = true;
    let fixAttempts = 0;
    while (has2x2 && fixAttempts < 100) {
        fixAttempts++;
        let pool = find2x2(grid, size);
        if (!pool) { has2x2 = false; break; }
        
        let fixed = false;
        pool.sort(() => Math.random() - 0.5);
        
        for (let c of pool) {
            let adjWhite = getNeighbors(c, size).filter(n => grid[n] === 1);
            let touchedIslandIdx = -1;
            let touchesMultiple = false;
            
            for (let w of adjWhite) {
                let idx = islandRoots.findIndex(isl => isl.includes(w));
                if (idx !== -1) {
                    if (touchedIslandIdx === -1) touchedIslandIdx = idx;
                    else if (touchedIslandIdx !== idx) touchesMultiple = true;
                }
            }
            
            if (touchedIslandIdx !== -1 && !touchesMultiple) {
                grid[c] = 1;
                if (checkRiverContinuity(grid, size)) {
                    islandRoots[touchedIslandIdx].push(c);
                    fixed = true; break;
                }
                grid[c] = 2; 
            }
        }
        if (!fixed) throw new Error("UNRESOLVABLE_2X2");
    }

    if (find2x2(grid, size) || !checkRiverContinuity(grid, size)) {
        throw new Error("INVALID_GRID_GENERATED");
    }

    let clues = [];
    islandRoots.forEach(isl => {
        if (isl.length > 0) {
            let cluePos = isl[Math.floor(Math.random() * isl.length)];
            clues.push({ i: cluePos, v: isl.length });
        }
    });

    return { shades: grid, clues: clues };
}

// ========== UI ACTIONS ==========
export function autoClueNurikabe() {
    const label = document.getElementById('status-label');
    if (label) { label.textContent = "Processing Board..."; label.style.color = "var(--text-main)"; }
    
    setTimeout(() => {
        State.board.forEach(c => { c.val = 0; c.given = false; c.notes = []; });
        const visited = new Set();
        const islands = [];

        for (let i = 0; i < State.size * State.size; i++) {
            if (State.shadeMap[i] === 1 && !visited.has(i)) {
                let island = [];
                let queue = [i];
                visited.add(i);

                while (queue.length > 0) {
                    let curr = queue.shift();
                    island.push(curr);
                    for (let n of getNeighbors(curr, State.size)) {
                        if (State.shadeMap[n] === 1 && !visited.has(n)) {
                            visited.add(n);
                            queue.push(n);
                        }
                    }
                }
                islands.push(island);
            }
        }

        islands.forEach(isl => {
            let clueIdx = isl[Math.floor(Math.random() * isl.length)];
            State.board[clueIdx].val = isl.length;
            State.board[clueIdx].given = true;
        });

        State.solutionShadeMap = [...State.shadeMap];
        // Check uniqueness
        const solCount = countNurikabeSolutions(State.board, State.size, 2);
        if (solCount !== 1) {
            // Add more clues from the solution to force uniqueness
            const islMap = getIslands(State.solutionShadeMap, State.size);
            const islandSize = {};
            // Determine island sizes
            for (let i = 0; i < State.size * State.size; i++) {
                const root = islMap[i];
                islandSize[root] = (islandSize[root] || 0) + 1;
            }
            // Add clues for all white cells not yet given
            for (let i = 0; i < State.size * State.size; i++) {
                if (State.shadeMap[i] === 1 && State.board[i].val === 0) {
                    const root = islMap[i];
                    State.board[i].val = islandSize[root];
                    State.board[i].given = true;
                }
            }
            // Now it's fully clued, definitely unique
        }
        // Player shading will be cleared by setAppMode’s Nurikabe hook
        // Clear undo history so Undo does not reveal the full shading
        if (State.undoStack) State.undoStack = [];
        if (State.redoStack) State.redoStack = [];
        if (window.AdvancedState) {
            window.AdvancedState.variantUndoStack = [];
            window.AdvancedState.variantRedoStack = [];
        }

        saveState();

        if (label) { label.textContent = "Custom Board Auto-Clued!"; label.style.color = "var(--success)"; }
        if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
        if (typeof window.setAppMode === 'function') window.setAppMode('solve');
        if (typeof window.updateUI === 'function') window.updateUI();
    }, 50);
}

export function generateRandomNurikabe(attemptsLeft = 30) {
    if (attemptsLeft <= 0) {
        // Fallback: generate a fully‑clued puzzle (unique by definition)
        const puzzle = generateNurikabeGrid(State.size);
        State.solutionShadeMap = puzzle.shades;
        // Set every white cell as a given digit
        for (let i = 0; i < State.size * State.size; i++) {
            if (puzzle.shades[i] === 1) {
                // compute island size
                // We'll do a quick flood fill for each island – but we already have the island roots?
                // Use the same logic as autoClueNurikabe later. For fallback we can just set all white cells as clues
                // with value = island size. Simplest: run autoClue-like extraction
                const islandMap = getIslands(puzzle.shades, State.size);
                const islandSizes = {};
                for (let idx of Object.keys(islandMap)) {
                    const root = islandMap[idx];
                    if (!islandSizes[root]) islandSizes[root] = 0;
                    islandSizes[root]++;
                }
                // find which island this cell belongs to and set clue
                const root = islandMap[i];
                State.board[i].val = islandSizes[root];
                State.board[i].given = true;
            } else {
                State.board[i].val = 0;
                State.board[i].given = false;
            }
        }
        State.shadeMap = Array(State.size * State.size).fill(0);
        // Clear undo stacks
        clearUndoStacks();
        saveState();
        updateStatus("Puzzle Ready! (fully clued)");
        switchToSolveMode();
        return;
    }

    const label = document.getElementById('status-label');
    if (label) { label.textContent = "Generating Nurikabe..."; label.style.color = "var(--text-main)"; }
    State.board.forEach(c => { c.val = 0; c.given = false; c.notes = []; });

    setTimeout(() => {
        try {
            const puzzle = generateNurikabeGrid(State.size);
            const solutionShades = puzzle.shades;
            // Place one clue per island
            const boardCopy = [];
            for (let i = 0; i < State.size * State.size; i++) {
                boardCopy.push({ val: 0, given: false, notes: [] });
            }
            puzzle.clues.forEach(clue => {
                boardCopy[clue.i].val = clue.v;
                boardCopy[clue.i].given = true;
            });

            // Uniqueness check
            const solCount = countNurikabeSolutions(boardCopy, State.size, 2);
            if (solCount !== 1) {
                // Not unique – retry
                console.log("Generated puzzle is not unique, retrying...");
                generateRandomNurikabe(attemptsLeft - 1);
                return;
            }

            // Success – commit to State
            State.solutionShadeMap = solutionShades;
            State.shadeMap = Array(State.size * State.size).fill(0);
            State.board = boardCopy;
            clearUndoStacks();
            saveState();
            updateStatus("Puzzle Ready!");
            switchToSolveMode();
        } catch (e) {
            console.warn("Error during generation, retrying...", e);
            generateRandomNurikabe(attemptsLeft - 1);
        }
    }, 10);
}

export function validateNurikabe(shadeMap, board, size) {
    // 0. All cells must be shaded (no 0 allowed for a complete solution)
    if (shadeMap.some(val => val === 0)) return false;

    // Helper: orthogonal neighbors
    function getNeighbors(i) {
        const r = Math.floor(i / size), c = i % size;
        const n = [];
        if (r > 0) n.push(i - size);
        if (r < size - 1) n.push(i + size);
        if (c > 0) n.push(i - 1);
        if (c < size - 1) n.push(i + 1);
        return n;
    }

    // 1. No 2x2 black squares (shadeMap[i] === 2)
    for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size - 1; c++) {
            const idx = r * size + c;
            if (shadeMap[idx] === 2 && shadeMap[idx + 1] === 2 &&
                shadeMap[idx + size] === 2 && shadeMap[idx + size + 1] === 2) {
                return false;
            }
        }
    }

    // 2. Black cells form one connected component
    const blackIndices = [];
    for (let i = 0; i < size * size; i++) {
        if (shadeMap[i] === 2) blackIndices.push(i);
    }
    if (blackIndices.length === 0) return false; // must have some black cells

    const visitedBlack = new Set();
    const queue = [blackIndices[0]];
    visitedBlack.add(blackIndices[0]);
    while (queue.length) {
        const curr = queue.shift();
        for (let n of getNeighbors(curr)) {
            if (shadeMap[n] === 2 && !visitedBlack.has(n)) {
                visitedBlack.add(n);
                queue.push(n);
            }
        }
    }
    if (visitedBlack.size !== blackIndices.length) return false;

    // 3. White islands: each must have exactly one clue and size matches clue
    const visitedWhite = new Set();
    for (let i = 0; i < size * size; i++) {
        if (shadeMap[i] === 1 && !visitedWhite.has(i)) {
            let island = [];
            let q = [i];
            visitedWhite.add(i);
            while (q.length) {
                const curr = q.shift();
                island.push(curr);
                for (let n of getNeighbors(curr)) {
                    if (shadeMap[n] === 1 && !visitedWhite.has(n)) {
                        visitedWhite.add(n);
                        q.push(n);
                    }
                }
            }
            let clueCount = 0;
            let clueValue = 0;
            for (let idx of island) {
                const val = board[idx].val;
                if (val !== 0) {
                    clueCount++;
                    clueValue = val;
                }
            }
            if (clueCount !== 1) return false;
            if (clueValue !== island.length) return false;
        }
    }
    return true;
}

function getIslands(shades, size) {
    const visited = new Set();
    const islandMap = {}; // cell -> root index
    for (let i = 0; i < size * size; i++) {
        if (shades[i] === 1 && !visited.has(i)) {
            const root = i;
            let queue = [i];
            visited.add(i);
            while (queue.length) {
                const curr = queue.shift();
                islandMap[curr] = root;
                for (let n of getNeighbors(curr, size)) {
                    if (shades[n] === 1 && !visited.has(n)) {
                        visited.add(n);
                        queue.push(n);
                    }
                }
            }
        }
    }
    return islandMap;
}

function clearUndoStacks() {
    if (State.undoStack) State.undoStack = [];
    if (State.redoStack) State.redoStack = [];
    if (window.AdvancedState) {
        window.AdvancedState.variantUndoStack = [];
        window.AdvancedState.variantRedoStack = [];
    }
}

function updateStatus(msg) {
    const label = document.getElementById('status-label');
    if (label) { label.textContent = msg; label.style.color = "var(--success)"; }
}

function switchToSolveMode() {
    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
    if (typeof window.setAppMode === 'function') window.setAppMode('solve');
    if (typeof window.updateUI === 'function') window.updateUI();
    if (typeof window !== 'undefined' && window.propagateFogReveal) {
        setTimeout(() => window.propagateFogReveal(), 50);
    }
}

function countNurikabeSolutions(board, size, maxSolutions = 2) {
    let solutions = 0;
    const total = size * size;
    const shade = new Array(total).fill(0); // 0 unknown, 1 white, 2 black

    // Clue cells are forced white
    for (let i = 0; i < total; i++) {
        if (board[i].val > 0) shade[i] = 1;
    }

    // Pre-compute neighbours for quick pruning
    const neighbours = new Array(total);
    for (let i = 0; i < total; i++) {
        neighbours[i] = getNeighbors(i, size);
    }

    function backtrack(idx) {
        if (solutions >= maxSolutions) return;
        while (idx < total && shade[idx] !== 0) idx++;
        if (idx >= total) {
            if (validateNurikabe(shade, board, size)) solutions++;
            return;
        }
        // Branch: try black then white (order can be any)
        for (let val of [2, 1]) {
            shade[idx] = val;
            // Prune only if no immediate 2x2 black appears
            if (!creates2x2(idx, shade, size)) {
                backtrack(idx + 1);
            }
            shade[idx] = 0;
        }
    }

    function creates2x2(idx, shade, size) {
        if (shade[idx] !== 2) return false;
        const r = Math.floor(idx / size), c = idx % size;
        // Check the four possible 2x2 blocks that contain this cell
        const offsets = [[0,0],[-1,0],[0,-1],[-1,-1]]; // top-left corners
        for (let [dr, dc] of offsets) {
            const tr = r + dr, tc = c + dc;
            if (tr < 0 || tr >= size-1 || tc < 0 || tc >= size-1) continue;
            const tl = tr * size + tc;
            const trIdx = tl + 1;
            const blIdx = tl + size;
            const brIdx = tl + size + 1;
            if (shade[tl] === 2 && shade[trIdx] === 2 && shade[blIdx] === 2 && shade[brIdx] === 2) {
                return true;
            }
        }
        return false;
    }

    backtrack(0);
    return solutions;
}
