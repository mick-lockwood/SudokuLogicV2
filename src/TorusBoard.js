// src/TorusBoard.js
import { State } from './GameState.js';
import { shiftRow, shiftCol } from './ShiftEngine.js';
import { hasConflict } from './SudokuLogic.js';

window.TorusState = {
    dragActive: false,
    startX: 0, startY: 0,
    axis: null,
    index: null,
    elements: [],
    ghosts: [],
    cellSize: 52
};

export const renderTorusBoard = () => {
    const container = document.getElementById('torus-grid');
    if (!container || !State.shiftMode) return;

    // Use getBoundingClientRect for precise swipe-physics thresholding
    const sampleCell = document.querySelector('.cell');
    window.TorusState.cellSize = sampleCell ? sampleCell.getBoundingClientRect().width : 52;
    const cs = window.TorusState.cellSize;

    const showErrors = document.getElementById('toggle-errors')?.checked ?? true;

    container.innerHTML = '';
    
    // --- THE CSS GRID SUBPIXEL FIX ---
    // Instead of absolutely positioning tiles with math, we turn the wrapper
    // into a CSS grid perfectly mirroring the classic grid! The browser will
    // automatically handle subpixel anti-aliasing flawlessly.
    container.style.display = 'grid';
    container.style.gap = '0px';
    container.style.justifyContent = 'center';
    container.style.alignContent = 'start'; 
    container.style.paddingTop = '5px'; // Matches #grid-wrapper's vertical padding
    
    const show = State.showOuterClues;
    container.style.gridTemplateColumns = `repeat(${show ? State.size + 2 : State.size}, var(--cell-size))`;
    container.style.gridTemplateRows = `repeat(${show ? State.size + 2 : State.size}, var(--cell-size))`;

    const thinGridLine = State.darkMode ? "#475569" : "#1e293b"; 
    const thickGridLine = State.darkMode ? "#ffffff" : "#1e293b";

    const start = show ? -1 : 0;
    const end = show ? State.size : State.size - 1;

    for (let r = start; r <= end; r++) {
        for (let c = start; c <= end; c++) {
            const isOuter = (r === -1 || r === State.size || c === -1 || c === State.size);
            
            if (isOuter) {
                // Render invisible grid-spacers to match the perimeter cells
                const spacer = document.createElement('div');
                spacer.style.width = '100%';
                spacer.style.height = '100%';
                spacer.style.pointerEvents = 'none';
                container.appendChild(spacer);
            } else {
                const i = r * State.size + c;
                const cellData = State.board[i];

                // 1. Create the element ONCE
                const tile = document.createElement('div');
                // 1. ADD 'cell' CLASS: Inherits dark/light mode seamlessly from style.css
                tile.className = 'torus-tile cell';
                tile.id = `torus-tile-${i}`;

                tile.addEventListener('pointerover', () => {
                    const r = Math.floor(i / State.size);
                    const c = i % State.size;
                    for (let n = 0; n < State.size; n++) {
                        document.getElementById(`torus-tile-${r * State.size + n}`)?.classList.add('row-hover');
                        document.getElementById(`torus-tile-${n * State.size + c}`)?.classList.add('row-hover');
                    }
                });
                tile.addEventListener('pointerout', () => {
                    document.querySelectorAll('.torus-tile').forEach(t => t.classList.remove('row-hover'));
                });
                
                tile.style.position = 'relative';
                tile.style.width = '100%';
                tile.style.height = '100%';
                tile.style.top = '0';
                tile.style.left = '0';

                // --- DYNAMIC CSS GRID BORDERS ---
                tile.style.borderRight = `1px solid ${thinGridLine}`; 
                tile.style.borderBottom = `1px solid ${thinGridLine}`; 
                tile.style.borderTop = 'none';
                tile.style.borderLeft = 'none';
                
                const currentRegion = State.board[i].region;

                if (r === 0) tile.style.borderTop = `3px solid ${thickGridLine}`;
                if (c === 0) tile.style.borderLeft = `3px solid ${thickGridLine}`;
                
                if (c < State.size - 1) {
                    const rightNeighborRegion = State.board[i + 1].region;
                    if (currentRegion !== rightNeighborRegion) tile.style.borderRight = `3px solid ${thickGridLine}`; 
                } else {
                    tile.style.borderRight = `3px solid ${thickGridLine}`; 
                }

                if (r < State.size - 1) {
                    const bottomNeighborRegion = State.board[i + State.size].region;
                    if (currentRegion !== bottomNeighborRegion) tile.style.borderBottom = `3px solid ${thickGridLine}`; 
                } else {
                    tile.style.borderBottom = `3px solid ${thickGridLine}`; 
                }

                // 2. STATE & CONTENT
                if (cellData.given) tile.classList.add('given');
                else if (cellData.val !== 0) tile.classList.add('user');

                if (cellData.val !== 0) {
                    tile.innerText = cellData.val;
                    if (showErrors && hasConflict(State.board, i, cellData.val)) {
                        tile.classList.add('error');
                    }
                }

                // 3. REMOVE MANUAL BACKGROUNDS: Only apply if a custom highlight exists!
                if (cellData.color) {
                    tile.style.backgroundColor = cellData.color;
                } else {
                    tile.style.backgroundColor = ''; 
                }
                
                if (State.lockedMap && State.lockedMap[i]) {
                    tile.style.boxShadow = `inset 0 0 0 3px rgba(255, 255, 255, 0.4), inset 0 0 10px rgba(0,0,0,0.5)`;
                    tile.innerHTML += `<div style="position: absolute; top: 2px; right: 4px; font-size: 10px; opacity: 0.5; pointer-events: none;">🔒</div>`;
                }

                // 6. Listeners
                tile.addEventListener('pointerdown', (e) => {
                    if (State.paused || State.isWon) return;
                    e.target.releasePointerCapture(e.pointerId); 
                    window.handleCellSelection(i, e.ctrlKey || e.metaKey, false);
                });

                // 7. Append once
                container.appendChild(tile);
            }
        }
    }
};

