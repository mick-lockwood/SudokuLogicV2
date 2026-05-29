import { State, initBoardState, saveState, undo, redo } from './GameState.js';
import { hasConflict, cleanPencilsAfterMove, countSolutions, hasConflictGen } from './SudokuLogic.js';
import * as Renderer from './Renderer.js';

window.confettiActive = false;

// --- EXPOSE FUNCTIONS TO WINDOW FOR HTML INLINE ONCLICKS ---
window.updateUI = Renderer.updateUI;
window.applyColor = applyColor;
window.triggerUndo = () => { if(undo()) window.updateUI(); };
window.triggerRedo = () => { if(redo()) window.updateUI(); };
window.handleInput = handleInput;
window.handleCellSelection = handleCellSelection;

window.toggleDarkMode = () => {
    State.darkMode = !State.darkMode;
    document.body.classList.toggle('dark-mode', State.darkMode);

    // --- Swap the Theme Button Text ---
    document.querySelectorAll('.btn-theme').forEach(btn => {
        btn.innerText = State.darkMode ? "Toggle Light Mode" : "Toggle Dark Mode";
    });
    
    Renderer.renderGrid();
    
    // CRITICAL FIX: Route through the window object so the Torus hook catches it!
    if (typeof window.updateUI === 'function') {
        window.updateUI(); 
    } else {
        Renderer.updateUI();
    }

    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
};

window.openMobileMenu = (tab) => {
    // If the menu is already open AND they clicked the same button, close it.
    if (document.body.getAttribute('data-mobile-tab') === tab && document.body.classList.contains('mobile-menu-open')) {
        window.closeMobileMenu();
    } else {
        document.body.setAttribute('data-mobile-tab', tab);
        document.body.classList.add('mobile-menu-open');
    }
};

window.closeMobileMenu = () => {
    document.body.removeAttribute('data-mobile-tab');
    document.body.classList.remove('mobile-menu-open');
};

window.toggleOuterClues = () => {
    State.showOuterClues = document.getElementById('toggle-outer-clues').checked;
    Renderer.renderGrid(); // Rebuilds the HTML grid size
    Renderer.updateUI();   // Re-applies the numbers/colors
    if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
};

window.setGridSize = (s) => {
    initBoardState(s);
    document.getElementById('size6').className = (s === 6) ? 'active' : '';
    document.getElementById('size9').className = (s === 9) ? 'active' : '';
    initAppBoard();
};

window.setAppMode = (m) => {
    if (m === State.mode) return;
    if (State.isPlayOnly && m === 'create') return;

    State.mode = m;
    document.getElementById('modeCreate').classList.toggle('active', m === 'create');
    document.getElementById('modeSolve').classList.toggle('active', m === 'solve');
    
    const isCreate = (m === 'create');
    document.getElementById('gen-controls').style.display = isCreate ? 'grid' : 'none';
    document.getElementById('size-selector').style.display = isCreate ? 'flex' : 'none';
    document.getElementById('timer').style.display = isCreate ? 'none' : 'block';
    document.getElementById('pause-btn').style.display = isCreate ? 'none' : 'block';
    document.getElementById('clean-pencils-link').style.display = isCreate ? 'none' : 'inline';
    document.getElementById('status-label').style.display = isCreate ? 'block' : 'none';
    
    // --- Hide the mobile variants toolbar button in solve mode ---
    const mobileVariantsBtn = document.getElementById('toolbar-variants-btn');
    if (mobileVariantsBtn) mobileVariantsBtn.style.display = isCreate ? 'block' : 'none';
    
    if (m === 'solve') {
        startTimer(); 
    } else {
        
        // --- CLEANUP FOR CREATE MODE ---
        State.isWon = false; // Unlock inputs
        document.getElementById('win-overlay').style.display = 'none'; // Hide the win menu
        Renderer.stopConfetti(); // Stop any active celebration
        
        if (State.timerInt) clearInterval(State.timerInt);
        resetTimer();
    }

    Renderer.updateUI();
};

window.togglePause = () => {
    State.paused = !State.paused; 
    document.getElementById('pause-overlay').style.display = State.paused ? 'flex' : 'none'; 
    if (!State.paused) startTimer(); else clearInterval(State.timerInt);
};

window.generateNew = function() {
    generateNew(); // This calls the internal function defined at the bottom of your file
};
    
window.generateWithDiff = (s, d) => {
    window.setGridSize(s);
    document.getElementById('diff').value = d;
    if (State.mode !== 'solve') window.setAppMode('solve');
    generateNew();
};

window.toggleGhost = () => {
    if (State.mode !== 'create') return;
    State.showGhost = !State.showGhost;
    Renderer.updateUI();
};

