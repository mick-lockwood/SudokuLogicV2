// src/ShiftEngine.js
import { State, saveState } from './GameState.js';
import { hasConflict } from './SudokuLogic.js';

window.AdvancedState = window.AdvancedState || {};

// --- 1. ARRAY SHIFTING MATH ---
export const shiftRow = (r, dir, silent = false) => {
    if (State.paused || State.isWon) return false;
    
    for (let c = 0; c < State.size; c++) {
        if (State.lockedMap[r * State.size + c]) return false; // Abort if locked
    }

    if (!silent) saveState();
    let rowVals = [], rowGiven = [], rowNotes = [], rowColor = [];
    
    for (let c = 0; c < State.size; c++) {
        let idx = r * State.size + c;
        rowVals.push(State.board[idx].val);
        rowGiven.push(State.board[idx].given);
        rowNotes.push(State.board[idx].notes);
        rowColor.push(State.board[idx].color);
    }
    
    if (dir === 1) { 
        rowVals.unshift(rowVals.pop()); rowGiven.unshift(rowGiven.pop());
        rowNotes.unshift(rowNotes.pop()); rowColor.unshift(rowColor.pop());
    } else { 
        rowVals.push(rowVals.shift()); rowGiven.push(rowGiven.shift());
        rowNotes.push(rowNotes.shift()); rowColor.push(rowColor.shift());
    }
    
    for (let c = 0; c < State.size; c++) {
        let idx = r * State.size + c;
        State.board[idx].val = rowVals[c];
        State.board[idx].given = rowGiven[c];
        State.board[idx].notes = rowNotes[c];
        State.board[idx].color = rowColor[c];
    }
    
    // Only update the UI and check win if this is a real player move
    if (!silent) {
        if (typeof window.updateUI === 'function') window.updateUI();
        if (typeof window.checkAdvancedWin === 'function') window.checkAdvancedWin();
    }
    return true; 
};

export const shiftCol = (c, dir, silent = false) => {
    if (State.paused || State.isWon) return false;
    
    for (let r = 0; r < State.size; r++) {
        if (State.lockedMap[r * State.size + c]) return false; 
    }

    if (!silent) saveState();
    let colVals = [], colGiven = [], colNotes = [], colColor = [];
    
    for (let r = 0; r < State.size; r++) {
        let idx = r * State.size + c;
        colVals.push(State.board[idx].val);
        colGiven.push(State.board[idx].given);
        colNotes.push(State.board[idx].notes);
        colColor.push(State.board[idx].color);
    }
    
    if (dir === 1) { 
        colVals.unshift(colVals.pop()); colGiven.unshift(colGiven.pop());
        colNotes.unshift(colNotes.pop()); colColor.unshift(colColor.pop());
    } else { 
        colVals.push(colVals.shift()); colGiven.push(colGiven.shift());
        colNotes.push(colNotes.shift()); colColor.push(colColor.shift());
    }
    
    for (let r = 0; r < State.size; r++) {
        let idx = r * State.size + c;
        State.board[idx].val = colVals[r];
        State.board[idx].given = colGiven[r];
        State.board[idx].notes = colNotes[r];
        State.board[idx].color = colColor[r];
    }
    
    if (!silent) {
        if (typeof window.updateUI === 'function') window.updateUI();
        if (typeof window.checkAdvancedWin === 'function') window.checkAdvancedWin();
    }
    return true;
};

// --- 2. THE TORUS SCRAMBLER ---
window.generateTorusPuzzle = () => {
    const diffEl = document.getElementById('diff');
    const diff = diffEl ? diffEl.value : 'medium';
    
    // 1. Clear the board completely
    State.board.forEach(c => { c.val = 0; c.given = true; c.notes = []; c.color = null; });
    
    // 2. Backtracking Solver (Instantly builds a 100% valid, full grid)
    const solve = (idx) => {
        if (idx >= State.size * State.size) return true;
        if (State.board[idx].val !== 0) return solve(idx + 1);
        
        // Randomize digits to ensure unique puzzles every time
        let digits = [];
        for (let i = 1; i <= State.size; i++) digits.push(i);
        digits.sort(() => Math.random() - 0.5);
        
        for (let d of digits) {
            if (!hasConflict(State.board, idx, d)) {
                State.board[idx].val = d;
                if (solve(idx + 1)) return true;
            }
        }
        State.board[idx].val = 0;
        return false;
    };
    
    solve(0);
    
    // 3. Lock them as 'givens' so the player can't delete them, only shift them
    State.board.forEach(c => c.given = true);
    
    // 4. Scramble based on difficulty dropdown
    let targetShifts = 20; // easy
    if (diff === 'medium') targetShifts = 45;
    if (diff === 'hard') targetShifts = 100;
    
    let successfulShifts = 0;
    let attempts = 0; // Failsafe against infinite loops
    
    // Invisibly fire the shift commands
    while (successfulShifts < targetShifts && attempts < 1000) {
        attempts++;
        const isRow = Math.random() > 0.5;
        const index = Math.floor(Math.random() * State.size);
        const dir = Math.random() > 0.5 ? 1 : -1;
        
        let success = false;
        // Notice the 'true' parameter! This tells the engine to shift silently.
        if (isRow) success = shiftRow(index, dir, true);
        else success = shiftCol(index, dir, true);
        
        if (success) successfulShifts++;
    }

    // --- SNAPSHOT THE STARTING STATE ---
    State.torusScrambleStart = JSON.stringify(State.board);
    // --------------------------------------------
    
    State.isWon = false;
    State.undoStack = []; 
    State.redoStack = [];
    
    // 5. Un-mute the UI and render the scrambled masterpiece!
    if (typeof window.updateUI === 'function') window.updateUI();
    if (typeof window.triggerAutosave === 'function') window.triggerAutosave();
};
