// src/VariantOverlay.js
import { State, saveState } from './GameState.js';

let isPainting = false;
let paintTargetState = 0;

document.addEventListener('pointerup', () => { isPainting = false; });

export const renderVariantOverlay = () => {
    const container = document.getElementById('variant-overlay');
    if (!container) return;

    const isNurikabePuzzle = State.solutionShadeMap && State.solutionShadeMap.some(v => v !== 0);
    const isToolActive = (window.AdvancedState && window.AdvancedState.activeTool === 'nurikabe') || (State.mode === 'solve' && isNurikabePuzzle);
    const hasShading = State.shadeMap && State.shadeMap.some(v => v !== 0);

    // If the tool is off and the board is blank, wipe the overlay completely.
    if (!isToolActive && !hasShading && !isNurikabePuzzle) {
        container.innerHTML = '';
        container.style.pointerEvents = 'none';
        return;
    }

    // CRITICAL: This is what allows clicks to pass through to the Sudoku grid
    // when you have the "Number Input" tool selected!
    container.style.pointerEvents = isToolActive ? 'auto' : 'none';
    
    container.innerHTML = '';
    container.style.gap = '0px';
    container.style.justifyContent = 'center';
    container.style.alignContent = 'start'; 
    container.style.paddingTop = '5px'; 

    const show = State.showOuterClues;
    const start = show ? -1 : 0;
    const end = show ? State.size : State.size - 1;
    
    container.style.gridTemplateColumns = `repeat(${show ? State.size + 2 : State.size}, var(--cell-size))`;
    container.style.gridTemplateRows = `repeat(${show ? State.size + 2 : State.size}, var(--cell-size))`;

    for (let r = start; r <= end; r++) {
        for (let c = start; c <= end; c++) {
            const isOuter = (r === -1 || r === State.size || c === -1 || c === State.size);
            
            if (isOuter) {
                const spacer = document.createElement('div');
                spacer.style.width = '100%'; spacer.style.height = '100%'; spacer.style.pointerEvents = 'none';
                container.appendChild(spacer);
            } else {
                const i = r * State.size + c;
                const tile = document.createElement('div');
                const hasClue = State.board[i] && State.board[i].val !== 0;
                
                tile.className = 'variant-overlay-tile';
                // CRITICAL: Tile must also drop its pointer-events if tool is inactive
                tile.style.pointerEvents = isToolActive ? 'auto' : 'none';
                
                // Hide the white dot if a digit is sitting on top of it
                if (State.shadeMap[i] === 1 && !hasClue) tile.classList.add('shaded-white');
                if (State.shadeMap[i] === 2) tile.classList.add('shaded-black');
                
                if (isToolActive) {
                    tile.addEventListener('contextmenu', e => e.preventDefault());

                    tile.addEventListener('pointerdown', (e) => {
                        e.preventDefault();
                        e.stopPropagation(); 
                        e.target.releasePointerCapture(e.pointerId);
                        saveState(); 

                        const mode = window.AdvancedState.nurikabePaintMode || 'cycle';
                        const current = State.shadeMap[i];
                        const isRightClick = e.button === 2;

                        if (mode === 'cycle') paintTargetState = current === 0 ? 2 : (current === 2 ? 1 : 0);
                        else if (mode === 'black') paintTargetState = isRightClick ? (current === 1 ? 0 : 1) : (current === 2 ? 0 : 2);
                        else if (mode === 'dot') paintTargetState = isRightClick ? (current === 2 ? 0 : 2) : (current === 1 ? 0 : 1);
                        else if (mode === 'erase') paintTargetState = 0;

                        State.shadeMap[i] = paintTargetState;
                        isPainting = true;
                        renderVariantOverlay();
                        if (typeof window.checkAdvancedWin === 'function') window.checkAdvancedWin();
                    });

                    tile.addEventListener('pointerenter', () => {
                        if (!isPainting) return;
                        if (State.shadeMap[i] !== paintTargetState) {
                            State.shadeMap[i] = paintTargetState;
                            renderVariantOverlay();
                            if (typeof window.checkAdvancedWin === 'function') window.checkAdvancedWin();
                        }
                    });
                }
                container.appendChild(tile);
            }
        }
    }
};
