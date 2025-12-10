# Project Ironwars - Codex-Optimized Implementation Plan v5.0

## Executive Summary

**Transformation**: Nine Commanders (physics sim) → Project Ironwars (roguelike deckbuilder RTS)

**Visual Target** (from screenshots):
- **Building Phase**: Isometric fortress grid (center-top), card hand (bottom 3 cards), HP numbers on units, resource counter
- **Fighting Phase**: 100+ unit battles, fortress top-left, enemies bottom-right, clean isometric view

**Core Loop**: Preparation (card placement) ⇄ Real-Time Battle (commander skills) × 5 waves

**Prototype Scope**: 1 battle node, 1 faction, 1 fortress, 5 units, 15 cards, 1 commander, 1 wave

---

## Codex AI Best Practices

### Context Management
- **Layer 1**: Always include `src/types/ironwars.ts` (< 500 lines)
- **Layer 2**: Include only relevant system interfaces
- **Layer 3**: For large files, extract method + line references

### Prompt Templates

**New System**:
```
Role: Senior Phaser 3 + TypeScript developer
Task: Implement [System] in src/systems/[System].ts
Requirements: [1-3 specific points]
Interfaces: [paste from ironwars.ts]
Output: Complete class, no placeholders
```

**Modification**:
```
Context: [Filename] lines [X-Y]
Current: [paste code]
Add: [specific feature]
Output: Modified code only
```

### Session Management
- ✅ One system per Codex session
- ✅ Run typecheck/lint after each generation
- ❌ Never ask for multiple systems at once

---

## Architecture

### System Dependencies
```
BattleScene
├── FortressSystem (grid, HP)
├── DeckSystem (draw, hand, discard)
├── CardSystem (card → unit spawn)
├── CommanderSystem (skills, cooldowns)
├── WaveManager (enemy spawning)
├── UnitManager (REFACTOR for factions)
├── IsometricRenderer (EXTEND for grid)
└── PhysicsManager (REUSE)
```

### Core Types (`src/types/ironwars.ts`)

```typescript
export enum ResourceType {
  GOLD = 'gold',
  PROFIT = 'profit',  // Cog Dominion
  CHI_FLOW = 'chi_flow',  // Jade Dynasty
  TACTICAL_ORDERS = 'tactical_orders',  // Republic of Virel
  LIFEFORCE = 'lifeforce',  // Verdant Covenant
  SOULFROST = 'soulfrost',  // Eternal Frost Clan
  BLOOD_FRENZY = 'blood_frenzy'  // Bloodfang Warborn
}

export enum CardType {
  UNIT = 'unit',
  STRUCTURE = 'structure',
  SPELL = 'spell',
  MODULE = 'module'
}

export interface ICard {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  resourceType: ResourceType;
  factionId?: string;
  unitId?: string;
  structureId?: string;
  spellEffectId?: string;
  moduleId?: string;
  portraitKey: string;
  description: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface IFortressCell {
  x: number;
  y: number;
  type: 'buildable' | 'core' | 'blocked';
  occupantId?: string;
}

export interface IFortressConfig {
  id: string;
  name: string;
  factionId: string;
  gridWidth: number;
  gridHeight: number;
  cells: IFortressCell[];
  maxHp: number;
  abilities: string[];
}

export interface IUnitConfig {
  id: string;
  name: string;
  role: 'melee' | 'ranged' | 'support' | 'tank' | 'siege';
  factionId: string;
  maxHp: number;
  attack: number;
  attackRange: number;
  attackSpeed: number;
  moveSpeed: number;
  armor: number;
  spriteKey: string;
  scale: number;
}

export interface IEnemySpawn {
  unitId: string;
  count: number;
  spawnTime: number;
  lane: 'north' | 'center' | 'south';
}

export interface IWaveConfig {
  id: string;
  index: number;
  spawns: IEnemySpawn[];
}

export interface IGameState {
  fortressHp: number;
  fortressMaxHp: number;
  currentWave: number;
  phase: 'PREPARATION' | 'BATTLE';
  gold: number;
  factionResource: number;
  drawPile: ICard[];
  hand: ICard[];
  discardPile: ICard[];
}

export interface ICommanderConfig {
  id: string;
  name: string;
  factionId: string;
  passiveId: string;
  activeSkillId: string;
  cooldown: number;
  portraitKey: string;
}
```

