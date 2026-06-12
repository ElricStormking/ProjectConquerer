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
*   **`battle_node_waves.csv`**: Per-node enemy wave level design for every battle, elite, and boss node across the 5 faction stages. Edit this when a specific map node needs custom enemies, levels, timing, boss tuning, or stat modifiers. If a node has rows here, these rows override the shared `waves.csv` encounter template.
*   **`skills.csv`**: Skill definitions, rarities, and effects.
*   **`buildings.csv`**: (Future) Building stats.
*   **`artifacts.csv`**: Artifact definitions, rarity, icon, shop cost, and gameplay effect columns. This is the designer-facing artifact file used by the game.
*   **`relics.csv`**: Legacy fallback artifact data. Prefer editing `artifacts.csv`.
*   **`map_nodes.csv`**: (Future) Campaign map node definitions.

## Important Rules
*   **Do NOT change the first row (Header)**: The game needs these exact column names to read the data.
*   **Unique IDs**: Ensure every `id` in a file is unique.
*   **JSON Fields**: Some columns (like `effects_json`) contain code-like structures. Be careful when editing them.

## Artifact Columns
`artifacts.csv` is one row per artifact. Designers should prefer the flat effect columns over JSON.

*   `id`: Unique artifact id used by saves and rewards.
*   `rarity`: `common`, `rare`, `epic`, `legendary`, `mythic`, or `cursed`.
*   `effect_type`: Gameplay effect key, such as `card_draw`, `fortress_hp`, `unit_damage_pct`, or `shop_discount_pct`.
*   `trigger`: When the effect applies, such as `passive`, `on_wave_start`, `on_battle_start`, `on_node_complete`, or `on_run_start`.
*   `value`: Flat numeric value for effects that use one.
*   `percent_value`: Percent numeric value for percentage effects.
*   `condition`: Optional condition, such as `elite`, `boss`, `ranged`, or `fortress_hp_above_75`.
*   `effect_cost`: Optional drawback token, such as `healing_halved` or `unit_speed_reduce_20`.
*   `extra_json`: Optional advanced effect fields that do not have their own column yet.
*   `is_cursed`: `true` for cursed artifacts.
*   `icon_key`: Texture key for the artifact icon.
*   `shop_cost`: Optional shop cost override.

## Battle Node Wave Columns
`battle_node_waves.csv` is one row per spawn group. Rows with the same `node_id` and `wave_index` belong to the same wave.

*   `node_id`: Map node from `map_nodes.csv`. This is what makes tuning node-specific.
*   `node_type`: `battle`, `elite`, or `boss`.
*   `enemy_level`: Default level for all enemy rows in that node.
*   `wave_index`: Wave order in the battle.
*   `spawn_unit_id`: Enemy unit id from `units.csv`.
*   `spawn_count`: Number of formation slots for that unit group.
*   `spawn_time`: Delay in seconds after the wave starts before this group enters.
*   `lane`: Designer label for the group (`north`, `center`, or `south`).
*   `unit_level`: Optional per-row override. Leave blank to use `enemy_level`.
*   `hp_multiplier`, `damage_multiplier`, `move_speed_multiplier`, `attack_speed_multiplier`: Optional per-row stat multipliers.
*   `armor_bonus`: Optional flat armor added after level scaling.
*   `is_boss_spawn`: Optional marker for designer tracking.
