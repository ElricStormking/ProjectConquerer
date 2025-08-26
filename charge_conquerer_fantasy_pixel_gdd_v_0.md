# Charge Conquerer — Fantasy Pixel GDD v0.3
_Physics-based battle simulation • top-down isometric • 2.5D pixel art • strategy + tactics • Phaser 3 (Matter.js) • Mobile WebGL • 30 FPS lock_

### High Concept
A physics‑first, isometric, fantasy pixel‑art tactics sandbox. Players assemble an army from **owned unit cards**, place them on a 2:1 isometric field, then hit **Simulate** to watch **exaggerated physics**—knockback, blast waves, collapses, grease slides, ricochets—decide the battle. During the fight, units collect **XP orbs** and roll **Vampire Survivors–style** skills; each unit’s **star rank** sets its in‑battle **level cap**. Win objectives to earn **chests & shards**, raise star ranks, and unlock new builds.

**Design Pillars**
1. **Physics over raw DPS** — mass, momentum, and map toys drive outcomes.
2. **Readable chaos** — clear previews, overlays, impulse arrows, and short callouts.
3. **Player‑authored outcomes** — pre‑battle **Tactics Rules** + **Pause/Slow‑Mo** mid‑battle.
4. **Toybox fantasy** — barrels, fans, rope bridges, magnets; everything interacts.
5. **Mobile‑first** — tight budgets, circular colliders, 30 FPS lock.

---

## 0) Vision & Tone
- **World**: slapstick high‑fantasy toybox (goblins with rockets, dwarven barrel‑bombs, sheep‑catapults, mis-aiming wizards).
- **Tone**: **comedic physics** (springy ragdolls, over-the-top knockback), with clear tactical reads.
- **Player Fantasy**: compose a quirky army, press **Simulate**, then pause/slow‑mo to outsmart chaos.
- **Exaggerated physics by faction**:
  - **Goblins (Trickster/Blast)**: high restitution, large knockback dealt & taken.
  - **Dwarves (Steel/Siege)**: heavy mass, low bounce, high stagger resistance.
  - **Sylphs (Air/Control)**: light mass, extra effect from wind/fans.
  - **Trolls (Brawler/Nature)**: very high mass, huge impact impulses, slow regen.
  - **Mages (Fire/Shadow/Holy)**: lighter bodies; projectile impulses scale; risk self‑stagger on big casts.
- **Colliders**: units use **circular/sphere** colliders by default for stability & performance; siege/large props may use compound rects.

**Comparable**: TABS (sandbox mayhem) × Vampire Survivors (mid-battle level‑ups) × Clash Royale (shard/star card meta).

---

## 1) Camera, View & 2.5D Pixel Look
- **Projection**: isometric 2:1 diamond; orthographic camera; y‑sort layering.
- **Pixel sizes**: iso tile **32×16**; unit base **32×32** (elites 48×48).
- **2.5D tricks**: per‑sprite `height` for hops/knockback; blob shadow scales with height; minimal Lights2D pulses for explosions.
- **Occlusion**: tall props fade; obscured unit outline.
- **Mobile input**: one‑finger pan, two‑finger zoom, long‑press radial orders, double‑tap quick order.

---

## 2) Core Loop
1) **Plan**: choose mission → assemble from **owned unit cards** in the player’s inventory → place units → slot **Tactics Rules** (3–5).