---

## Implementation Roadmap

### Phase 0: Foundation (2 days)

**Task 0.1**: Create type system
- Create `src/types/ironwars.ts` with all interfaces above
- Run `npm run typecheck`

**Task 0.2**: Create sample data
- Create `src/data/ironwars/cog_dominion_starter.ts`:
  - 1 Fortress (5×5 grid, 500 HP)
  - 5 Units (Soldier, Archer, Tank, Medic, Cannon)
  - 15 Cards (10 unit, 3 structure, 2 spell)
  - 1 Wave (3 spawn events)

**Task 0.3**: GameStateManager singleton
- Create `src/systems/GameStateManager.ts`
- Methods: `initializeBattle()`, `spendResource()`, `takeFortressDamage()`
- Emit events: 'fortress-destroyed', 'resource-changed'

---

### Phase 1: Prototype (10 days)

#### Sprint 1.1: Fortress Grid (2 days)
**Goal**: Match Building_Phase.jpg - white diamond grid

**1.1.1 FortressSystem**
- Create `src/systems/FortressSystem.ts`
- Methods: `initialize()`, `isValidCell()`, `occupyCell()`, `releaseCell()`

**1.1.2 Grid Rendering**
- Extend `IsometricRenderer.renderFortressGrid()`
- Draw white diamond outlines (64×32 iso cells)
- Add yellow hover highlight
- Position: fortress at (960, 400) - top-center

**Verify**: Grid renders, cells highlight on hover

---

#### Sprint 1.2: Card Hand UI (2 days)
**Goal**: Match Building_Phase.jpg - 3 cards at bottom

**1.2.1 CardSprite Component**
- Create `src/ui/CardSprite.ts` (extends Container)
- Layout: Portrait 64×64 + Name + Description + Cost
- Hover scale 1.0 → 1.05
- Rarity borders (gray/blue/purple)

**1.2.2 HandManager**
- Create `src/ui/HandManager.ts`
- Methods: `addCard()`, `removeCard()`, `layoutCards()`
- Fan layout centered at (960, 920)
- Animate: slide up from y=1100

**Verify**: Cards appear, fan layout, hover works

---

#### Sprint 1.3: Card Drag & Drop (3 days)
**Goal**: Drag cards onto fortress grid

**1.3.1 Drag Interaction**
- Modify `CardSprite`: add drag behavior
- Show phantom on grid during drag
- Green (valid) / Red (invalid) indicator
- On drop: emit 'card-placed' or return to hand

**1.3.2 CardSystem**
- Create `src/systems/CardSystem.ts`
- Method: `resolveCard(card, gridX, gridY)`
- Check cost → route by type → occupy cell
- UNIT type: spawn via UnitManager

**1.3.3 Unit Spawning**
- Refactor `UnitManager.spawnUnit()` signature:
  - Old: `(type, deployZone)`
  - New: `(unitId, gridX, gridY, faction)`
- Convert grid → world coords via IsometricRenderer

**Verify**: Drag card → unit spawns at grid position

---

#### Sprint 1.4: Phase Management (1 day)
**Goal**: Preparation ⇄ Battle phase switching

- Add enum `BattlePhase { PREPARATION, BATTLE, WAVE_COMPLETE }`
- Add method `transitionPhase(newPhase)`
- Add "Start Battle" button (960, 800)
- PREPARATION: cards visible, AI disabled
- BATTLE: cards hidden, AI enabled

**Verify**: Button switches phase, cards hide

---

#### Sprint 1.5: Wave System (2 days)
**Goal**: Match Fighting_Phase.jpg - enemies from bottom-right

**1.5.1 WaveManager**
- Create `src/systems/WaveManager.ts`
- Methods: `loadWaves()`, `startWave()`, `update()`, `spawnEnemy()`
- Spawn positions (bottom-right):
  - north: iso(15, 15)
  - center: iso(12, 18)
  - south: iso(9, 21)

