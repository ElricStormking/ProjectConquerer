# The Triarch Dominion – Commanders & 42-Card Faction Design (Detailed) v1.1
This document contains the **full detailed design** for the merged faction **The Triarch Dominion**, including:
- **3 Commanders** (passives, actives, playstyle, synergy)
- **42 Cards Total**
  - **21 Commander-specific Unit cards**
  - **21 Shared faction cards** (Structures, Modules, Spells)

> Design goal: Keep commander identity primarily through **Units + Commander skills**, while making **Structures/Modules/Spells** a shared, non-redundant toolkit that supports hybrid decks.

---

## Faction Identity
A unified coalition of **Holy Faith**, **Gunpowder Tactics**, and **Arcane Aetherstorm**.  
The Triarch Dominion excels at **combined-arms warfare**: holding lines with shields/healing, controlling space with fortifications and artillery, and shaping the battlefield with storm magic and area control.

### Faction Sub-Resources
All three resources can exist in the same run; most shared cards are neutral. Certain cards reference a sub-resource when used by the matching commander.
- **Faith** (Holy)
- **Tactical Orders** (Gunpowder)
- **Aetherstorm** (Arcane)

---

# =======================================
# 1. COMMANDERS (3)
# =======================================

## Commander 1 – High Templar **Valerius Dawnward**
**Role:** Holy frontline commander (buffs, healing, shields, melee AoE)  
**Core Fantasy:** “Hold the line, heal through the storm, then smite.”

### Passive – **Aura of Sacred Resolve**
Radius: **4 tiles**
- Allies gain **+15% Damage Reduction**
- Allies gain **+20% Healing Received**
- Every **4s**, allies in aura gain **1 Holy Charge** (max 5)
  - At **5 charges**, the ally’s next attack triggers **Holy Burst** (2-tile AoE, moderate holy damage)
- Whenever an ally is healed (any source) → **+1 Faith** (internal cooldown per unit: 2s)

### Active – **Judgment of the Dawn**
Cooldown: **20s** | Targeting: ground target (3-tile radius)
- Valerius leaps to target area and releases a **Holy Shockwave**
  - Deals **200% ATK Holy Damage** in AoE
  - **Stuns undead/demonic** targets for **1.5s** (others: stagger 0.3s)
  - Cleanses debuffs from allies in the area
  - Grants **Holy Barrier**: **15% Max HP shield** for allies hit (6s)
  - Allies gain **+25% Attack** for **5s**

### Playstyle & Synergy
- Best with **melee + sustain** unit packs
- Uses shared cards to create a **defensive kill-zone** (Healing Beacon + Lightbringer Tower + Smoke Screen)
- Counters poison/DoT factions via cleanse and healing stacking

---

## Commander 2 – Marshal **Elara Blackiron**
**Role:** Tactical ranged commander (artillery, suppression, defenses, precision)  
**Core Fantasy:** “Mark targets, hold angles, and delete waves with coordinated fire.”

### Passive – **Battlefield Command Network**
- Creates up to **3 Command Zones** (automatic, 1 every 15s)
  - Zone radius: **4 tiles**
- Units inside a Command Zone gain:
  - **+15% Ranged Attack Speed**
  - **+10% Accuracy**
  - Turrets gain **+10% Fire Rate**
- Kills scored by allies inside a zone → **+1 Tactical Orders** (max 1 per second)

### Active – **Grand Bombardment Protocol**
Cooldown: **22s** | Targeting: large ground area (approx. 6-tile radius)
- **3s** target lock telegraph (enemies slowed **20%** in area)
- Fires **5 artillery shells** over 2.5s
  - Each shell deals heavy AoE impact damage
  - Center hits deal **+50%** damage
  - Minor knockback per hit
- For each enemy killed by the barrage → reduce next cooldown by **2s** (max 10s)

### Playstyle & Synergy
- Builds **gunlines + zones** using shared structures (Machine Gun Nest + Cannon Turret + Field Command Post)
- Pairs with Rex’s **pull/slow** to maximize bombardment density (Arcane Tornado + Storm Generator)

---

## Commander 3 – Archmagister **Rex Aetherfall**
**Role:** Arcane controller (lightning AoE, storm zones, flying pressure)  
**Core Fantasy:** “Storm magic that shapes lanes, clumps enemies, and detonates waves.”

### Passive – **Aetherstorm Overcharge**
- Spell casts and lightning hits generate **Aetherstorm Sparks**
- Every **5 Sparks** triggers **Aether Pulse**:
  - Chain lightning jumps to **5 enemies**
  - Applies **30% slow** for **2s**
  - Allies gain **+10% Spell Damage** for **5s**
- Flying units gain **+15% Move Speed** and **+10% Dodge**

