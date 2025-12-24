# Commander Active Skills Implementation Plan (Revised)

## Design Constraint
**Commanders do NOT exist as battlefield units.** All active skills are cast from off-screen at a target location (like the existing ThunderStorm prototype). Skills are purely area-targeted effects.

---

## Architecture Changes

### 1. Create Skill Registry System
**File:** `src/systems/CommanderSkillRegistry.ts`
- `ICommanderActiveSkill` interface with `execute(scene, unitManager, targetX, targetY)`
- Registry dispatches by `activeSkillId`

### 2. Refactor CommanderSystem
- Remove hardcoded `castThunderStorm()`
- Dispatch via skill registry

---

## 9 Commander Active Skills (Revised for Off-Screen Cast)

### Jade Dynasty

| Commander | Skill Name | CD | Effect (Target Location) |
|-----------|------------|-----|--------------------------|
| **Long Jin** | Dragon Spear Barrage | 18s | Rain of chi-infused spears at target area. Deals 150% damage, stuns enemies 1s, leaves burning chi trail (DoT zone) for 3s |
| **Hanami Reika** | Shikigami Summoning | 24s | Summons 3 random spirit units at target location for 10s. Spirits fight for player. Healing aura pulses in area |
| **Kasumi Nightwind** | Shadow Clone Ambush | 14s | Spawns 3 shadow clones at target that attack nearby enemies for 5s. Clones taunt and explode on death |

### The Forbidden Bloodline

| Commander | Skill Name | CD | Effect (Target Location) |
|-----------|------------|-----|--------------------------|
| **Azariel (Lich King)** | Soul Blasphemy | 20s | Creates decay zone at target for 8s. Enemies inside take DoT and have healing converted to damage |
| **Bellucci (Blood Queen)** | Sacrificial Feast | 15s | Siphons 30% HP from 2 nearest friendly units to target point. All allies in area gain +50% ATK for 6s |
| **Zhaquille (Frankenstein)** | Flesh Link | 25s | Links all friendly units in radius for 4s. Damage is shared equally. Grants shield = 10% of total linked HP |

### Triarch Dominion

| Commander | Skill Name | CD | Effect (Target Location) |
|-----------|------------|-----|--------------------------|
| **Valerius Dawnward** | Judgment of the Dawn | 20s | Holy explosion at target. 200% holy damage, stuns undead 1.5s, cleanses ally debuffs, grants 15% HP shield to allies in area |
| **Elara Blackiron** | Grand Bombardment | 22s | Artillery strike at target. 3s telegraph warning, then 5 shells rain down over 2.5s with AoE damage + knockback |
| **Rex Aetherfall** | Skyfall Cataclysm | 24s | Lightning storm at target (current prototype). Enhanced: adds 4s vortex that pulls enemies inward + DoT |

---

## Skill Categories

All skills now fall into these patterns (no commander unit required):

1. **AoE Damage Zone** - ThunderStorm, Dragon Spear Barrage, Judgment, Bombardment
2. **Summon at Location** - Shikigami Summoning, Shadow Clone Ambush
3. **Buff/Debuff Zone** - Soul Blasphemy, Sacrificial Feast, Flesh Link
4. **Persistent Zone** - Chi trail, Decay zone, Vortex pull

---

## File Structure

```
src/
  systems/
    CommanderSystem.ts           # Refactor dispatch
    CommanderSkillRegistry.ts    # NEW: Skill registry
    skills/
      index.ts
      JadeDynastySkills.ts       # DragonSpearBarrage, ShikigamiSummoning, ShadowCloneAmbush
      ForbiddenBloodlineSkills.ts # SoulBlasphemy, SacrificialFeast, FleshLink
      TriarchDominionSkills.ts   # JudgmentOfDawn, GrandBombardment, SkyfallCataclysm
```

---

## Implementation Priority

1. **Registry + Refactor** - Create dispatch system
2. **Triarch Skills** - Migrate existing ThunderStorm, add 2 more
3. **Jade Dynasty Skills** - Summoning requires UnitManager integration
4. **Bloodline Skills** - HP manipulation requires unit stat access

---

## Key Interface

```typescript
export interface ICommanderActiveSkill {
  id: string;
  name: string;
  description: string;
  
  execute(
    scene: Phaser.Scene,
    unitManager: UnitManager,
    targetX: number,
    targetY: number
  ): void;
}
```

---

## Estimated Time: ~10-12 hours

Proceed with implementation?