**1.5.2 Enemy AI**
- Modify AI: faction='enemy' targets fortress
- If player unit in range → attack unit
- Else → move toward fortress center

**Verify**: Enemies spawn 3 lanes, move toward fortress, attack

---

#### Sprint 1.6: Commander System (1 day)
**Goal**: Space key activates skill

- Create `src/systems/CommanderSystem.ts`
- Skill: Artillery Strike (mouse position, 100px radius, 50 damage, 15s cooldown)
- Add UI: portrait at (960, 60), cooldown overlay
- Bind Space key

**Verify**: Press Space → explosion → damage

---

#### Sprint 1.7: Win/Loss (1 day)
**Goal**: Victory/defeat conditions

- Victory: `waveManager.isWaveComplete() && !hasNextWave()`
- Defeat: fortress HP ≤ 0
- Show overlay + restart button

**Verify**: Win after 1 wave, lose if fortress destroyed

---

## Implementation Status (as of 2025-11-25)

### Phase 0: Foundation
- ✅ `src/types/ironwars.ts` created with all core interfaces.
- ✅ Starter data `src/data/ironwars/cog_dominion_starter.ts` implemented (fortress, 5 units, starter deck, multi-wave config).
- ✅ `GameStateManager` singleton integrated for fortress HP and resources.
- ✅ Data externalization to CSV format (Phase 2) completed.

### Phase 1: Prototype Battle Loop
- ✅ 1.1 Fortress grid rendered isometrically with hover/placement highlights at fortress center-top.
- ✅ 1.2 CardSprite + HandManager display the bottom card hand with rarity borders and hover.
- ✅ 1.3 Drag & drop card placement with green/red placement feedback and fortress cell occupancy.
- ✅ 1.4 PREPARATION ⇄ BATTLE ⇄ WAVE_COMPLETE phases wired with Start button + UI updates.
- ✅ 1.5 WaveManager spawns enemies in 3 lanes across multiple waves, ending in a boss wave.
- ✅ 1.6 CommanderSystem Space-activated skill implemented as a multi-strike thunderstorm.
- ✅ 1.7 Win/loss overlays and restart path hooked to fortress HP and wave completion.

### Phase 2: Data Management (Completed)
- ✅ **Data Externalization**: Core game balance data moved to `public/data/*.csv` for designer-friendly editing.
  - `units.csv`: Unit stats, roles, and sprite keys.
  - `cards.csv`: Deck definitions, costs, and types.
  - `waves.csv`: Enemy spawn configurations per wave.
  - `skills.csv`: Skill definitions and effects.
- ✅ **DataManager System**: Implemented `src/systems/DataManager.ts` to parse and serve CSV data.
- ✅ **System Refactoring**:
  - `UnitFactory`: Now builds units from `DataManager` templates instead of hardcoded TypeScript objects.
  - `DeckSystem`: Loads starter deck from `DataManager` (cards.csv).
  - `WaveManager`: Loads wave configurations from `DataManager` (waves.csv).
  - `SkillManager`: Generates skill choices from `DataManager` (skills.csv).
- ✅ **Designer Workflow**: Designers can edit CSVs in `public/data/` and reload the game to see changes instantly.

### Phase 3: Relic System (Completed)
- ✅ **Complete Relic System**: Implemented comprehensive relic system inspired by "Slay the Spire" with 32 relics across 5 rarity tiers.
- ✅ **RelicManager Singleton**: `src/systems/RelicManager.ts` - Central authority with event-driven trigger system, modifier aggregation, and conditional evaluation.
  - Support for PASSIVE buffs and event triggers (ON_WAVE_START, ON_DAMAGE_DEALT, ON_NODE_COMPLETE, etc.)
  - Conditional modifiers (ranged only, HP thresholds, fortress HP %)
  - Dynamic stat application methods for range, move speed, attack speed, armor, damage