### Active – **Skyfall Cataclysm**
Cooldown: **24s** | Targeting: ground (4-tile radius)
- Phase 1: Arcane seal appears; enemies inside slowed **20%**
- Phase 2 (after 1s): Lightning storm strikes multiple times
  - First target hit is **stunned 1.0s**
- Phase 3: Arcane vortex persists for **4s**
  - Pulls enemies inward
  - Deals magic DoT
- If **10+ enemies** are hit total → refund **50%** cooldown

### Playstyle & Synergy
- Wants enemies **grouped** and **stuck** in zones (Storm Generator + Arcane Tornado + Chain Lightning)
- Supports hybrid decks by amplifying AoE and enabling Elara’s artillery

---

# =======================================
# 2. CARDS (42 TOTAL)
# =======================================

## Card Rules (Global Assumptions)
- **Cost**: general deployment cost (can be interpreted as energy/mana/command points)
- **Tiles**: assumes fortress placement grid and battle lanes; ranges are expressed in tiles
- **Status** definitions:
  - **Stun**: cannot act
  - **Stagger**: brief interruption without full stun
  - **Blind**: reduced accuracy
  - **Suppression**: reduced attack speed and/or aim

---

# ---------------------------------------
# 2A. UNIT CARDS (21) – Commander-Specific
# ---------------------------------------

## Valerius Dawnward Units (8)

### 1) Zealot Duelist — **Cost 2**
**Role:** fast melee DPS / holy striker  
- High attack speed melee unit
- Every **4th hit** triggers **Holy Fire Strike**: small cleave AoE (1-tile radius)
- Gains **+10% damage** while under **Holy Barrier**

### 2) Acolyte Healer — **Cost 2**
**Role:** single-target healer / Faith generator  
- Heals lowest-HP ally in range every 2s (small heal)
- Every **6s** generates **+1 Faith**
- Prioritizes allies with **no shield**

### 3) Priestess of Dawn — **Cost 3**
**Role:** cone healer / cleanse support  
- Cone healing every 3s (medium heal)
- **Cleanses** one debuff from an ally every **10s**
- If healing hits 3+ allies → grants **+10% DR** for 3s

### 4) Crusader Shieldbearer — **Cost 3**
**Role:** frontline tank / anti-ranged wall  
- Projects a forward **shield cone** reducing incoming ranged damage by **30%**
- Taunts nearby enemies every 8s (short taunt)
- On taking heavy burst, triggers **Shield Bash** (stagger 0.4s)

### 5) Radiant Knight — **Cost 3**
**Role:** melee bruiser / healing-synergy DPS  
- Gains **+10% damage per healed ally nearby** (max +30%)
- Emits **Radiant Aura**: light DoT to enemies within 1 tile
- Strong vs clustered melee swarms

### 6) Seraph Guardian — **Cost 4**
**Role:** elite melee controller  
- Wide 360° swings (AoE melee)
- Every **5th swing**: **Stun 1.2s** in 2-tile radius
- Receives **+20% healing** from all sources

### 7) Dawnbreaker Charger — **Cost 4**
**Role:** cavalry disruptor / engager  
- Performs a **Charge** on first contact
  - Knockback 2 tiles
  - Stun (weak) 0.5s on non-elite units
- After charge, gains +15% attack speed for 5s

### 8) Archon of Light — **Cost 5**
**Role:** flying holy construct / anti-slow  
- Flying; immune to slows
- Ranged holy bolts that pierce 1 target
- Periodic **Shockwave** every 10s: small AoE stagger

---

## Elara Blackiron Units (6)

### 9) Rifleman Squad — **Cost 2**
**Role:** core ranged DPS  
- Moderate DPS rifle fire
- Gains +10% accuracy near **Field Command Post**
- Prioritizes marked / lowest-HP enemies

### 10) Sniper Elite — **Cost 3**
**Role:** long-range execution  
- Very long range, slow fire rate
- Deals **+50% damage** to **Marked** targets (from Field Command Post aura rules or future marks)
- First shot against elite targets applies **Armor Crack** (-10% DR for 4s)

### 11) Shield Trooper — **Cost 2**
**Role:** defensive infantry / cover  
- Creates portable cover angle (reduced ranged damage for allies behind)
- Short-range pistol fire
- On taking heavy ranged damage, throws **flash charge** (stagger 0.3s)

### 12) Mortar Team — **Cost 4**
**Role:** indirect AoE artillery  
- Arcing shots; effective vs backline and clumps
- Each hit applies **Suppression** (-10% attack speed) for 2s
- Strong synergy with **Arcane Tornado** and **Storm Generator**

### 13) Firethrower Unit — **Cost 3**
**Role:** anti-swarm / area denial  
- Short-range flame cone DoT
- Applies **Scorch**: enemies take +10% damage for 3s
- Good at clearing small/fast units

