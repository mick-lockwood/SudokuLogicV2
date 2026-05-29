// src/variants/Killer.js
import { State } from '../GameState.js';
import { getCellData } from '../Renderer.js';

export function killerConflict(variant, arr, idx, val, isFlatArray = false) {
    if (!variant.cells.includes(idx)) return false;

    let currentSum = 0;
    let filledCount = 0;
    let hasDuplicate = false;
    let seen = new Set();

    for (let cellIdx of variant.cells) {
        let cellVal = 0;
        
        // If this is the cell we are currently testing, use the injected test value
        if (cellIdx === idx) {
            cellVal = val;
        } else {
            cellVal = isFlatArray ? arr[cellIdx] : arr[cellIdx].val;
        }

        if (cellVal !== 0) {
            currentSum += cellVal;
            filledCount++;
            if (seen.has(cellVal)) hasDuplicate = true;
            seen.add(cellVal);
        }
    }

    // Rule 1: No repeating digits inside a cage
    if (hasDuplicate) return true;

    // Rule 2: The sum of digits cannot exceed the target sum
    if (currentSum > variant.sum) return true;

    // Rule 3: If the cage is completely filled, the sum MUST exactly equal the target
    if (filledCount === variant.cells.length && currentSum !== variant.sum) return true;

    return false;
}

export function drawKiller(variant, svgElement) {
    if (!variant.cells || variant.cells.length === 0) return;

    const svgRect = svgElement.getBoundingClientRect();
    const inset = 3; 

    // --- 1. MATH: VALIDATE MIN/MAX SUM EARLY ---
    let isInvalidSum = false;
    const numCells = variant.cells.length;

    // Only run validation if a sum was actually entered
    if (variant.sum) {
        if (numCells > 9) {
            isInvalidSum = true; 
        } else {
            let minSum = 0;
            let maxSum = 0;
            for (let i = 1; i <= numCells; i++) minSum += i;
            for (let i = 1; i <= numCells; i++) maxSum += (10 - i);
            if (variant.sum < minSum || variant.sum > maxSum) {
                isInvalidSum = true;
            }
        }
    }

    // --- 2. DYNAMIC COLOR THEMES ---
    const dangerColor = State.darkMode ? "#fb923c" : "#e74c3c";
    
    // If invalid, force the lines to be red! Otherwise, use the standard theme colors.
    const lineStroke = isInvalidSum ? dangerColor : (State.darkMode ? "#e2e8f0" : "#334155");
    const textFill = State.darkMode ? "#f8fafc" : "#0f172a";
    const circleFill = State.darkMode ? "#1e293b" : "#ffffff"; 
    
    // The text turns red if invalid, otherwise matches the theme
    const finalTextColor = isInvalidSum ? dangerColor : textFill;

    // --- 3. PARSE ALL CELLS FIRST ---
    // Translate the chaotic mix of strings/numbers into pure (r, c) objects
    const parsedCells = variant.cells.map(idx => getCellData(idx));

    // --- 4. Draw the dashed perimeter ---
    parsedCells.forEach(cellData => {
        const el = document.getElementById(cellData.id);
        if (!el) return;
        
        const cellRect = el.getBoundingClientRect();
        const x = cellRect.left - svgRect.left;
        const y = cellRect.top - svgRect.top;
        const w = cellRect.width;
        const h = cellRect.height;

        const r = cellData.r;
        const c = cellData.c;

        // SMART NEIGHBOR CHECKING
        const hasTop = parsedCells.some(p => p.r === r - 1 && p.c === c);
        const hasBottom = parsedCells.some(p => p.r === r + 1 && p.c === c);
        const hasLeft = parsedCells.some(p => p.r === r && p.c === c - 1);
        const hasRight = parsedCells.some(p => p.r === r && p.c === c + 1);

        const drawLine = (x1, y1, x2, y2) => {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x1); line.setAttribute("y1", y1);
            line.setAttribute("x2", x2); line.setAttribute("y2", y2);
            line.setAttribute("stroke", lineStroke); // This will now be red if invalid!
            line.setAttribute("stroke-width", "1.5");     
            line.setAttribute("stroke-dasharray", "3 3"); 
            svgElement.appendChild(line);
        };

        const rightEdge = w - inset - 1;
        const bottomEdge = h - inset - 1;

        if (!hasTop) drawLine(x + inset, y + inset, x + rightEdge, y + inset);
        if (!hasBottom) drawLine(x + inset, y + bottomEdge, x + rightEdge, y + bottomEdge);
        if (!hasLeft) drawLine(x + inset, y + inset, x + inset, y + bottomEdge);
        if (!hasRight) drawLine(x + rightEdge, y + inset, x + rightEdge, y + bottomEdge);
    });

    // --- 5. Draw the Sum Circle & Text ---
    // Sort by Row (r) first, then Column (c) to guarantee the absolute top-left cell
    const sortedCells = [...parsedCells].sort((a, b) => {
        if (a.r !== b.r) return a.r - b.r;
        return a.c - b.c;
    });
    
    const topLeftData = sortedCells[0];
    const el = document.getElementById(topLeftData.id);

    if (el && variant.sum) {
        const cellRect = el.getBoundingClientRect();
        const x = cellRect.left - svgRect.left;
        const y = cellRect.top - svgRect.top;
        
        const fontSize = Math.max(7, cellRect.width * 0.18); 
        
        const centerX = (x + (fontSize * 0.9) - 3);
        const centerY = (y + (fontSize * 0.9) - 3);
        
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", centerX);
        circle.setAttribute("cy", centerY);
        circle.setAttribute("r", fontSize * 0.85); 
        circle.setAttribute("fill", circleFill);
        circle.setAttribute("stroke", lineStroke); 
        circle.setAttribute("stroke-width", "1.5");
        svgElement.appendChild(circle);
        
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", centerX); 
        text.setAttribute("y", centerY); 
        
        text.setAttribute("font-size", `${fontSize}px`);
        text.setAttribute("font-weight", "800");
        text.setAttribute("fill", finalTextColor); 
        
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        
        text.textContent = variant.sum;
        svgElement.appendChild(text);
    }
}