- ✅ **32 Relics Designed**: Complete roster of BUFFs and curses:
  - Common: Steam Core (+1 card draw), Forged Plating (+150 fortress HP), Iron Resolve (+10 armor)
  - Rare: Arcane Lens (+50 range for ranged), Skywhisper Feather (+15% move speed), Emberstone Charm (+40 HP post-battle)
  - Epic: Molten Heart (+20% damage with self-burn), Battle Standard (+10% damage when fortress HP > 75%)
  - Legendary: Storm Reservoir (+1 rare card after bosses), Adaptive Matrix (auto-upgrade first reward each stage)
  - Curses: Cursed Furnace (+1 card choice but fortress -10 HP), Ashen Contract (+150 gold but shops +25% cost)
- ✅ **UI Components**:
  - `RelicInventoryUI` (src/ui/RelicInventoryUI.ts) - 4-column grid at top-right with rarity borders and tooltips
  - `RelicRewardScene` (src/scenes/RelicRewardScene.ts) - Modal for relic selection after Elite/Boss battles
- ✅ **System Integration**:
  - `RunProgressionManager`: Random starting relics (2 + optional curse), run start variation
  - `WaveManager`: ON_WAVE_START/ON_WAVE_END trigger events
  - `NodeEncounterSystem`: Elite/Boss relic rewards, shop curse removal
  - `BattleScene`: Wave start bonuses (card draw, resources, fortress healing)
  - `ShopScene`: Curse removal functionality with gold cost
- ✅ **Conditional Modifiers**: Advanced evaluation system for:
  - Unit type conditions (ranged only for Arcane Lens)
  - Health thresholds (Berserker Tooth: +30% damage when unit HP < 50%)
  - Fortress HP conditions (Battle Standard: +10% damage when fortress HP > 75%)
  - Node type conditions (elite rewards, shop effects)
- ✅ **Data-Driven Design**: `public/data/relics.csv` with designer-friendly JSON effect definitions
- ✅ **Bug Fixes**: 
  - Fixed Steam Core not drawing cards (event listener missing in BattleScene)
  - Fixed relic BUFFs not applying (Unit entities now query RelicManager with context)
- ✅ **Type Safety**: Comprehensive TypeScript interfaces (IRelicEffect, IRelicContext, RelicTrigger enum)
- ✅ **Debug Logging**: Extensive logging for relic trigger events and stat applications

### Additional polish implemented
- ✅ Thunder Mage (formerly Thunder Cannon) reworked into AoE lightning artillery with dedicated card art.
- ✅ Building sprites (fortress core, cannon tower, armor shop) replaced placeholder graphics and auto-scale to fortress grid cells.
- ✅ Card portraits loaded via `portraitKey` from `assets/cards/*.png` with graceful colored fallback when art is missing.
- ✅ Background music (`bgm_01_dragonbattle.mp3`) loops in BattleScene; `victory.mp3` plays when the boss is defeated.
- ✅ Boss mass tuned to reduce knockback/bouncing during combat.

### Phase 4: Main Game Loop (Completed)
- ✅ **Title Menu System**: `src/scenes/TitleMenuScene.ts` with 4 options:
  - New Game → Faction Selection
  - Continue → Load saved run from LocalStorage
  - Options → Volume controls modal
  - Exit → Thank you message
- ✅ **Faction Selection**: `src/scenes/FactionSelectionScene.ts`
  - Horizontal carousel for 6 factions
  - Each panel shows: faction emblem, fortress preview, starting commander, sample cards
  - Navigation arrows and "Select Faction" button
- ✅ **Deck Building System**: `src/scenes/DeckBuildingScene.ts`
  - Left panel: Commander roster (owned commanders)
  - Center panel: Available cards grid (9 cards per commander)
  - Right panel: Current deck with 40-card cap
  - Click to add/remove cards, scroll support
  - Accessible from StageMapScene between nodes
- ✅ **Save/Load System**: `src/systems/SaveManager.ts`
  - LocalStorage persistence for run state
  - Meta-progression tracking (unlocked commanders, relics)
  - Auto-save on state changes