### 14) Heavy Siege Walker — **Cost 6**
**Role:** late-game siege anchor  
- Large walker with cannon and stomp
- Cannon: heavy AoE impact damage (slow reload)
- Stomp every 12s: knockback + stagger (0.4s)
- Vulnerable to concentrated anti-armor (future system)

---

## Rex Aetherfall Units (7)

### 15) Lightning Sorcerer — **Cost 3**
**Role:** chain AoE caster  
- Chain lightning basic attack (jumps up to 3)
- Applies **15% slow** on hit for 2s
- Generates extra Aetherstorm Sparks on multi-hit

### 16) Aether Golem — **Cost 4**
**Role:** floating construct bruiser  
- Midline durable unit
- Charges **Aether Burst** every 6s: AoE magic burst
- Explodes on death (small AoE) if empowered by Lightning Amplifier Crystal

### 17) Mana Siphon Adept — **Cost 2**
**Role:** anti-caster utility  
- Drains enemy energy (reduces enemy skill frequency – abstract)
- Applies **Weaken**: -10% spell damage for 4s
- Helps stabilize against mage-heavy enemy waves

### 18) Arcane Bomber Drone — **Cost 3**
**Role:** flying AoE pressure  
- Flying; drops bombs in small AoE
- Bombs apply **Static**: enemies take +10% lightning damage for 4s
- Great for stacked wave lanes

### 19) Mystic Sentinel — **Cost 3**
**Role:** support caster / control  
- Periodic **Shield Pulse** to nearest ally (small barrier)
- Casts **Stun Wave** every 10s: short stun 0.6s in a line
- Supports hybrid defensive builds

### 20) Aether Archer — **Cost 2**
**Role:** piercing ranged magic  
- Piercing arcane arrows
- Bonus damage vs shielded enemies (breaks barriers faster)
- Great for finishing targets clustered in tornado

### 21) Stormcaller Priest — **Cost 3**
**Role:** spell amplifier / aura support  
- Aura: +10% spell damage to nearby allies
- Periodic **Charge Spark**: grants Aetherstorm Sparks to Rex
- Low direct DPS; high scaling utility

---

# ---------------------------------------
# 2B. SHARED STRUCTURES (8)
# ---------------------------------------

### 22) Field Command Post — **Cost 3**
**Type:** buff structure / tactical hub  
- Aura (4 tiles): +10% accuracy, +10% ranged attack speed
- If Elara is your active commander: also generates **+1 Tactical Orders every 8s**
- Visual: command flags, map table, signal lantern

### 23) Healing Beacon — **Cost 2**
**Type:** sustain structure  
- Pulses heal every 2s in 3-tile radius (small heal)
- If Valerius is active: generates **+1 Faith every 10s**
- Prioritizes allies below 50% HP

### 24) Lightbringer Tower — **Cost 3**
**Type:** long-range piercing holy turret  
- Fires a beam every 2.5s
- Beam pierces 1 target, minor slow 10% for 1.5s
- Strong vs armored single targets

### 25) Cannon Turret — **Cost 4**
**Type:** AoE siege turret  
- Fires explosive shells (AoE 2 tiles)
- Applies **stagger 0.2s** to basic units in blast
- Great wave clearer when enemies are clumped

### 26) Machine Gun Nest — **Cost 3**
**Type:** sustained DPS / suppression  
- Rapid fire at nearest enemies
- Applies **Suppression**: -10% attack speed for 2s (refreshing)
- Strong against swarms and light armor

### 27) Aether Tower — **Cost 4**
**Type:** lightning chain turret  
- Chain lightning bolts jump up to 3 targets
- Generates Aetherstorm Sparks if Rex is active
- Best paired with Lightning Amplifier Crystal

### 28) Mana Fountain — **Cost 2**
**Type:** spell economy support  
- Grants nearby casters faster ability cadence (abstract “mana regen”)
- Improves spell uptime and mage performance
- Encourages caster-centric builds

### 29) Storm Generator — **Cost 4**
**Type:** zone control structure  
- Creates storm zone (3-tile radius) for 8s
  - Enemies slowed 25%
  - Low DoT damage
- Great for forcing enemies to clump and slow-walk through kill zones

---

# ---------------------------------------
# 2C. SHARED MODULES (7)
# ---------------------------------------

### 30) Advanced Optics Node
**Type:** range amplifier module  
- +20% range to ranged units and turrets spawned/placed adjacent
- Increases battlefield coverage, supports gunlines

### 31) Reload Synchronizer
**Type:** fire-rate module  
- +15% attack speed to firearms and turrets in adjacency radius
- Encourages fortress layout planning (weapon clusters)

### 32) Holy Barrier Matrix
**Type:** defensive spawn module  
- Units spawned on adjacent tiles gain **10% HP shield** (6s)
- Stacks well with Valerius sustain and hybrid defense

