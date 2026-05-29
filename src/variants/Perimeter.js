import { State } from '../GameState.js';

// Translates a clue ID into an array of 9 cell values in reading order
export function getLineValues(clueId) {
    const match = clueId.match(/clue-(-?\d+)-(-?\d+)/);
    if (!match) return [];
    
    const r = parseInt(match[1]);
    const c = parseInt(match[2]);
    let values = [];

    // TOP CLUE: Read down the column
    if (r === -1 && c >= 0 && c < State.size) {
        for (let i = 0; i < State.size; i++) values.push(State.board[i * State.size + c].val);
    }
    // BOTTOM CLUE: Read up the column
    else if (r === State.size && c >= 0 && c < State.size) {
        for (let i = State.size - 1; i >= 0; i--) values.push(State.board[i * State.size + c].val);
    }
    // LEFT CLUE: Read across the row
    else if (c === -1 && r >= 0 && r < State.size) {
        for (let i = 0; i < State.size; i++) values.push(State.board[r * State.size + i].val);
    }
    // RIGHT CLUE: Read left across the row
    else if (c === State.size && r >= 0 && r < State.size) {
        for (let i = State.size - 1; i >= 0; i--) values.push(State.board[r * State.size + i].val);
    }

    return values; // Returns an array like [0, 5, 0, 9, 2, 1, 0, 0, 8]
}

// --- SANDWICH RULES ---
export function checkSandwich(clueVal, lineVals) {
    const targetSum = parseInt(clueVal);
    const idx1 = lineVals.indexOf(1);
    const idx9 = lineVals.indexOf(9);

    // If either 1 or 9 is missing, we can't definitively call it an error yet
    if (idx1 === -1 || idx9 === -1) return false;

    // Find the start and end indices
    const start = Math.min(idx1, idx9);
    const end = Math.max(idx1, idx9);

    let currentSum = 0;
    let isFullyFilled = true;

    for (let i = start + 1; i < end; i++) {
        if (lineVals[i] === 0) isFullyFilled = false;
        currentSum += lineVals[i];
    }

    // Rule 1: The current sum exceeds the clue (Immediate error)
    if (currentSum > targetSum) return true;

    // Rule 2: The crusts are placed, the inside is completely filled, but the sum is wrong
    if (isFullyFilled && currentSum !== targetSum) return true;

    return false;
}

// --- SKYSCRAPER RULES ---
export function checkSkyscraper(clueVal, lineVals) {
    const targetCount = parseInt(clueVal);
    let visibleCount = 0;
    let highestSeen = 0;
    let emptyCount = 0;

    for (let val of lineVals) {
        if (val === 0) {
            emptyCount++;
            continue;
        }
        if (val > highestSeen) {
            visibleCount++;
            highestSeen = val;
        }
    }

    // Rule 1: We already see MORE buildings than the clue allows (Immediate Error)
    if (visibleCount > targetCount) return true;

    // Rule 2: The line is completely full, but the visible count doesn't perfectly match
    if (emptyCount === 0 && visibleCount !== targetCount) return true;

    return false;
}

// --- FRAMES RULES ---
export function checkFrames(clueVal, lineVals) {
    const targetSum = parseInt(clueVal);
    let currentSum = 0;
    let filledCount = 0;

    // We only look at the first 3 digits in the line of sight
    for (let i = 0; i < 3; i++) {
        if (lineVals[i] !== 0) {
            currentSum += lineVals[i];
            filledCount++;
        }
    }

    // Rule 1: The digits placed already exceed the target sum (Immediate Error)
    if (currentSum > targetSum) return true;

    // Rule 2: All 3 cells are filled, but the sum is wrong
    if (filledCount === 3 && currentSum !== targetSum) return true;

    return false;
}

// --- NUMBERED ROOMS RULES ---
export function checkNumberedRoom(clueVal, lineVals) {
    const expectedRoomValue = parseInt(clueVal);
    
    // The first cell dictates the "room index"
    const firstCell = lineVals[0];

    // If the first cell is empty, we don't know which room to check yet
    if (firstCell === 0) return false;

    // Sudoku logic is 1-indexed (1st room, 2nd room), but arrays are 0-indexed!
    // So if the first cell is a 3, we want lineVals[2].
    const targetCell = lineVals[firstCell - 1];

    // If the target room is empty, we can't evaluate it yet
    if (targetCell === 0) return false;

    // Rule: The room is identified AND filled, but it doesn't match the clue!
    if (targetCell !== expectedRoomValue) return true;

    return false;
}