window.handleClearBoard = () => {
    if (!confirm("Reset entire board?")) return;
    saveState();
    if (State.mode === 'create') initAppBoard();
    else { State.board.forEach(c => { if(!c.given) { c.val = 0; c.notes = []; c.color = null; } }); Renderer.updateUI(); }
};

window.clearUserInputs = () => {
    if (!confirm("Clear user inputs?")) return;
    saveState(); State.board.forEach(c => { if(!c.given) c.val = 0; }); Renderer.updateUI();
};

window.cleanAllPencils = () => {
    saveState(); State.board.forEach(c => c.notes = []); Renderer.updateUI();
};

window.clearAllHighlights = () => {
    if (State.isWon || State.paused) return;
    if (!State.board.some(c => c.color !== null)) return;
    if (!confirm("Clear all highlights?")) return;
    saveState(); State.board.forEach(c => c.color = null); Renderer.updateUI();
};

window.restartSameLevel = () => {
    State.board.forEach(c => { if (!c.given) { c.val = 0; c.notes = []; c.color = null; } });
    document.getElementById('win-overlay').style.display = 'none';
    State.isWon = false; 
    State.paused = false; 
    resetTimer();
    startTimer(); 
    Renderer.updateUI();
};

window.hideWinOverlay = () => {
    Renderer.stopConfetti();
    document.getElementById('win-overlay').style.display = 'none';
    document.getElementById('return-win-btn').style.display = 'block';
};

window.showWinOverlay = () => {
    document.getElementById('win-overlay').style.display = 'flex';
    document.getElementById('return-win-btn').style.display = 'none';
};

window.exitToCreate = () => window.setAppMode('create');

window.exportPuzzleLink = () => {
    // 1. Package only the essential data
    const titleEl = document.getElementById('puzzle-title');
    const puzzleTitle = titleEl ? titleEl.innerText.trim() : "Sudoku Logic";

    const puzzleData = {
        title: puzzleTitle, // <--- Saves the custom name
        size: State.size,
        board: State.board.map(c => c.given ? c.val : 0), 
        variants: State.variants || [],
        antiKnight: State.antiKnight || false,
        antiKing: State.antiKing || false
    };
    
    // 2. Encode to a URL-safe Base64 string
    const encodedData = btoa(JSON.stringify(puzzleData));
    
    // --- UPDATED SMART URL GENERATOR ---
    // Grab the full exact URL you are on right now, ignoring any old parameters
    let currentUrl = window.location.href.split('?')[0];
    
    // If the puzzle has variants but the URL says 'classic', force it to the advanced engine
    if (State.variants && State.variants.length > 0 && currentUrl.includes('classic.html')) {
        currentUrl = currentUrl.replace('classic.html', 'index.html');
    }
    
    const shareUrl = `${currentUrl}?puzzle=${encodedData}`;
    // -----------------------------------
    
    // 3. Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert("Puzzle Link Copied to Clipboard!\n\nAnyone who opens this link will play your exact puzzle without any creator tools.");
    }).catch(err => {
        console.error("Failed to copy link: ", err);
        prompt("Copy this link to share:", shareUrl); // Fallback for older browsers
    });
};

// --- APP LOGIC & INPUT CONTROLLER ---

function initAppBoard() {
    initBoardState(State.size);
    document.getElementById('difficulty-badge').style.display = 'none';
    document.getElementById('win-overlay').style.display = 'none';
    document.getElementById('pause-overlay').style.display = 'none';
    resetTimer();
    Renderer.renderGrid();
    Renderer.updateUI();
}

function handleCellSelection(index, isMulti, isDragging) {
    if (isMulti) {
        if (!State.selected.includes(index)) {
            State.selected.push(index);
        } else if (!isDragging) {
            State.selected = State.selected.filter(id => id !== index);
        }
    } else {
        State.selected = [index]; 
    }
    Renderer.updateUI();
}

function applyColor(c) {
    if (State.selected.length === 0 || State.isWon || State.paused) return;
    saveState(); 
    State.selected.forEach(idx => State.board[idx].color = c); 
    Renderer.updateUI();
}

function handleInput(num) {
    if (State.selected.length === 0 || State.paused || State.isWon) return;
    saveState(); 
    
    State.selected.forEach(idx => {
        // Handle Border Clues (Sandwich/Skyscrapers)
        if (typeof idx === 'string') {
            if (!State.clues) State.clues = {};
            if (num === 0) {
                delete State.clues[idx];
            } else {
                // REPLACES the number, ensuring only 1 digit is shown
                State.clues[idx] = num.toString();
            }
            return;
        }

        // Handle Regular Cells
        const cell = State.board[idx];
        if (State.mode === 'solve' && cell.given) return;
        
        if (State.pencil && State.mode === 'solve' && num !== 0) {
            if (cell.val !== 0) return;
            const pos = cell.notes.indexOf(num);
            if (pos > -1) cell.notes.splice(pos, 1); else cell.notes.push(num);
        } else {
            cell.val = num; 
            cell.notes = [];
            cell.given = (State.mode === 'create' && num !== 0);
            if (State.mode === 'solve' && num !== 0) cleanPencilsAfterMove(idx, num);
        }
    });

    Renderer.updateUI();
    if (State.mode === 'solve') checkWin();
}