// --- GESTURE PHYSICS & GHOST TILES ---

const getDragElements = (axis, index) => {
    const els = [];
    for (let i = 0; i < State.size; i++) {
        const idx = axis === 'row' ? (index * State.size + i) : (i * State.size + index);
        els.push(document.getElementById(`torus-tile-${idx}`));
    }
    return els;
};

const createGhost = (originalEl, axis, direction, cs) => {
    const ghost = originalEl.cloneNode(true);
    ghost.id = ''; 
    ghost.style.zIndex = '15'; 
    
    // CRITICAL: Ghosts must be absolute to animate over the grid edges
    ghost.style.position = 'absolute';
    ghost.style.width = `${originalEl.offsetWidth}px`;
    ghost.style.height = `${originalEl.offsetHeight}px`;
    
    // Anchor them precisely to the rendered tracking positions
    const currentLeft = originalEl.offsetLeft;
    const currentTop = originalEl.offsetTop;
    
    // Force the ghost to jump by exact rendered width/height arrays
    const jumpSize = originalEl.offsetWidth * State.size;
    
    if (axis === 'row') {
        ghost.style.left = direction === 1 ? `${currentLeft - jumpSize}px` : `${currentLeft + jumpSize}px`;
        ghost.style.top = `${currentTop}px`;
    } else {
        ghost.style.top = direction === 1 ? `${currentTop - jumpSize}px` : `${currentTop + jumpSize}px`;
        ghost.style.left = `${currentLeft}px`;
    }
    
    document.getElementById('torus-grid').appendChild(ghost);
    return ghost;
};

