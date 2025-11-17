# Project Ironwars – Compact Markdown GDD v3.3 (Phaser 3 Edition)
*Codex-optimized systems document*

---

## 1. Game Overview

**Genre:** Real-time tactical roguelike + deckbuilder  
**Engine:** Phaser 3 (TypeScript, WebGL)  
**Perspective:** Top-down isometric (2.5D pixel art)  
**Session Length:** 20–60 minutes  
**Platform:** Web (PC browser)

---

## 2. Core Fantasy

You command a **mobile Battle Fortress (War Engine)** and multiple **Commanders** from various fantasy–steampunk factions.

Each run = 3 sequential stages, each containing **10 nodes** (not all battles).  
Battle nodes contain **5 waves**.  
Elite/Boss nodes contain **10 waves**.

Each wave has two phases:

1. **Preparation Phase** (play cards / deploy)  
2. **Real-Time Battle Phase** (no cards; use Commander Skills & fortress abilities)

Survive all 3 stages to win the run.

---

## 3. Core Pillars

- **Strategic Placement → Real-Time Execution**
- **Fortress Grid Layout = Player Build**
- **Faction Identity = deep mechanical differences**
- **Roguelike progression** with unlockable fortresses, commanders, relics, and cards
- **Warmachine-inspired steampunk fantasy** world

---

## 4. Run Structure

### 4.1 Stage Map
- 3 stages per run  
- Each stage = 10 nodes  
- Branching paths  
- Node types:
  - **Battle (5 waves)**
  - **Elite (10 waves)**
  - **Boss (10 waves)**
  - **Event**
  - **Shop**
  - **Recruitment**
  - **Rest**

### 4.2 Rewards
- Gold  
- Card reward choices  
- Relic reward choices  
- Fortress upgrade options  
- Commander unlock events  
- Healing or curse removal  

---

## 5. Battle Flow

### 5.1 Per-Wave Structure
1. **Preparation Phase**
   - Player uses deck cards to deploy **units**, **structures**, **spells**, **modules**  
   - Placement happens on **isometric fortress grid**  
   - Deck up to **40 cards**
   - Multi-Commander decks allowed
   - Card costs use faction/neutral resources (Gold, Chi Flow, Aetherstorm, etc.)

2. **Real-Time Battle Phase**
   - Camera: fortress at **top-left**, enemies enter from **bottom-right**
   - Cards disabled  
   - Player uses only:
     - **Commander active skills**
     - **Fortress abilities**
   - Switch active Commander via **1–5 keys**
   - Units + structures operate autonomously

### 5.2 Wave Completion
- If waves remain → repeat  
- If node ends → reward screen  
- Return to Stage Map

---

## 6. Commanders

Each Commander has:
- Passive ability  
- Unique **Active Skill** (cooldown, direction targeting, etc.)  
- Commander-specific cards  
- Faction alignment  

Player can include **multiple Commanders** in a deck.  
Switch active Commander mid-battle: **keys 1–5**

---

## 7. Battle Fortress (War Engine)

A fortress defines:
- **Shape / grid layout**
- **Total HP**
- **Module slots**
- **Faction alignment**
- **Fortress abilities** (AOE blasts, shields, turrets, etc.)

Examples:
- **Cog Dominion:** Iron Syndicate Citadel (industrial mech-city)
- **Ember Court:** Flame Titan (walking volcano)
- **Jade Dynasty:** Jade Dragon Caravan Fortress
- **Aetherion Arcana:** Sky Citadel (floating fortress)
- **Eternal Frost Clan:** Frozen Sepulcher (necropolis glacier)
- **Bloodfang Warborn:** Maw of the Moon (bone-totem ritual camp)
- etc.

Player unlocks new fortress layouts via progression.

---

## 8. Factions Summary (v3.3)

| Faction | Fantasy Theme | Resource | Playstyle |
|--------|---------------|----------|-----------|
| **Cog Dominion** | Greedy industrial alliance of humans/goblins/dwarves | Profit | Mechs, economy, flexible builds |
| **Ember Court** | Dwarven fire empire on a Flame Titan | Heat & Pressure | Fire AoE, tanks |
| **Republic of Virel** | Gunpowder tacticians | Tactical Orders | Reliable ranged precision |
| **Jade Dynasty** | Eastern Chi-Tech monks & ninjas | Chi Flow | Fast, reactive counterplay |
| **Sanctum Order** | Holy templars, zealots, radiant machines | Faith | Shields, healing |
| **Verdant Covenant** | Nature, elves, druids, treants | Lifeforce | Regrowth, battlefield control |
| **Aetherion Arcana** | Arcane sky mages, lightning constructs | Aetherstorm | Flying units, AoE spells |
| **Eternal Frost Clan** | Vampire-lich king & undead ice swarm | Soulfrost | Mind control, freezes, undead |
| **Bloodfang Warborn** | Barbarian werewolves & shamans | Blood Frenzy | Aggressive melee burst |

