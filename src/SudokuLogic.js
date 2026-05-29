// src/SudokuLogic.js
import { State } from './GameState.js';
import { thermoConflict } from './variants/Thermo.js';
import { whisperConflict } from './variants/Whisper.js';
import { killerConflict } from './variants/Killer.js';
import { kropkiConflict } from './variants/Kropki.js';

export let genSafetyCounter = 0;
export function resetGenSafety() { genSafetyCounter = 0; }

export function hasConflict(arr, idx, val) {
    if (val === 0) return false;
    const r = Math.floor(idx / State.size), c = idx % State.size;
    // Safely pull the dynamic region, or fallback to prevent crashes
    const myRegion = arr[idx] && arr[idx].region ? arr[idx].region : "fallback";

   // --- SUGURU RULES ---
    if (State.suguruMode) {
        // Find the maximum allowed number for this specific region
        const regSize = State.board.filter(cell => cell && cell.region === myRegion).length;
        if (val > regSize) return true; // Cannot place a 5 in a 4-cell region!

        for (let i = 0; i < State.size * State.size; i++) {
            if (i === idx || !arr[i] || arr[i].val !== val) continue;
            
            // Rule 1: No duplicates in the same region
            if (arr[i].region === myRegion) return true;
            
            // Rule 2: The Adjacency Touch Rule (No same numbers touching anywhere!)
            const tr = Math.floor(i / State.size), tc = i % State.size;
            if (Math.abs(tr - r) <= 1 && Math.abs(tc - c) <= 1) return true;
        }
    } 
        
    // --- CLASSIC / JIGSAW RULES ---
    else {
        for (let i = 0; i < State.size * State.size; i++) {
            if (i === idx || !arr[i] || arr[i].val !== val) continue;
            const tr = Math.floor(i / State.size), tc = i % State.size;
            if (tr === r || tc === c || arr[i].region === myRegion) return true;
        }
    }
    
    // --- Global Anti-Knight Rule ---
    if (State.antiKnight) {
        const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (let [dr, dc] of knightMoves) {
            const kr = r + dr, kc = c + dc;
            if (kr >= 0 && kr < State.size && kc >= 0 && kc < State.size) {
                const kIdx = kr * State.size + kc;
                if (kIdx !== idx && arr[kIdx].val === val) return true;
            }
        }
    }

    // --- Global Anti-King Rule ---
    if (State.antiKing) {
        const kingMoves = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (let [dr, dc] of kingMoves) {
            const kr = r + dr, kc = c + dc;
            if (kr >= 0 && kr < State.size && kc >= 0 && kc < State.size) {
                const kIdx = kr * State.size + kc;
                if (kIdx !== idx && arr[kIdx].val === val) return true;
            }
        }
    }
    
    // 2. Variant Rules Loop
    if (State.variants && State.variants.length > 0) {
        for (let v of State.variants) {
            if (v.type === 'thermo' && thermoConflict(v, arr, idx, val, false)) return true;
            if (v.type === 'whisper' && whisperConflict(v, arr, idx, val, false)) return true;
            if (v.type === 'killer' && killerConflict(v, arr, idx, val, false)) return true;
            if (v.type.startsWith('kropki') && kropkiConflict(v, arr, idx, val, false)) return true;
        }
    }
    return false;
}

export function hasConflictGen(arr, idx, val) {
    genSafetyCounter++;
    if ((State.jigsawMode || State.suguruMode) && genSafetyCounter > 250000) {
        throw new Error("JIGSAW_TIMEOUT");
    }

    const r = Math.floor(idx / State.size), c = idx % State.size;
    const myRegion = State.board[idx] ? State.board[idx].region : "fallback";

    // --- SUGURU RULES ---
    if (State.suguruMode) {
        const regSize = State.board.filter(cell => cell && cell.region === myRegion).length;
        if (val > regSize) return true; 

        for (let i = 0; i < State.size * State.size; i++) {
            if (i === idx || arr[i] !== val) continue;
            if (State.board[i] && State.board[i].region === myRegion) return true;
            
            const tr = Math.floor(i / State.size), tc = i % State.size;
            if (Math.abs(tr - r) <= 1 && Math.abs(tc - c) <= 1) return true;
        }
    } 
    // --- CLASSIC / JIGSAW RULES ---
    else {
        for (let i = 0; i < State.size * State.size; i++) {
            if (i === idx || arr[i] !== val) continue;
            const tr = Math.floor(i / State.size), tc = i % State.size;
            if (tr === r || tc === c || (State.board[i] && State.board[i].region === myRegion)) return true;
        }
    }

    // --- Global Anti-Knight Rule (Generator Version) ---
    if (State.antiKnight) {
        const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (let [dr, dc] of knightMoves) {
            const kr = r + dr, kc = c + dc;
            if (kr >= 0 && kr < State.size && kc >= 0 && kc < State.size) {
                if (arr[kr * State.size + kc] === val) return true;
            }
        }
    }

    // --- Global Anti-King Rule (Generator Version) ---
    if (State.antiKing) {
        const kingMoves = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (let [dr, dc] of kingMoves) {
            const kr = r + dr, kc = c + dc;
            if (kr >= 0 && kr < State.size && kc >= 0 && kc < State.size) {
                if (arr[kr * State.size + kc] === val) return true;
            }
        }
    }

    // 2. Variant Rules Loop
    if (State.variants && State.variants.length > 0) {
        for (let v of State.variants) {
            if (v.type === 'thermo' && thermoConflict(v, arr, idx, val, true)) return true;
            if (v.type === 'whisper' && whisperConflict(v, arr, idx, val, true)) return true;
            if (v.type === 'killer' && killerConflict(v, arr, idx, val, true)) return true;
            if (v.type.startsWith('kropki') && kropkiConflict(v, arr, idx, val, true)) return true;
        }
    }
    return false;
}

export function getCount(num) { 
    return State.board.filter((c, i) => c.val === num && !hasConflict(State.board, i, num)).length; 
}

export function cleanPencilsAfterMove(idx, val) {
    const r = Math.floor(idx / State.size), c = idx % State.size;
    const myRegion = State.board[idx] ? State.board[idx].region : "fallback";

    State.board.forEach((cell, i) => {
        const tr = Math.floor(i / State.size), tc = i % State.size;
        let shouldClean = false;
        
        if (State.suguruMode) {
            // Clean from same region and ALL 8 touching cells
            if (cell.region === myRegion || (Math.abs(tr - r) <= 1 && Math.abs(tc - c) <= 1)) shouldClean = true;
        } else {
            // Classic cleaning
            if (tr === r || tc === c || cell.region === myRegion) shouldClean = true;
        }

        if (shouldClean) {
            const noteIdx = cell.notes.indexOf(val);
            if (noteIdx > -1) cell.notes.splice(noteIdx, 1);
        }
    });
}

let solveIterations = 0;

export function countSolutions(boardArray, count = 0, isFirstCall = true) {
    // Reset the fail-safe counter on the first click
    if (isFirstCall) solveIterations = 0;
    solveIterations++;

    // FAIL-SAFE: Abort to prevent main thread freezing
    if (solveIterations > 20000) return -1; 

    let pos = boardArray.indexOf(0);
    if (pos === -1) return count + 1;

    for (let n = 1; n <= State.size; n++) { 
        if (!hasConflictGen(boardArray, pos, n)) {
            boardArray[pos] = n;
            count = countSolutions(boardArray, count, false);
            boardArray[pos] = 0;
            
            if (count > 1 || count === -1) return count; 
        }
    }
    return count;
}