document.addEventListener('pointerdown', (e) => {
    if (!State.shiftMode || State.paused || State.isWon) return;
    if (State.mode === 'create') return;
    
    const target = e.target.closest('.torus-tile');
    if (!target) return;

    const idx = parseInt(target.id.replace('torus-tile-', ''));
    if (isNaN(idx)) return;

    window.TorusState = {
        dragActive: true,
        startX: e.clientX, startY: e.clientY,
        axis: null, index: idx,
        r: Math.floor(idx / State.size), c: idx % State.size,
        elements: [], ghosts: [],
        cellSize: window.TorusState.cellSize
    };
}, { passive: true });

document.addEventListener('pointermove', (e) => {
    const drag = window.TorusState;
    if (!drag.dragActive) return;

    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;

    if (!drag.axis) {
        if (Math.abs(deltaX) > 10) {
            drag.axis = 'row'; drag.elements = getDragElements('row', drag.r);
        } else if (Math.abs(deltaY) > 10) {
            drag.axis = 'col'; drag.elements = getDragElements('col', drag.c);
        } else return; 

        let isLocked = false;
        for (let i = 0; i < State.size; i++) {
            if (drag.axis === 'row' && State.lockedMap[drag.r * State.size + i]) isLocked = true;
            if (drag.axis === 'col' && State.lockedMap[i * State.size + drag.c]) isLocked = true;
        }
        if (isLocked) { drag.dragActive = false; return; }

        drag.elements.forEach(el => el.style.zIndex = '20');
    }

    const cs = drag.cellSize;
    const threshold = cs; 

    if (drag.ghosts.length === 0) {
        const dir = (drag.axis === 'row' ? deltaX : deltaY) > 0 ? 1 : -1;
        drag.elements.forEach(el => drag.ghosts.push(createGhost(el, drag.axis, dir, cs)));
    }

    if (drag.axis === 'row') {
        drag.elements.forEach(el => el.style.transform = `translateX(${deltaX}px)`);
        drag.ghosts.forEach(el => el.style.transform = `translateX(${deltaX}px)`);

        if (Math.abs(deltaX) >= threshold) {
            const dir = deltaX > 0 ? 1 : -1;
            
            drag.elements.forEach(el => { el.style.transform = 'translate(0, 0)'; el.style.zIndex = ''; });
            drag.ghosts.forEach(ghost => ghost.remove());
            drag.ghosts = [];

            shiftRow(drag.r, dir); 
            
            drag.startX += (dir * threshold); 
            drag.elements = getDragElements('row', drag.r); 
            drag.elements.forEach(el => { el.style.zIndex = '20'; el.style.transform = `translateX(${e.clientX - drag.startX}px)`; });
        }
    } else {
        drag.elements.forEach(el => el.style.transform = `translateY(${deltaY}px)`);
        drag.ghosts.forEach(el => el.style.transform = `translateY(${deltaY}px)`);

        if (Math.abs(deltaY) >= threshold) {
            const dir = deltaY > 0 ? 1 : -1;
            
            drag.elements.forEach(el => { el.style.transform = 'translate(0, 0)'; el.style.zIndex = ''; });
            drag.ghosts.forEach(ghost => ghost.remove());
            drag.ghosts = [];

            shiftCol(drag.c, dir);
            
            drag.startY += (dir * threshold);
            drag.elements = getDragElements('col', drag.c);
            drag.elements.forEach(el => { el.style.zIndex = '20'; el.style.transform = `translateY(${e.clientY - drag.startY}px)`; });
        }
    }
}, { passive: true });

const endDrag = () => {
    const drag = window.TorusState;
    if (drag.dragActive && drag.elements) {
        drag.elements.forEach(el => {
            el.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
            el.style.transform = 'translate(0px, 0px)';
            setTimeout(() => { el.style.transition = ''; el.style.zIndex = ''; }, 150);
        });
        drag.ghosts.forEach(ghost => {
            ghost.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
            ghost.style.transform = 'translate(0px, 0px)';
            setTimeout(() => ghost.remove(), 150);
        });
    }
    drag.dragActive = false;
    drag.ghosts = [];
};

document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