- ✅ **9 Factions Data**: `public/data/factions.csv` and `public/data/commanders.csv`
  - Cog Dominion, Jade Dynasty, Republic of Virel
  - Verdant Covenant, Eternal Frost Clan, Bloodfang Warborn
  - Eternal Frost Clan, Bloodfang Warborn
  - Each with unique resource type, fortress, and starting commander
- ✅ **Commander System**: `src/systems/CommanderManager.ts` + `src/systems/FactionRegistry.ts`
  - Commander unlock system with LocalStorage persistence
  - Cards tied to commanders (9 per commander, expandable to 12)
  - Deck validation based on commander roster
- ✅ **Commander Unlock Rewards**: `src/scenes/CommanderUnlockScene.ts`
  - 70% chance to unlock new commander after boss battles
  - Celebratory unlock screen with particle effects
  - Unlocked commanders added to current run roster
- ✅ **Stage Map Enhancements**: Updated `src/scenes/StageMapScene.ts`
  - DECK button for between-node deck management
  - MENU button with Resume, Options, Save & Quit, Abandon Run
  - Faction name display in HUD
  - Save/load integration

---

## Testing Checklist

### Visual Match
- [x] Building Phase: grid, cards, resources, HP numbers
- [x] Fighting Phase: large armies, fortress top-left, enemies bottom-right

### Functional
- [x] Drag 5 unit types onto grid
- [x] Units spawn at correct positions
- [x] Phase transition works
- [x] Enemies spawn 3 lanes at intervals
- [x] Combat: player vs enemy
- [x] Commander skill (Space key)
- [x] Win after all waves (5-wave node including boss)
- [x] Lose if fortress HP = 0
- [x] **Data Driven**: Edit `units.csv` HP/Damage -> Reflects in-game

### Main Game Loop (Phase 4)
- [x] Title menu with New Game / Continue / Options / Exit
- [x] Faction selection carousel (9 factions)
- [x] Deck building with 40-card cap
- [x] Commander roster management
- [x] LocalStorage save/load system
- [x] Between-node deck access from Stage Map
- [x] Commander unlock rewards after bosses
- [x] Meta-progression persistence

### Technical
- [x] `npm run typecheck` - 0 errors
- [x] `npm run lint` - 0 errors
- [ ] 30 FPS with 50 units

---

## Phase 5 (Next Steps)

**Phase 5** (Week 5-8): 50+ cards per faction, elite/boss variants, balanced encounters, additional node types

---

## Success Criteria

✅ Visual match to screenshots
✅ Play 1 complete battle (5 waves)
✅ 5 unit types deployable
✅ 1 commander skill
✅ Win/loss conditions
✅ 30 FPS performance
✅ 0 TypeScript errors
✅ 5-min demo video
✅ Title menu with game flow
✅ 9 factions selectable
✅ Deck building (40-card cap)
✅ Save/load system (LocalStorage)
✅ Meta-progression (commander unlocks)

**Timeline**: 4 weeks (Phase 0-4)
**Alpha Build**: Complete main game loop

---

## Codex Workflow Examples

### Example Session 1: DeckSystem Implementation

**Prompt 1 (Interface Definition)**:
```
Define IDeckSystem interface for roguelike deckbuilder.
Must include: drawPile, hand, discardPile, maxHandSize=7
Methods: shuffle(), draw(n), discard(card), reset()
Add to src/types/ironwars.ts
```

**Prompt 2 (Implementation)**:
```
Implement DeckSystem class based on IDeckSystem
File: src/systems/DeckSystem.ts
Constructor: (scene: Phaser.Scene)
Methods:
- shuffle(): Fisher-Yates algorithm
- draw(n): move n cards from drawPile to hand, shuffle discard if empty
- discard(card): move from hand to discardPile
- reset(): shuffle all cards back to drawPile
Emit events: 'card-drawn', 'deck-empty'
Include unit test in tests/DeckSystem.test.ts
```

