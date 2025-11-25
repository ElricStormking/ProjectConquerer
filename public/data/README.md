# Game Data Management

This directory contains all the game balance data in CSV format. Designers can edit these files directly to tweak the game without touching the code.

## How to Edit
1.  Open any `.csv` file in Excel, Google Sheets, or a text editor.
2.  Make your changes.
3.  Save the file (keep the `.csv` extension).
4.  Reload the game to see your changes.

## Files
*   **`units.csv`**: Base stats for all units (HP, Damage, Speed, etc.).
*   **`cards.csv`**: Deck definitions, card costs, and descriptions.
*   **`waves.csv`**: Enemy spawn configurations for each wave.
*   **`skills.csv`**: Skill definitions, rarities, and effects.
*   **`buildings.csv`**: (Future) Building stats.
*   **`relics.csv`**: (Future) Relic definitions.
*   **`map_nodes.csv`**: (Future) Campaign map node definitions.

## Important Rules
*   **Do NOT change the first row (Header)**: The game needs these exact column names to read the data.
*   **Unique IDs**: Ensure every `id` in a file is unique.
*   **JSON Fields**: Some columns (like `effects_json`) contain code-like structures. Be careful when editing them.
