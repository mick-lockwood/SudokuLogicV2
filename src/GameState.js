// src/GameState.js

export const State = {
    size: 9, bW: 3, bH: 3,
    mode: 'create', 
    pencil: false, paused: false, isWon: false, darkMode: true,
    isPlayOnly: false,
    board: [], 
    timerVal: 0, timerInt: null,
    undoStack: [], redoStack: [], selected: [],
    currentDifficulty: 'medium',
    variants: [],
    solution: [],
    showGhost: false,
    antiKnight: false,
    showOuterClues: false,
    jigsawMode: false,
    suguruMode: false,
    shiftMode: false,
    lockedMap: Array(81).fill(false),
    torusScrambleStart: null,
    
    // 0=Neutral, 1=Unshaded(Island), 2=Shaded(River)
    shadeMap: Array(81).fill(0),
    solutionShadeMap: Array(81).fill(0),

    fogMode: false,
    fogMap: Array(81).fill(false),
    fogRevealed: Array(81).fill(false),
    fogLinks: {},

    // Highlighter Color Palette 
    // (Laid out in rows of 3 to match the UI grid)
        colors: [
        // Standard Colors
        '#f59896', '#9cdcf9', '#dee787', // Row 1: Red/LightBlue/LightGreen
        '#fdc689', '#c7bbdc', '#fff799', // Row 2: Orange/Lavender/Yellow
        '#f6adcd', '#e7e7e8', '#c0e2ca', // Row 3: Pink/Grey/SageGreen
        
        'divider', // Special keyword for the UI renderer
        
        // Vibrant Colors
        '#f16865', '#64c9f6', '#c4d42a', // Row 4: Vibrant Red/LightBlue/LightGreen
        '#fca74a', '#a693c7', '#fff02f', // Row 5: Vibrant Orange/Lavender/Yellow
        '#f17fb0', '#bdbdbf', '#8cca9e'  // Row 6: Vibrant Pink/Grey/SageGreen
    ]
};

export function initBoardState(sizeParam) {
    // --- Check if we need to save the Jigsaw map before wiping! ---
    const preserveRegions = (State.jigsawMode || State.suguruMode) && State.board && State.board.length === sizeParam * sizeParam;
    const oldRegions = preserveRegions ? State.board.map(c => c.region) : [];

    State.size = sizeParam;
    State.bW = 3;
    State.bH = (sizeParam === 6) ? 2 : 3;
    State.isPlayOnly = false;
    
    State.board = Array.from({ length: State.size * State.size }, (_, i) => {
        const r = Math.floor(i / State.size);
        const c = i % State.size;
        const boxIndex = Math.floor(r / State.bH) * (State.size / State.bW) + Math.floor(c / State.bW);
        
        return { 
            val: 0, 
            given: false, 
            notes: [], 
            color: null,
            // Reapply the saved custom region, or default to standard boxes
            region: preserveRegions ? oldRegions[i] : `box-${boxIndex}` 
        };
    });
    
    State.undoStack = []; 
    State.redoStack = [];
    State.selected = []; 
    State.isWon = false; 
    State.paused = false;
    State.solution = [];
    State.showGhost = false;
    State.antiKnight = false;
    State.showOuterClues = false;
    State.lockedMap = Array(sizeParam * sizeParam).fill(false);
    State.shadeMap = Array(sizeParam * sizeParam).fill(0);
    State.shiftMode = false;
    State.solutionShadeMap = Array(sizeParam * sizeParam).fill(0);
}

export function saveState(isUndoAction = false) {
    if (!isUndoAction) State.redoStack = [];
    // Save both the board AND the shade map
    State.undoStack.push(JSON.stringify({
        board: State.board,
        shadeMap: State.shadeMap
    }));
    if (State.undoStack.length > 50) State.undoStack.shift();
}

export function undo() {
    if (State.undoStack.length === 0 || State.paused || State.isWon) return false;
    State.redoStack.push(JSON.stringify({ board: State.board, shadeMap: State.shadeMap }));
    
    const parsed = JSON.parse(State.undoStack.pop());
    if (Array.isArray(parsed)) { 
        State.board = parsed; // Fallback for old sessions
    } else {
        State.board = parsed.board;
        State.shadeMap = parsed.shadeMap;
    }
    return true; 
}

export function redo() {
    if (State.redoStack.length === 0 || State.paused || State.isWon) return false;
    State.undoStack.push(JSON.stringify({ board: State.board, shadeMap: State.shadeMap }));
    
    const parsed = JSON.parse(State.redoStack.pop());
    if (Array.isArray(parsed)) {
        State.board = parsed; 
    } else {
        State.board = parsed.board;
        State.shadeMap = parsed.shadeMap;
    }
    return true;
}