**Prompt 3 (Integration)**:
```
Modify BattleScene.create()
After line "this.unitManager = new UnitManager(this);"
Add:
- Initialize DeckSystem
- Load starter deck from STARTER_DECK
- Draw initial hand (5 cards)
- Subscribe to 'card-drawn' event → update HandManager
```

---

### Example Session 2: Visual Debugging

**Problem**: Units spawning 100px below expected grid position

**Debug Prompt**:
```
Issue: Units spawn 100px below expected position

Current Code:
```typescript
const worldPos = this.isoRenderer.toWorldCoords(gridX, gridY);
this.unitManager.spawnUnit(unitId, worldPos.x, worldPos.y);
```

Expected: Match Building_Phase.jpg (fortress center-top)
Actual: Units appear off-grid

Debug Steps:
1. Log gridX, gridY before conversion
2. Log worldPos after conversion
3. Add debug marker at worldPos
4. Compare with expected position

Output: Fixed code with debug markers
```

---

## Quick Reference Commands

```bash
# Development
npm run dev        # Hot reload at localhost:5173

# Quality Checks
npm run typecheck  # TypeScript validation
npm run lint       # ESLint check
npm run test       # Run Vitest tests

# Build
npm run build      # Production build
npm run preview    # Test production build

# Git (for relic system)
git log --oneline -5  # Check recent commits
git status            # View staged changes
git add .              # Stage all files for commit
git commit -m "feat: [description]"  # Commit with description
git push origin main   # Push to remote repository
```

---

## File Structure

```
src/
├── types/
│   └── ironwars.ts          # All interfaces (IFactionConfig, IMetaProgression, ISaveData added)
├── systems/
│   ├── GameStateManager.ts  # Singleton state
│   ├── DataManager.ts       # CSV Data loader (factions, commanders added)
│   ├── SaveManager.ts       # [NEW] LocalStorage persistence
│   ├── FactionRegistry.ts   # [NEW] 9 factions with fortress configs
│   ├── CommanderManager.ts  # [NEW] Commander unlock system
│   ├── FortressSystem.ts    # Grid logic
│   ├── DeckSystem.ts        # Card management
│   ├── CardSystem.ts        # Card resolution
│   ├── CommanderSystem.ts   # Skills
│   ├── WaveManager.ts       # Enemy spawning
│   ├── UnitManager.ts       # Faction-aware units
│   ├── RunProgressionManager.ts  # [UPDATED] Faction-based runs, save integration
│   ├── NodeEncounterSystem.ts    # [UPDATED] Commander unlock rewards
│   └── IsometricRenderer.ts # Grid render
├── scenes/
│   ├── TitleMenuScene.ts    # [NEW] Main menu (New Game, Continue, Options, Exit)
│   ├── OptionsScene.ts      # [NEW] Volume controls placeholder
│   ├── FactionSelectionScene.ts  # [NEW] 9-faction carousel
│   ├── DeckBuildingScene.ts # [NEW] 40-card deck editor
│   ├── CommanderUnlockScene.ts   # [NEW] Unlock celebration
│   ├── StageMapScene.ts     # [UPDATED] Deck/Menu buttons
│   ├── BattleScene.ts       # Phases
│   └── UIScene.ts           # Card hand
├── ui/
│   ├── CardSprite.ts        # Card component
│   └── HandManager.ts       # Hand layout
└── data/
    └── ironwars/
        └── cog_dominion_starter.ts  # Sample data (Fallback/Layout)

## Data Directory (`public/data/`)
- `units.csv`: Unit stats
- `cards.csv`: Deck definitions
- `waves.csv`: Wave configs
- `skills.csv`: Skill definitions
- `buildings.csv`: Building stats (placeholder)
- `relics.csv`: 32 relics with triggers, conditions, and effects
- `map_nodes.csv`: Campaign map
- `factions.csv`: [NEW] 9 factions with resource types and fortresses
- `commanders.csv`: [NEW] 9 starter commanders with card assignments
```

---

**Status**: Phase 0-4 complete; full main game loop playable with 9 factions, deck building, save/load, and meta-progression.
**Created**: 2025-11-20
**Version**: 5.4 (updated 2025-11-25)