### 33) Faith / Aether Conduit
**Type:** resource generator module  
- Generates commander-aligned resource over time:
  - If Valerius active → Faith
  - If Rex active → Aetherstorm Sparks
  - If Elara active → Tactical Orders (reduced rate)
- Enables multi-commander decks without dead draws

### 34) Spellweaver Rune Grid
**Type:** AoE geometry module  
- +20% AoE radius to spells cast while within 4 tiles of module
- Strong for tornado + bombardment + storm zones

### 35) Lightning Amplifier Crystal
**Type:** damage amplifier module  
- +20% lightning/magic damage to lightning-tag attacks
- Improves chain lightning, Aether Tower, Lightning Sorcerer

### 36) Detection Grid
**Type:** stealth counter module  
- Reveals stealth enemies within 5 tiles
- Reduces enemy dodge in area by 10% (optional tuning)

---

# ---------------------------------------
# 2D. SHARED SPELLS (6)
# ---------------------------------------

### 37) Radiant Burst — **Cost 2**
**Role:** AoE damage + accuracy control  
- AoE holy explosion (3-tile radius)
- Applies **Blind**: -20% accuracy for 3s
- Great vs ranged-heavy waves

### 38) Spirit Mend — **Cost 1**
**Role:** emergency heal  
- Heal a target ally for moderate amount
- Grants +10% damage reduction for 3s
- Enables clutch saves on tanks and siege units

### 39) Tactical Airstrike — **Cost 3**
**Role:** high-impact AoE nuke  
- Large AoE bombardment line or circle (implementation choice)
- Heavy damage, strong vs clumped waves
- Best combo: Storm Generator + Arcane Tornado

### 40) Smoke Screen — **Cost 2**
**Role:** defensive utility / reposition  
- Creates smoke zone (3 tiles) for 6s
  - Allies inside: +25% dodge/evasion
  - Enemies inside: -30% accuracy
- Supports both gunlines and holy sustain plays

### 41) Chain Lightning — **Cost 2**
**Role:** multi-target spell DPS  
- Hits up to 5 targets, increasing damage each jump slightly
- Applies minor slow 10% for 2s
- Generates Aetherstorm Sparks for Rex

### 42) Arcane Tornado — **Cost 3**
**Role:** pull + DoT control  
- Creates a vortex for 4s
  - Pulls enemies inward
  - Deals DoT
- Primary setup tool for artillery and AoE towers

---

# =======================================
# 3. QUICK REFERENCE COUNTS
# =======================================
- **Units:** 21 (commander-specific)
- **Structures:** 8 (shared)
- **Modules:** 7 (shared)
- **Spells:** 6 (shared)
- **Total:** 42

---
---

## Commander IDs (for design & code)
- **VALERIUS** – High Templar Valerius Dawnward (Holy / Faith)
- **ELARA** – Marshal Elara Blackiron (Tactical / Gunpowder)
- **REX** – Archmagister Rex Aetherfall (Arcane / Aetherstorm)
- **TRIARCH_SHARED** – Shared across all commanders

---

# =======================================
# COMMANDER OWNERSHIP MAP
# =======================================

## UNIT CARDS (Commander-Specific)

### VALERIUS – Holy / Faith
- Zealot Duelist
- Acolyte Healer
- Priestess of Dawn
- Crusader Shieldbearer
- Radiant Knight
- Seraph Guardian
- Dawnbreaker Charger
- Archon of Light

### ELARA – Tactical / Gunpowder
- Rifleman Squad
- Sniper Elite
- Shield Trooper
- Mortar Team
- Firethrower Unit
- Heavy Siege Walker

### REX – Arcane / Aetherstorm
- Lightning Sorcerer
- Aether Golem
- Mana Siphon Adept
- Arcane Bomber Drone
- Mystic Sentinel
- Aether Archer
- Stormcaller Priest

---

## STRUCTURES (TRIARCH_SHARED)
- Field Command Post
- Healing Beacon
- Lightbringer Tower
- Cannon Turret
- Machine Gun Nest
- Aether Tower
- Mana Fountain
- Storm Generator

---

## MODULES (TRIARCH_SHARED)
- Advanced Optics Node
- Reload Synchronizer
- Holy Barrier Matrix
- Faith / Aether Conduit
- Spellweaver Rune Grid
- Lightning Amplifier Crystal
- Detection Grid

---

## SPELLS (TRIARCH_SHARED)
- Radiant Burst
- Spirit Mend
- Tactical Airstrike
- Smoke Screen
- Chain Lightning
- Arcane Tornado

---

# NOTE FOR IMPLEMENTATION
- Unit cards are **hard-locked** to their commander.
- Shared cards may have **bonus effects** if used with their thematic commander.
- UI should filter cards by:
  - `commander == ACTIVE_COMMANDER`
  - `commander == TRIARCH_SHARED`

# END OF DOCUMENT
