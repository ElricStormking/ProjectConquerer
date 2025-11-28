# Fortress Spawn Grid System

## Architecture Overview

The existing `FortressSystem` already uses `IFortressCell[]` for grid management with isometric rendering. We will extend this by:
1. Moving fortress grid definitions to external CSV files (2D tilemap format)
2. Adding a loader in `DataManager` to parse CSV and convert to isometric cells
3. Creating a sample 5x5 CSV grid for Sanctum Order fortress

## Data Structure

### Fortress Grid CSV Format

Each fortress will have a corresponding CSV file in `public/data/fortress_grids/`:

**File: `fortress_sanctum_order_01.csv`**

```csv
id,faction_id,name,image_key,max_hp,cell_size_width,cell_size_height
fortress_sanctum_order_01,sanctum_order,Sanctum Cathedral,fortress_sanctum_order_01,1000,64,32
```

**File: `fortress_sanctum_order_01_grid.csv`** (companion tilemap file)

```csv
1,1,1,1,1
1,1,1,1,1
1,1,2,1,1
1,1,1,1,1
1,1,1,1,1
```

Cell type legend:
- `0` = blocked (not usable)
- `1` = buildable (can spawn units/structures)
- `2` = core (fortress center)

The CSV is a simple 2D array where row 0 = y:0, column 0 = x:0. The game's isometric renderer converts these grid coordinates to diamond-shaped visuals automatically.

## Files to Create/Modify

### 1. Create: `public/data/fortress_grids/fortress_sanctum_order_01.csv`
Fortress metadata (id, faction, dimensions, hp).

### 2. Create: `public/data/fortress_grids/fortress_sanctum_order_01_grid.csv`
5x5 tilemap with 24 buildable cells (1s) and 1 core (2).

### 3. Modify: `src/types/ironwars.ts`
- Add `IFortressGridConfig` interface:
  - `fortressId`, `factionId`, `name`, `imageKey`, `maxHp`, `cellSizeWidth`, `cellSizeHeight`, `gridWidth`, `gridHeight`, `cells: IFortressCell[]`

### 4. Modify: `src/systems/DataManager.ts`
- Add private `fortressGrids: Map<string, IFortressGridConfig>` 
- Add `parseFortressGrids(metaCsv: string, gridCsv: string, fortressId: string)` to:
  1. Parse metadata CSV
  2. Parse grid CSV as 2D array
  3. Convert 2D array to `IFortressCell[]` with proper x,y and type
- Add `getFortressGrid(fortressId: string)` accessor
- Load fortress grids in `parse()` method

### 5. Modify: `src/scenes/PreloadScene.ts`
- Add `this.load.text('fortress_grid_sanctum_meta', 'data/fortress_grids/fortress_sanctum_order_01.csv')`
- Add `this.load.text('fortress_grid_sanctum_tilemap', 'data/fortress_grids/fortress_sanctum_order_01_grid.csv')`
- Repeat for other fortresses as needed

### 6. Modify: `src/systems/FortressSystem.ts`
- Constructor remains the same (accepts `IFortressConfig` which now comes from parsed CSV)
- Keep existing isometric rendering logic (already converts x,y to diamond shapes)

### 7. Modify: `src/systems/FactionRegistry.ts`
- Update `getFortressConfig()` to fetch from `DataManager.getFortressGrid()` if available
- Fallback to `buildDefaultFortressCells()` if no CSV exists

### 8. Modify: `src/scenes/BattleScene.ts`
- Ensure FortressSystem receives grid config from DataManager/FactionRegistry based on selected faction

## Sample 5x5 Grid (Sanctum Order)

Designer creates this simple CSV:

```csv
1,1,1,1,1
1,1,1,1,1
1,1,2,1,1
1,1,1,1,1
1,1,1,1,1
```

The game automatically renders this as an isometric diamond with [2,2] as the core in the center. Total: 24 buildable + 1 core = 25 cells.

## Designer Workflow

1. Open spreadsheet (Excel/Google Sheets)
2. Create 5x5 grid (or any size) using numbers: 0 (blocked), 1 (buildable), 2 (core)
3. Save as `fortress_[name]_grid.csv`
4. Create metadata CSV with fortress properties
5. Reference `fortressId` in `factions.csv`
6. Game loads and converts to isometric diamond automatically

## Conversion Logic

Parser converts CSV row/col to game coordinates:
```typescript
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const cellValue = grid[row][col];
    if (cellValue > 0) {
      cells.push({
        x: col,
        y: row,
        type: cellValue === 2 ? 'core' : 'buildable'
      });
    }
  }
}
```

The existing `FortressSystem.gridToWorld()` handles isometric transformation.

## Implementation Todos

- [ ] Create fortress_sanctum_order_01.csv (metadata)
- [ ] Create fortress_sanctum_order_01_grid.csv (5x5 tilemap)
- [ ] Add IFortressGridConfig interface to ironwars.ts
- [ ] Add parseFortressGrids() CSV parser with 2D array conversion
- [ ] Load fortress CSV files in PreloadScene
- [ ] Update FactionRegistry to use DataManager fortress grids

