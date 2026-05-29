// src/RuleDictionary.js

export const GameRules = {
    // Core Grid Rules
    suguru: () => "<b>Suguru:</b> Fill each irregular region with digits 1 to N (where N is the size of the region). Identical digits cannot touch each other, not even diagonally. <i>(Standard row and column rules do not apply).</i>",
    jigsaw: (size) => `<b>Jigsaw Sudoku:</b> Place digits 1 to ${size} in each row, column, and irregular region without repeating.`,
    classic: (size) => `<b>Classic Sudoku:</b> Place digits 1 to ${size} in each row, column, and 3x3 box without repeating.`,

    // Global Modifiers
    antiKnight: () => "<b>Anti-Knight:</b> Digits cannot repeat at a chess knight's move apart.",
    antiKing: () => "<b>Anti-King:</b> Identical digits cannot touch diagonally.",

    // Painted Variants
    thermo: () => "<b>Thermometers:</b> Digits must strictly increase from the bulb to the tip.",
    whisper: () => "<b>German Whispers:</b> Adjacent digits along a green line must differ by at least 5.",
    killer: () => "<b>Killer Cages:</b> Digits in a dashed cage cannot repeat and must sum to the small total in the corner.",
    kropkiWhite: () => "<b>White Kropki:</b> Digits separated by a white dot must be consecutive.",
    kropkiBlack: () => "<b>Black Kropki:</b> Digits separated by a black dot must be in a 1:2 ratio.",

    // Grid Logic Variants (Nurikabe & Loop Styles)
    nurikabe: () => "<b>Nurikabe:</b> Shade cells to form a continuous 'river' (black) that contains no 2x2 squares. Unshaded 'islands' (white) must connect to exactly one clue, which equals the island's cell count.",
    slitherlink: () => "<b>Slitherlink:</b> Draw a single, continuous, non-branching loop along the grid lines. Clues indicate how many edges of that cell are part of the loop.",
    starbattle: () => "<b>Star Battle:</b> Place stars in the grid so that each row, column, and region contains a specific number of stars. Stars cannot touch each other, not even diagonally.",
    corral: () => "<b>Corral (Bag):</b> Draw a continuous loop along the grid lines. Clues indicate how many interior cells are visible horizontally and vertically from that cell, including itself.",
    
    // Perimeter Constraints
    sandwich: () => "<b>Sandwich:</b> Clues outside the grid show the sum of digits sandwiched between the 1 and 9 in that row/column.",
    skyscraper: () => "<b>Skyscrapers:</b> Clues outside show how many digits (buildings) are visible, where higher digits block lower ones.",
    frames: () => "<b>Frames:</b> Clues outside show the sum of the first 3 digits in that row/column.",
    rooms: () => "<b>Numbered Rooms:</b> Clues outside indicate the digit located at the Nth cell, where N is the first digit in that direction.",
    fog: () => "<b>Fog of War:</b> The board is partially hidden. Placing correct digits reveal cells chosen by the setter.",
    torus: () => "<b>Torus Mode:</b> Drag rows and columns to align the digits to satisfy other games rules."
};