---

## 9. Cards & Deckbuilding

### 9.1 Card Types
- **Unit** – spawns controllable troop  
- **Structure** – turrets, totems, healing, walls  
- **Spell** – one-time effects  
- **Module** – upgrade fortress cells  

### 9.2 Deck
- Max **40 cards**
- Multiple Commanders allowed (but lower synergy)

---

## 10. Units

Unit stats:
- HP  
- Attack  
- Attack speed  
- Attack range  
- Move speed  
- Size (small/med/large)  
- AI profile behavior  
- Traits (machine, undead, beast, flying)  
- Abilities (lifesteal, dash, root, shock, etc.)

---

## 11. Waves & Enemy Design

### Normal Node: 5 waves  
### Elite/Boss Node: 10 waves  

Wave elements:
- Spawn events (time-based)  
- Lanes (center, north, south)  
- Elite modifiers  
- Boss abilities  

---

## 12. Resources & Relics

### Core Resource:
- **Gold** – purchases at shops

### Faction Resources:
- Profit (Cog Dominion)  
- Heat & Pressure (Ember Court)  
- Chi Flow (Jade Dynasty)  
- Faith (Sanctum Order)  
- Lifeforce (Verdant Covenant)  
- Aetherstorm (Aetherion Arcana)  
- Soulfrost (Eternal Frost)  
- Blood Frenzy (Bloodfang Warborn)

### Relics
- Passive modifiers  
- Some faction-aligned  
- Some cursed  

---

## 13. Meta Progression

Between runs the player unlocks:
- New Commanders  
- New Fortress layouts  
- New cards  
- New Relics  
- Higher difficulty tiers  
- Faction alliances / perks  

---

## 14. Technical Design (Phaser 3)

### 14.1 Scenes
- `BootScene`
- `PreloadScene`
- `MainMenuScene`
- `MetaHubScene`
- `RunMapScene`
- `BattleScene`
- `UIScene`

### 14.2 Systems / Managers
- `GameStateManager`  
- `CardSystem`  
- `DeckSystem`  
- `CommanderSystem`  
- `FortressSystem`  
- `UnitSystem`  
- `WaveManager`  
- `AIManager`  
- `ResourceManager`  
- `RelicManager`  
- `MetaProgressionManager`  
- `ConfigLoader`  
- `PathfindingGrid`  

### 14.3 BattleScene Camera
- ISO view  
- Player fortress at **top-left**  
- Enemy entry at **bottom-right**  
- Zoom to show entire fortress + active battle area  

---

## 15. Data Schemas (TS)

### 15.1 Card
```ts
interface CardConfig {
  id: string;
  name: string;
  type: 'unit' | 'structure' | 'spell' | 'module';
  cost: number;
  factionId?: string;
  commanderId?: string;
  unitId?: string;
  structureId?: string;
  spellEffectId?: string;
  moduleId?: string;
}
```

### 15.2 Unit
```ts
interface UnitConfig {
  id: string;
  role: 'melee' | 'ranged' | 'support' | 'tank';
  maxHp: number;
  attack: number;
  attackRange: number;
  attackSpeed: number;
  moveSpeed: number;
  aiProfileId: string;
}
```

### 15.3 Fortress
```ts
interface FortressConfig {
  id: string;
  hp: number;
  gridWidth: number;
  gridHeight: number;
  cells: FortressCellConfig[];
  abilityIds: string[];
}
```

### 15.4 Wave
```ts
interface WaveConfig {
  id: string;
  index: number;
  enemySpawns: EnemySpawnConfig[];
}
```

---

## 16. Controls

- Mouse: deploy, click, confirm  
- Right Click / ESC: cancel  
- 1–5 keys: switch Commander  
- Space: activate Commander Skill  
- Q/E/R/F: fortress abilities  
- WASD: battle camera panning (optional)

---

## 17. Roadmap (Implementation)

### Phase 1 – Prototype
- BattleScene (Preparation + Real-Time)  
- Fortress grid + unit deployment  
- Basic units + AI  
- One test faction  

### Phase 2 – Alpha
- Stage map  
- Waves & node system  
- Deckbuilding  
- 3 factions playable  

### Phase 3 – Beta
- All 9 factions  
- All War Engines  
- Boss fights  
- Relics + events  

### Phase 4 – Launch
- Full 30-node campaign  
- Polish, optimization, SFX + VFX  
- Meta progression  
- Unlock systems  
