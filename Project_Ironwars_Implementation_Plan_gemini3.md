# Project Ironwars Implementation Plan

## 1. Executive Summary

**Objective**: Transform the existing *Nine Commanders* (Charge Conquerer) codebase into *Project Ironwars*, a roguelike deckbuilder RTS.
**Core Mechanics**: Deck-based unit deployment (Preparation Phase) -> Real-time automated combat with Commander skills (Battle Phase).
**Visual Style**: Isometric 2.5D (leveraging existing `IsometricRenderer`).
**Tech Stack**: Phaser 3 + Matter.js (Physics) + TypeScript.

## 2. Codex AI Development Guidelines

To maximize efficiency with Codex (GPT-4/5):

### 2.1 Context Management
- **Single Source of Truth**: Maintain strict TypeScript interfaces in `src/types/ironwars.ts`.
- **Small Contexts**: When asking for code, provide only relevant interfaces and the specific file to be modified. Avoid dumping the entire codebase.
- **Validation First**: Ask Codex to generate *tests* or *interfaces* before implementation logic.

### 2.2 Prompt Strategy
- **Role**: "You are a senior Phaser 3 developer specializing in TypeScript and Matter.js."
- **Format**:
  - **Input**: Relevant Interface + Current File Content (partial) + Goal.
  - **Output**: Strict code block with minimal comments.
- **Iterative**: "Implement the `DeckSystem` class with `draw()`, `shuffle()`, and `discard()` methods based on `IDeck` interface."

### 2.3 Code Quality Guardrails
- **Linting**: Run `npm run lint` after every generated file.
- **Type Safety**: strict `noImplicitAny`.
- **Tests**: Use Vitest for logic-heavy systems (Deck, RNG, Damage Calculation).

## 3. Architecture & Data Structures

### 3.1 Core Systems (New/Modified)
| System | Responsibility | Status |
|--------|----------------|--------|
| `GameStateManager` | Global state (Run, Gold, Current Stage, Deck). Singleton. | **New** |
| `BattleScene` | Main game loop. Orchestrates Phases. | **Modify** |
| `FortressSystem` | Manages the Isometric Grid, Module Slots, and HP. | **New** |
| `DeckSystem` | Manages Draw Pile, Hand, Discard Pile. | **New** |
| `CardSystem` | Resolves card effects (Spawn Unit, Place Structure, Cast Spell). | **New** |
| `CommanderSystem` | Handles Commander active skills and passive traits. | **New** |
| `WaveManager` | Spawns enemies according to wave config. | **New** |
| `UnitManager` | Existing unit pooling and lifecycle. | **Reuse/Refactor** |
| `IsometricRenderer` | Existing 2.5D rendering. | **Reuse** |

### 3.2 Key Interfaces (`src/types/ironwars.ts`)
(To be created in Phase 0)
- `ICard`: `id`, `cost`, `type`, `effect`
- `IFortress`: `gridLayout`, `modules`, `hp`
- `IUnit`: `stats`, `aiBehavior`, `faction`
- `IWave`: `spawns`, `timing`
- `ICommander`: `skills`, `cooldowns`

## 4. Implementation Roadmap

### Phase 0: Foundation & Cleanup
**Goal**: Prepare the codebase structure.
1. **Audit**: Review `BattleScene.ts` and remove incompatible logic (e.g., old level-up system if not needed, or adapt it).
2. **Types**: Create `src/types/ironwars.ts` with all core definitions.
3. **State**: Implement `GameStateManager.ts` (Singleton).
4. **Assets**: Create placeholder JSON data for 1 Faction, 1 Fortress, 1 Commander, 10 Cards.

### Phase 1: Prototype (Vertical Slice)
**Goal**: A playable "Battle Node" with visuals matching the GDD/Screenshots.

#### Step 1: The Fortress & Grid (Visuals)
- **Task**: Render the Fortress Grid (Isometric) at Top-Left.
- **Task**: Render Enemy Spawn Point at Bottom-Right.
- **Task**: Implement `FortressSystem` to track grid cell occupancy.
- **Verification**: Visual check of grid alignment with existing `IsometricRenderer`.

#### Step 2: The Deck & Preparation Phase
- **Task**: Implement `DeckSystem` (Logic).
- **Task**: Create `UIScene` overlay for "Hand" (Cards).
- **Task**: Implement Drag-and-Drop from Hand to Fortress Grid.
- **Logic**:
  - Drag Card -> Check Cost -> Check Valid Grid Cell -> Place Phantom.
  - On Release -> Deduct Resource -> Instantiate Unit/Structure -> Move Card to Discard.

#### Step 3: The Battle Phase (Real-Time)
- **Task**: "Start Battle" button.
- **Task**: Switch State: `PREPARATION` -> `BATTLE`.
- **Task**: Enable Physics/AI.
- **Task**: Implement `WaveManager` to spawn enemies from Bottom-Right.
- **Task**: Units move towards nearest target (Enemy -> Fortress).

#### Step 4: Commander System
- **Task**: Render Commander Avatar/Skill Button (1-5 keys).
- **Task**: Implement Cooldown logic.
- **Task**: Implement 1 active skill (e.g., "Artillery Strike" - simple AOE damage).

#### Step 5: Win/Loss Loop
- **Win**: All waves cleared.
- **Loss**: Fortress HP <= 0.
- **Transition**: Simple "Victory" text and restart.

### Phase 2: Content Expansion (Future)
- Map Generation (Nodes).
- Meta Progression.
- More Factions & Cards.

## 5. Codex Context Instructions (Prompt Template)

When requesting code from Droid/Codex, use this format:

```markdown
**Context**:
- File: `src/systems/DeckSystem.ts` (New)
- Interface: `src/types/ironwars.ts` (IDeck, ICard)
- Goal: Implement draw logic. Max hand size 7. Shuffle discard if draw pile empty.

**Constraint**:
- Use pure TypeScript (no Phaser dependencies for logic class).
- Include unit tests in `tests/DeckSystem.test.ts`.
```

## 6. Risk Assessment & Mitigation
- **Risk**: Physics performance on mobile with many units.
  - **Mitigation**: Reuse existing `PhysicsManager` optimization (sleeping bodies). Cap unit count for prototype.
- **Risk**: Isometric sorting issues with complex fortress.
  - **Mitigation**: Strict Z-indexing based on Y-coordinate (already in `IsometricRenderer`, verify it works for stacked structures).