function checkWin() {
    if (State.board.every(c => c.val !== 0) && !State.board.some((_, i) => hasConflict(State.board, i, State.board[i].val))) {
        State.isWon = true; 
        if (State.timerInt) clearInterval(State.timerInt); 
        document.getElementById('final-time').textContent = `Final Time: ${document.getElementById('timer').textContent}`;
        document.getElementById('win-overlay').style.display = 'flex';
        Renderer.fireConfetti(); 
    }
}

// --- GENERATOR LOGIC ---

function generateNew() {
    resetTimer(); 
    initAppBoard();
    let flat = Array(State.size * State.size).fill(0);
    
    State.currentDifficulty = document.getElementById('diff').value;
    const diffBadge = document.getElementById('difficulty-badge');
    diffBadge.textContent = State.currentDifficulty;
    diffBadge.className = `diff-${State.currentDifficulty}`; // Applies diff-easy, diff-medium, or diff-hard
    diffBadge.style.display = 'inline-block';
        
    const fill = (idx) => {
        if (idx === State.size * State.size) return true;
        let nums = Array.from({length: State.size}, (_, i) => i + 1).sort(() => Math.random() - 0.5);
        for (let n of nums) {
            if (!hasConflictGen(flat, idx, n)) {
                flat[idx] = n;
                if (fill(idx + 1)) return true;
                flat[idx] = 0;
            }
        }
        return false;
    };
    fill(0);
    State.solution = [...flat];

    const diff = document.getElementById('diff').value;
    const totalCells = State.size * State.size;
    const percentage = diff === 'easy' ? 0.45 : (diff === 'medium' ? 0.55 : 0.65);
    const targetEmpty = Math.floor(totalCells * percentage);

    let removed = 0;
    let indices = Array.from({length: State.size * State.size}, (_, i) => i).sort(() => Math.random() - 0.5);

    for (let i of indices) {
        if (removed >= targetEmpty) break;
        let backup = flat[i];
        flat[i] = 0;
        
        if (countSolutions([...flat]) !== 1) {
            flat[i] = backup; 
        } else {
            removed++;
        }
    }

    flat.forEach((v, i) => { 
        State.board[i].val = v; 
        State.board[i].given = (v !== 0); 
    });

    Renderer.updateUI();
    if (State.mode === 'solve') startTimer(); 
}

// --- TIMER LOGIC ---

function resetTimer() {
    if (State.timerInt) clearInterval(State.timerInt);
    State.timerInt = null;
    State.timerVal = 0;
    document.getElementById('timer').textContent = "00:00";
}

function startTimer() {
    if (State.timerInt) clearInterval(State.timerInt);
    
    const updateDisplay = () => {
        const m = Math.floor(State.timerVal / 60).toString().padStart(2, '0');
        const s = (State.timerVal % 60).toString().padStart(2, '0');
        document.getElementById('timer').textContent = `${m}:${s}`;
    };
    
    updateDisplay();
    State.timerInt = setInterval(() => {
        if (!State.paused && !State.isWon) { 
            State.timerVal++;
            updateDisplay();
        }
    }, 1000);
}

// --- KEYBOARD EVENT LISTENER ---

window.addEventListener('keydown', (e) => {
    if (State.paused || State.isWon) return;
    const key = e.key.toLowerCase();
    
    if (['w','a','s','d'].includes(key) || key.includes('arrow')) {
        e.preventDefault();
        let current = State.selected.length > 0 ? State.selected[State.selected.length - 1] : 0;
        let r = Math.floor(current / State.size), c = current % State.size;
        
        if ((key === 'w' || key === 'arrowup') && r > 0) r--;
        if ((key === 's' || key === 'arrowdown') && r < State.size - 1) r++;
        if ((key === 'a' || key === 'arrowleft') && c > 0) c--;
        if ((key === 'd' || key === 'arrowright') && c < State.size - 1) c++;
        
        State.selected = [r * State.size + c];
        Renderer.updateUI();
    }
    if (e.key >= '1' && e.key <= State.size.toString()) window.handleInput(parseInt(e.key));
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') window.handleInput(0);
    if (key === 'z') { if (e.shiftKey) window.triggerRedo(); else window.triggerUndo(); }
    if (key === 'n' && State.mode === 'solve') { State.pencil = !State.pencil; Renderer.renderNumpad(); }
});

