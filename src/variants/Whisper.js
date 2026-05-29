// src/variants/Whisper.js
import { getCellCenter } from '../Renderer.js';
import { State } from '../GameState.js'; // NEW: Need this to check size

export function whisperConflict(variant, arr, idx, val, isFlatArray = false) {
    const pos = variant.cells.indexOf(idx);
    if (pos === -1) return false;

    // NEW: Dynamic requirement based on grid size
    // 6x6 uses 3, everything else (9x9) uses 5
    const diffRequirement = (State.size === 6) ? 3 : 5;

    if (pos > 0) {
        const prevCell = variant.cells[pos - 1];
        const prevVal = isFlatArray ? arr[prevCell] : arr[prevCell].val;
        if (prevVal !== 0 && Math.abs(val - prevVal) < diffRequirement) return true;
    }
    
    if (pos < variant.cells.length - 1) {
        const nextCell = variant.cells[pos + 1];
        const nextVal = isFlatArray ? arr[nextCell] : arr[nextCell].val;
        if (nextVal !== 0 && Math.abs(val - nextVal) < diffRequirement) return true;
    }
    return false;
}

export function drawWhisper(variant, svgElement) {
    const cellIndices = variant.cells;
    if (cellIndices.length < 2) return;

    const whisperColor = "rgba(46, 204, 113, 0.6)"; 
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    
    const startCenter = getCellCenter(cellIndices[0]);
    let d = `M ${startCenter.x} ${startCenter.y} `;
    
    for (let i = 1; i < cellIndices.length; i++) {
        const pt = getCellCenter(cellIndices[i]);
        d += `L ${pt.x} ${pt.y} `;
    }
    
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", whisperColor);
    path.setAttribute("stroke-width", "8"); 
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svgElement.appendChild(path);
}
