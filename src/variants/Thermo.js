// src/variants/Thermo.js
import { State } from '../GameState.js';
import { getCellCenter } from '../Renderer.js';

export function thermoConflict(variant, arr, idx, val, isFlatArray = false) {
    const pos = variant.cells.indexOf(idx);
    if (pos === -1) return false;

    // A. Implicit Bounds Checking
    const minAllowed = pos + 1;
    const maxAllowed = State.size - (variant.cells.length - 1 - pos);
    if (val < minAllowed || val > maxAllowed) return true;

    // B. Sequential Checks
    if (pos > 0) {
        const prevCell = variant.cells[pos - 1];
        const prevVal = isFlatArray ? arr[prevCell] : arr[prevCell].val;
        if (prevVal !== 0 && val <= prevVal) return true;
    }
    if (pos < variant.cells.length - 1) {
        const nextCell = variant.cells[pos + 1];
        const nextVal = isFlatArray ? arr[nextCell] : arr[nextCell].val;
        if (nextVal !== 0 && val >= nextVal) return true;
    }
    return false;
}

export function drawThermo(variant, svgElement) {
    const cellIndices = variant.cells;
    if (cellIndices.length === 0) return;

    const startCenter = getCellCenter(cellIndices[0]);
    const thermoColor = "rgba(160, 174, 192, 0.6)"; 

    const bulb = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bulb.setAttribute("cx", startCenter.x);
    bulb.setAttribute("cy", startCenter.y);
    bulb.setAttribute("r", "18");
    bulb.setAttribute("fill", thermoColor);
    svgElement.appendChild(bulb);

    if (cellIndices.length > 1) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let d = `M ${startCenter.x} ${startCenter.y} `;
        
        for (let i = 1; i < cellIndices.length; i++) {
            const pt = getCellCenter(cellIndices[i]);
            d += `L ${pt.x} ${pt.y} `;
        }
        
        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", thermoColor);
        path.setAttribute("stroke-width", "14");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svgElement.appendChild(path);
    }
}