// --- BOOTSTRAP ---
window.onload = function() {
    console.log("App starting with ES6 Modules..."); 
    Renderer.initHighlighter();
    
    // Check if there is a ?puzzle= parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const puzzleString = urlParams.get('puzzle');
    
    if (puzzleString) {
        try {
            // 1. Decode the puzzle data
            const decodedData = JSON.parse(atob(puzzleString));
            
            // 2. Initialize the correct grid size
            window.setGridSize(decodedData.size);
            
            // --- Apply and Lock the Custom Title ---
            if (decodedData.title) {
                const titleEl = document.getElementById('puzzle-title');
                if (titleEl) {
                    titleEl.innerText = decodedData.title;
                    titleEl.removeAttribute('contenteditable'); // Lock it for the player
                    titleEl.style.cursor = 'default';
                    titleEl.style.borderBottom = 'none';
                    titleEl.title = ""; 
                }
                document.title = decodedData.title; // Updates the actual browser tab!
            }
            // -------------------------------------------
            
            // 3. Apply the numbers and variants to the State
            State.variants = decodedData.variants || [];
            State.antiKnight = decodedData.antiKnight || false;
            State.antiKing = decodedData.antiKing || false;
            
            // Visually check the toggle box if the rule is active
            const akToggle = document.getElementById('toggle-anti-knight');
            if (akToggle) akToggle.checked = State.antiKnight;

            const aKingToggle = document.getElementById('toggle-anti-king');
            if (aKingToggle) aKingToggle.checked = State.antiKing;
            
            decodedData.board.forEach((val, i) => {
                State.board[i].val = val;
                State.board[i].given = (val !== 0);
            });
            
            // 4. Lock the UI into Play-Only mode
            State.isPlayOnly = true;
            window.setAppMode('solve');
            
            // Hide the Create/Solve toggle buttons
            const modeToggleGroup = document.getElementById('modeCreate').parentElement;
            if (modeToggleGroup) modeToggleGroup.style.display = 'none';
            
            // Hide the "Back to Create Mode" button in the win screen
            const backToCreateBtn = document.querySelector('.btn-secondary[onclick="exitToCreate()"]');
            if (backToCreateBtn) backToCreateBtn.style.display = 'none';

            // If we are on the advanced page, trigger the SVG renderer
            if (typeof window.renderSVGLayer === 'function') window.renderSVGLayer();
            Renderer.updateUI();
            
        } catch(e) {
            console.error("Invalid puzzle link detected.", e);
            window.setGridSize(9);
        }
    } else {
        window.setGridSize(9); 
    }
};

// --- TITLE INPUT HANDLER ---
// Prevents the enter key from creating a line break in the puzzle title
setTimeout(() => {
    const titleEl = document.getElementById('puzzle-title');
    if (titleEl) {
        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Stop the line break
                titleEl.blur();     // Deselect the text
            }
        });
        
        // Failsafe: if they delete the whole title, give it a default name
        titleEl.addEventListener('blur', () => {
            if (titleEl.innerText.trim() === '') {
                titleEl.innerText = 'Custom Puzzle';
            }
        });
    }
}, 100);

// --- MOBILE DRAWER SWIPE-TO-CLOSE ---
let touchStartY = 0;

window.addEventListener('touchstart', (e) => {
    // Only track touches if a menu is actually open
    if (!document.body.classList.contains('mobile-menu-open')) return;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (!document.body.classList.contains('mobile-menu-open')) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    
    // If they swiped down by more than 50 pixels
    if (touchEndY - touchStartY > 50) {
        
        // Figure out which panel is currently active
        const isColorsTab = document.body.getAttribute('data-mobile-tab') === 'colors';
        const activePanel = isColorsTab ? document.querySelector('.side-panel') : document.getElementById('left-panel');
        
        // Only close it if they are scrolled all the way to the top of the menu
        if (activePanel && activePanel.scrollTop <= 10) {
            window.closeMobileMenu();
        }
    }
}, { passive: true });

window.toggleDropdown = () => {
    document.getElementById('diff-options').classList.toggle('show');
};

window.selectDiff = (val) => {
    document.getElementById('diff').value = val;
    document.getElementById('diff-selected').innerText = val.charAt(0).toUpperCase() + val.slice(1);
    document.getElementById('diff-options').classList.remove('show');
};

document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('diff-wrapper');
    const options = document.getElementById('diff-options');
    if (wrapper && !wrapper.contains(e.target)) {
        options.classList.remove('show');
    }
});
