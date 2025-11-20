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
  HEAT = 'heat',  // Ember Court
  TACTICAL_ORDERS = 'tactical_orders',  // Republic of Virel
  FAITH = 'faith',  // Sanctum Order
  LIFEFORCE = 'lifeforce',  // Verdant Covenant
  AETHERSTORM = 'aetherstorm',  // Aetherion Arcana
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

## Testing Checklist

### Visual Match
- [ ] Building Phase: grid, cards, resources, HP numbers
- [ ] Fighting Phase: large armies, fortress top-left, enemies bottom-right

### Functional
- [ ] Drag 5 unit types onto grid
- [ ] Units spawn at correct positions
- [ ] Phase transition works
- [ ] Enemies spawn 3 lanes at intervals
- [ ] Combat: player vs enemy
- [ ] Commander skill (Space key)
- [ ] Win after 1 wave
- [ ] Lose if fortress HP = 0

### Technical
- [ ] `npm run typecheck` - 0 errors
- [ ] `npm run lint` - 0 errors
- [ ] 30 FPS with 50 units

---

## Phase 2-3 (Future)

**Phase 2** (Week 3-4): Stage map, nodes, rewards, save/load
**Phase 3** (Week 5-8): 9 factions, 50+ cards, bosses, meta progression

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

**Timeline**: 2 weeks (Phase 0-1)
**First Demo**: End Week 1

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
```

---

## File Structure

```
src/
├── types/
│   └── ironwars.ts          # [NEW] All interfaces
├── systems/
│   ├── GameStateManager.ts  # [NEW] Singleton state
│   ├── FortressSystem.ts    # [NEW] Grid logic
│   ├── DeckSystem.ts        # [NEW] Card management
│   ├── CardSystem.ts        # [NEW] Card resolution
│   ├── CommanderSystem.ts   # [NEW] Skills
│   ├── WaveManager.ts       # [NEW] Enemy spawning
│   ├── UnitManager.ts       # [REFACTOR] Add faction
│   └── IsometricRenderer.ts # [EXTEND] Add grid render
├── scenes/
│   ├── BattleScene.ts       # [MAJOR REFACTOR] Phases
│   └── UIScene.ts           # [MODIFY] Card hand
├── ui/
│   ├── CardSprite.ts        # [NEW] Card component
│   └── HandManager.ts       # [NEW] Hand layout
└── data/
    └── ironwars/
        └── cog_dominion_starter.ts  # [NEW] Sample data
```

---

**Status**: Plan approved, ready for Phase 0 implementation
**Created**: 2025-11-20
**Version**: 5.0
