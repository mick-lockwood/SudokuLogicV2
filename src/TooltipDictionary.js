// src/TooltipDictionary.js

export const Tooltips = {
    // Core Tools
    'tool-pointer':
`Select cells and input numbers.\n
Shortcut: Esc or V`,
     
    'tool-region':
`Paint custom irregular regions for Jigsaw Sudoku.\n
Click and drag across cells to group them into a single region.`,
    
    // Variant Tools
    'tool-thermo':
`Numbers must strictly increase
from the bulb to the tip.\n
Click and drag on cells to draw.\n
Line starts with the bulb when drawing.`,
    
    'tool-whisper':
`9x9 puzzle: Adjacent numbers along the line
must have a difference of 5 or more\n
6x6 puzzle: Adjacent numbers along the line
must have a difference of 3 or more\n
Click and drag on cells to draw.`,

    'tool-killer': 
`Digits in a cage must not repeat.
They must exactly sum to the number in the corner.\n
Click and drag on cells to draw cage.\n
Enter target cage sum.`,
    
    'tool-kropki-white': 
`Adjacent cells must have consecutive values.\n
Example: 3 and 4.\n
Click and drag between cells to place.`,
    
    'tool-kropki-black': 
`One cell must be double the value of the other.\n
Example: 3 and 6.\n
Click and drag between cells to place.`,

    // Grid Logic Variants
    'tool-nurikabe':
`Paint cells as River (Black) or Island (White).\n
Rivers must connect orthogonally and cannot form a 2x2 square.\n
Islands must connect to exactly one clue, matching its size.\n
Click and drag to paint.`,

    'tool-slitherlink':
`Draw a continuous loop along the grid edges.\n
Numbers show how many edges are part of the loop.\n
[Variant Coming Soon]`,

    'tool-starbattle':
`Place stars in the grid.\n
Stars cannot touch, even diagonally.\n
[Variant Coming Soon]`,

    'tool-corral':
`Draw a loop enclosing cells.\n
Numbers show how many interior cells are visible from that spot.\n
[Variant Coming Soon]`,
    
    // Actions    
    'tool-edit':
`Click any drawn variant graphic to edit it's value.\n
Example: Edit the number value shown on a Killer Cage.`,
    
    'tool-eraser':
`Click any drawn variant graphic to delete it.`,
    
    'btn-undo-variant': 
`Undo the last drawn variant.\n
Shortcut: Ctrl+Z (While variant tool active)`,
    
    'btn-redo-variant': 
`Redo the last undone variant.\n
Shortcut: Ctrl+Y (While variant tool active)`,
    
    'btn-clear-variants': 
`Instantly clear all variant lines from the board.`,

    'toggle-anti-knight': 
`Cells that are a chess knight's move 
apart cannot contain the same digit.`,
    
    'toggle-anti-king':
`Cells that touch diagonally 
(a chess king's move) 
cannot contain the same digit.`,

    // Grid Modification Toggles
    'toggle-jigsaw':
`Replace standard 3x3 boxes with custom irregular regions.
Each region must contain exactly 9 cells\n
Fill each region with 1-9\n
Use the Region Painter tool to draw your own grid shapes.`,
    
    'toggle-suguru':
`Replace standard 3x3 boxes with custom
irregular regions of varying sizes.\n
Fill each region with 1 to N.
Where N = the number of cells in the region.\n
Identical digits cannot touch anywhere, even diagonally.\n
Use the Region Painter tool to draw your own grid shapes.\n
Example: A region with a total of 5 cells must contain the digits 1-5`,

    'toggle-fog': 
`Cover the board in fog.
Placing correct digits reveals cells.\n
Use Paint Fog to apply fog to cells.y\n
Use Fog Linker to set a source and target.
When the source cell is solved correctly, 
the target cell's fog will clear.`,
    
    'tool-fog': 
`Paint fog clouds over specific cells.`,
    
    'tool-fog-link': 
`Link a cell to other fogged cells.\n
When the source cell is solved correctly, 
the target cell's fog will clear.`,

    'btn-clear-fog': 
`Erase all fog and links from the board.`,

    'toggle-shift': 
`Torus Mode:\n
Drag rows and columns to to slide them.\n
Solved by satisfying classic sudoku rules,
and any other applied variant`,
    
    'btn-scramble-torus': 
`Instantly generates a full board and
scrambles it by sliding rows and columns.`,
    
    'tool-lock': 
`Lock a cell in place.\n
Locked cells prevent their entire row
and column from sliding in Torus Mode.`,
    
    'toggle-outer-clues':
`Show or hide the perimeter cells around the grid
used for inputting outside variant clues.`,

    // Perimeter Rules
    'rule-sandwich':
`Clues outside the grid indicate the sum of
the digits between the 1 and 9 in that line.`,

    'rule-skyscraper':
`Outside clues indicate how many 'buildings' can be seen.\n
Higher digits block lower digits from view.`,

    'rule-frames':
`Clues outside the grid indicate the sum of
the first 3 digits in that line of sight.`,

    'rule-rooms':
`Clues outside the grid indicate a specific
digit that must be placed in the N-th cell, 
where N is the digit in the very first cell 
from that direction.\n
For Example:
If a row/columm starts with a 5, a clue of '8' means the 
number 8 is placed in the 5th cell of that row/column.`,
    
    // Visibility Settings
    'toggle-seen':
`Highlights all cells that share 
a row, column, or 3x3 box with
the currently selected cell`,

    // Theme Settings
    'btn-theme':
`Switch the app between Light and Dark mode themes`,
    
};