**Deployment caps & slots (mission rules)**
- **TotalSlots** per mission (e.g., 12) and **SlotSize** per unit (Small=1, Medium=2, Large=3).
- **Class Caps** per mission (Frontline/Ranged/Support/**Siege/Summoner**).
- **Elite Limits**: Legendary/Elite units are **unique (max 1)** unless overridden; Epic **max 2**.
- **Reinforcements** optional; must respect remaining slots; pre‑placed allies may be **Free** or consume slots.
- **Army Setup UX**: HUD shows remaining **Total** and **Class** slots; invalid placements blocked with reason tooltip.

2) **Simulate**: physics + AI run; player may **Pause / 0.5×** to issue orders.
3) **Level‑ups (VS‑style)**: units collect XP orbs; at thresholds, pick **1 of 3** skills/perks (reroll/banish limited).
4) **Resolve**: objective check → rewards (gold + chest) → unit shard accrual → **star‑rank** upgrades unlock higher max level.

---

## 3) Systems Overview
### 3.1 Physics (Matter.js)
- **Bodies & Shapes**: circular colliders for units; simple rects for cover; compound only for siege/large props.
- **Friction/Restitution**: μ per biome; restitution tuned per faction (see §0). Aggressive sleeping; damping scales with mass.
- **Impulses & Morale** (design formula):
  - **Impulse** = m × |Δv|
  - **Stagger** = clamp( Impulse / (m × stability), 0, Smax )
  - **Morale loss** = k_morale × Stagger
- **Blast waves**: 1/r² force; line‑of‑sight rays; partial cover reduces force.
- **Breakables**: stress thresholds → fracture into pooled debris (TTL, shard caps per map).
- **Fake Height**: hops/knockbacks adjust `height`; shadows scale; falls cause damage.

### 3.2 Combat & Facing
- Damage from weapons + collisions + hazards + falls.
- **Armor facings** (front/side/rear multipliers); **ricochet** chance by incidence angle.
- Status: **Suppressed**, **Snared** (joint), **Greased** (μ↓), **Burning**, **Dazed**.

### 3.3 Orders, AI & Tactics Rules
- Orders: move, face, hold, focus fire, ability, rally.
- **Tactics Rules** (pre‑battle conditionals): e.g., *If HP < 30% → Retreat to RP‑A*; *If enemy mass ≥ 2× in Zone‑1 → cast Gravity Net*; *On Kill → Advance 3 tiles*.
- **AI**: utility scores (safety, shot quality, objective pressure, cohesion, threat proximity); micro avoids blast cones, braces before impact, seeks flanks.

---

## 4) Fantasy Army — MVP Roster
| Unit | Role | Base px | Mass | Stability | Armor F/S/R | Speed | Tags | Signature |
|---|---|---:|---:|---:|---|---:|---|---|
| **Knight Vanguard** | Frontline pusher | 32 | 1.4 | 0.8 | 0.7/0.4/0.2 | 3.3 | Steel, Control | 70° cone slam (stagger) |
| **Elven Arbalest** | Pierce DPS | 32 | 1.0 | 0.6 | 0.2/0.2/0.1 | 3.8 | Precision | Knockback + armor‑pierce |
| **Goblin Sapper** | Traps/AoE | 32 | 1.0 | 0.5 | 0.2/0.2/0.2 | 3.6 | Trickster, Blast | Demolish cover; bait & boom |
| **Dwarf Bombardier** | Artillery | 48 | 1.5 | 0.7 | 0.4/0.3/0.2 | 2.8 | Siege, Blast | Arc barrels; chain reactions |
| **Troll Bruiser** | Heavy brawler | 48 | 1.8 | 0.9 | 0.6/0.4/0.3 | 3.0 | Nature, Brawler | Big knockback; slow self‑heal |
| **Priest Lumina** | Support | 32 | 0.9 | 0.5 | 0.2/0.3/0.3 | 3.5 | Holy, Aura | Cone cleanse; ward bubble |

**Synergy tags** drive perk pools & auras: **Fire, Frost, Holy, Shadow, Nature, Air, Steel, Siege, Trickster, Precision, Brawler, Control**.

---

## 5) VS‑Style Level‑Up (In‑Battle)
- Units gain **XP orbs** from kills, damage, and objective ticks.
- On threshold, time **freezes**; present **3** choices (weighted by tags & rarity). Choices include **Skills** (A/P), **Upgrades** (stats), and gated **Evolutions**.
- Duplicate skills **rank up** (1→5), increasing potency.

### Level Caps by Star Rank
- ★1 → Lv **5**; ★2 → **8**; ★3 → **10**; ★4 → **12**; ★5 → **15**.
- Star rank grants small base stat bumps and extra rerolls at ★3/★5.

### XP Curve (design)
- `XP(n) = 20 × rarityMult × n^1.45` (Common 1.0, Rare 1.15, Epic 1.3, Legendary 1.5).

---

## 6) Sample Skill Catalog (MVP slice)
**Fire**: Flame Trail (P), Blast Primer (P)

**Air/Control**: Gust Boost (A), Featherweight (P)

**Holy/Aura**: Ward Bubble (A), Sanctify (P)

**Shadow/Minions**: Bone Pile (A), Soul Siphon (P)

**Trickster**: Banana Peel (T), Smoke & Mirrors (A)

**Steel/Brawler**: Brace (P), Spiked Greaves (P)

> Each skill is defined with rarity, ranks 1–5, tags, and effects; numbers live in the data sheet.

---

## 7) Card Meta — Shards → Star Rank
### Rarities & Star Upgrade Costs (design)
| Rarity | Unlock Shards | ★1→★2 | ★2→★3 | ★3→★4 | ★4→★5 |
|---|---:|---:|---:|---:|---:|
| Common | 1 | 5 | 10 | 20 | 50 |
| Rare | 10 | 10 | 20 | 50 | 100 |
| Epic | 20 | 20 | 50 | 100 | 200 |
| Legendary | 50 | 50 | 100 | 200 | 400 |

- Gold cost per star scales quadratically by rarity tier. Duplicates beyond ★5 convert to tokens or gold.

### Chests & Drops (slice)
- **Free Chest** every 8h (stack 2).
- **Silver** 4h: Common x12–20, Rare x2–4, Epic chance 8%.
- **Gold** 8h: richer table, Legendary chance 3%.
- **Event/Focus** 12h: +300% bias toward banner units. **Pity**: 1 Legendary within 40 non‑Legendary opens.

---

## 8) Maps & Toys (Pixel Iso)
- **Biomes**: Timber Fort (wood cover, rope bridges), Quarry (ramps, boulders), Airship Docks (wind fans, spring pads, gaps).
- **Objectives**: Annihilation, Hold the Ridge, Escort, Sabotage, Extraction.

---

## 9) UX / Readability
- **Overlays**: cover, height, blast prediction, LoS, last‑2s impulse arrows.
- **Callouts**: “Shield 34%”, “Bridge Stress 92%”, “Yeet! +2.1 m”.
- **Level‑up UI**: freeze; 3 card choices (rarity frames), Reroll, Banish.
- **Accessibility**: text scale, colorblind palettes, reduced shake, slow‑mo always available.

---

## 10) Data & Authoring (non‑technical)
- Designer‑owned sheets for Units, Skills (ranks), Chests/Economy.
- Fields: unit identity/rarity/star, base stats, weapon spec, tags, skill pool, level caps by star, shard costs by rarity/star.

---

## 11) Performance (mobile)
- **Target**: **30 FPS lock** on baseline (2019+ mid‑range); scale to 60 on high‑end.
- **Bodies** ≤ 160 active (cap 240). **Ragdolls** on death only; TTL 2–3 s; merge/fade.
- **Shapes**: circles/rects; avoid concave; compound only for siege.
- **Fixed physics**: 60 Hz sim; render at 30/60 with interpolation; slow‑mo min 0.5×.
- **LOD**: culling; off‑screen AI at ¼ tick; particle/light LOD scales with FPS. Atlas everything; ≤ 120 draw calls.

---

## 12) Art, Audio & VFX
- **Pixel art**: clean 1–2 px outlines; limited palettes per faction; squash on impacts.
- **Frames**: walk 6–8 (four iso facings); hit/recoil 4; attack 2–4; death = ragdoll swap.
- **Props**: wood/stone cover, barrels (oil/explosive), fans, spring pads, rope bridges.
- **SFX**: honk/slide whistle/kazoo sweeteners with cooldown; materialized impacts.

---

## 13) Tuning Dials
- Global: gravity, μ by material, restitution, blast falloff, structural HP.
- Combat: stagger multiplier, morale resist, suppression decay, accuracy vs movement.
- VS layer: XP curve scalar, choices count, reroll/banish counts, rarity weights, magnet radius.
- Meta: shard yields per chest, pity thresholds, gold curve, star stat bonus per star.

---

## 14) Roadmap
**MVP (Vertical Slice)**: 6 units, 12 skills, 3 maps, 2 objectives, Tactics Rules (8), overlays, death ragdolls, chest rewards.

**v0.9**: Campaign (6–8 missions), Challenges, 2 more units (Necro, Rogue), 25+ skills, Evolutions, Events with focus banners.

**v1.0**: Async PvP ghosts (seed+commands), daily challenges, replay, workshop‑friendly level format.

---

## 15) Decisions (confirmed)
- **Monetization**: chest pricing/timers + **Battle Pass**; **no ads**.
- **Performance**: baseline **30 FPS lock**.
- **Physics tone**: **exaggerated per faction**; units use **sphere/circular** colliders by default.

