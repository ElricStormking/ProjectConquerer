Here’s a concise plan to shift fortress grids to start at a 3×3 center and allow spell-driven expansion to the full layout.

### Goals
- Start battles with only the center 3×3 buildable cells active.
- Preserve fortress grid definitions from CSV (full layout). Locked cells outside the 3×3 are unusable until unlocked by spell cards.
- Unlock cells progressively (up to full grid) via specific spell cards during the run.

### Data & Configuration
1) **Fortress grid CSV**: keep full layouts as-is.
2) **New unlock state tracking**: add per-run/per-fortress state storing unlocked cell coordinates.
3) **Spell cards**: define which cards unlock how many cells (e.g., +4 ring, +8 ring, or specific coordinates). Could reuse existing spell IDs or add new config field (e.g., `grid_unlock_cells: number` or explicit coordinate list).

### Implementation Steps
1) **State model**
   - Add to run/battle state a list/set of unlocked cells per fortress ID (default to 3×3 center coords).
   - On battle init, initialize unlocked set to center 3×3 based on fortress grid dimensions.

2) **FortressSystem changes**
   - When building the grid, mark cells as locked unless in the unlocked set.
   - Rendering: show locked cells with a disabled visual (e.g., darkened/blocked overlay) and prevent placement/hover on them.
   - Placement validation should check unlocked set.

3) **Grid unlock logic**
   - Expose `unlockCells(count: number)` or `unlockRing(radius: number)` on FortressSystem.
   - Selecting which cells to unlock: expand outward in rings from center using the fortress grid list sorted by Manhattan distance from center; skip already unlocked.
   - Cap at total available buildable cells.

4) **Spell integration**
   - In CardSystem/Spell effect handling, add support for a new effect type (e.g., `grid_unlock`) that calls FortressSystem’s unlock API with a configured count.
   - Map spell card(s) from CSV to this effect (e.g., existing expansion spell or new one).

5) **Persistence across waves**
   - Store unlocked cells in GameState/RunProgression so that unlocks persist across waves/nodes as intended.
   - On scene re-entry, reapply the unlocked set before rendering.

6) **UI/Feedback**
   - When a spell unlocks cells, briefly highlight newly unlocked tiles (flash/outline) and show a toast/log message.

### Testing
- Start battle: only 3×3 center is buildable; placement outside is blocked.
- Play unlock spell once: more cells become buildable; ensure no overlap/duplicates.
- Unlock until full grid: matches original full layout; no errors when exceeding grid size.
- Verify persistence between waves/scene reload.

### Notes/Assumptions
- No change to the fortress CSV files themselves; we layer runtime locking/unlocking.
- If specific coordinates are desired per spell, we can add an optional `unlock_coords` list in card data; otherwise, ring-based expansion is default.
- We’ll keep spells as the trigger for expansion; no passive/time-based unlocks unless requested.