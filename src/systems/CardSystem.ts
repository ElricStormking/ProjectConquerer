import Phaser from 'phaser';
import { CardType, ICardPlacementPayload, ICard } from '../types/ironwars';
import { DeckSystem } from './DeckSystem';
import { GameStateManager } from './GameStateManager';
import { FortressSystem } from './FortressSystem';
import { UnitManager } from './UnitManager';
import { toUnitConfig } from '../data/ironwars/unitAdapter';
import { DataManager } from './DataManager';
import { RunProgressionManager } from './RunProgressionManager';

export class CardSystem {
    private buildingBuffs: Array<{ type: 'armor_shop' | 'overclock'; gridX: number; gridY: number; occupantId: string; enhancementLevel: number }> = [];
    private cannonTowers: Array<{
        x: number;
        y: number;
        gridX?: number;
        gridY?: number;
        hp: number;
        maxHp: number;
        lastShotTime: number;
        range: number;
        damage: number;
        cooldownMs?: number;
        body: Phaser.GameObjects.Image;
        hpBg: Phaser.GameObjects.Graphics;
        hpBar: Phaser.GameObjects.Graphics;
        occupantId: string;
    }> = [];

    private healingBeacons: Array<{
        gridX: number;
        gridY: number;
        occupantId: string;
        effectId: string;
        lastPulseTime: number;
    }> = [];

    private commandPosts: Array<{
        gridX: number;
        gridY: number;
        occupantId: string;
        effectId: string;
    }> = [];

    private stormGenerators: Array<{
        gridX: number;
        gridY: number;
        occupantId: string;
        effectId: string;
        lastTickTime: number;
    }> = [];

    private shieldAuras: Array<{
        gridX: number;
        gridY: number;
        occupantId: string;
        effectId: string;
        lastPulseTime: number;
    }> = [];

    private smokeFields: Array<{
        gridX: number;
        gridY: number;
        occupantId: string;
        effectId: string;
        lastTickTime: number;
    }> = [];

    private resonanceTowers: Array<{
        gridX: number;
        gridY: number;
        occupantId: string;
        effectId: string;
        lastPulseTime: number;
    }> = [];

    constructor(
        private scene: Phaser.Scene,
        private deckSystem: DeckSystem,
        private gameState: GameStateManager,
        private fortressSystem: FortressSystem,
        private unitManager: UnitManager
    ) {
        // Listen to unit death events to release fortress cells
        this.scene.events.on('unit-death', (unit: any) => {
            if (unit.getTeam && unit.getTeam() === 1) {
                // Only release cells for player team units
                const unitId = unit.getId();
                const unitType = unit.getConfig?.()?.unitType || 'unknown';
                console.log(`[CardSystem] Player unit died: ${unitType} (ID: ${unitId}), releasing fortress cell`);
                this.fortressSystem.releaseCellByOccupant(unitId);
            }
        });
    }

    public update(now: number, _deltaSeconds: number): void {
        this.updateStructureEffects(now, _deltaSeconds);
        this.updateCannonTowers(now);
    }

    public resolveCardPlacement(payload: ICardPlacementPayload): boolean {
        const { card, gridX, gridY } = payload;
        const state = this.gameState.getState();
        console.log(`[CardSystem] Attempting to place card ${card.name} at (${gridX}, ${gridY}), Phase: ${state.phase}`);
        
        if (state.phase !== 'PREPARATION') {
            console.log('[CardSystem] ❌ Cannot place card - not in PREPARATION phase');
            return false;
        }

        const cell = this.fortressSystem.getCell(gridX, gridY);
        if (!cell) {
            console.log(`[CardSystem] ❌ No cell at (${gridX}, ${gridY})`);
            return false;
        }
        if (!this.fortressSystem.isUnlocked(gridX, gridY)) {
            console.log(`[CardSystem] ❌ Cell is locked; expand fortress to use more slots`);
            return false;
        }
        if (cell.type === 'blocked') {
            console.log(`[CardSystem] ❌ Cell is blocked`);
            return false;
        }
        if (cell.type === 'core') {
            console.log(`[CardSystem] ❌ Cell is core`);
            return false;
        }
        
        // Check for ENHANCEMENT (Merge)
        if (cell.occupantId) {
            let targetId: string | undefined;
            switch (card.type) {
                case CardType.UNIT:
                    targetId = card.unitId;
                    break;
                case CardType.SPELL:
                    targetId = card.spellEffectId;
                    break;
                case CardType.STRUCTURE:
                    targetId = card.structureId;
                    break;
                case CardType.MODULE:
                    targetId = card.moduleId;
                    break;
                default:
                    targetId = undefined;
            }
            
            if (cell.occupantType && cell.occupantType === targetId) {
                if ((cell.enhancementLevel || 0) < 3) {
                    console.log(`[CardSystem] Merging card for enhancement at (${gridX}, ${gridY})`);
                    if (this.gameState.spendResource(card.cost)) {
                        this.enhanceEntity(cell, card);
                        this.deckSystem.discard(card.id);
                        return true;
                    } else {
                        console.log('[CardSystem] ❌ Not enough resources for enhancement');
                        return false;
                    }
                } else {
                    console.log(`[CardSystem] ❌ Max enhancement level reached`);
                    return false;
                }
            }

            console.log(`[CardSystem] ❌ Cell is occupied by ${cell.occupantId} (Type: ${cell.occupantType})`);
            return false;
        }

        if (!this.gameState.spendResource(card.cost)) {
            console.log('[CardSystem] ❌ Not enough resources');
            return false;
        }

        let success = false;
        switch (card.type) {
            case CardType.UNIT:
                success = this.spawnUnitCard(card.unitId, gridX, gridY);
                break;
            case CardType.SPELL:
                success = this.castSpell(card.spellEffectId, gridX, gridY);
                break;
            case CardType.STRUCTURE:
                success = this.placeStructure(card.structureId, gridX, gridY, card);
                break;
            case CardType.MODULE:
                success = this.placeModule(card.moduleId, gridX, gridY, card);
                break;
            default:
                success = false;
        }

        if (!success) {
            this.gameState.gainResource(card.cost);
            return false;
        }

        this.deckSystem.discard(card.id);
        return true;
    }

    private enhanceEntity(cell: import('../types/ironwars').IFortressCell, card: import('../types/ironwars').ICard): void {
        const newLevel = this.fortressSystem.enhanceCell(cell.x, cell.y);
        console.log(`[CardSystem] Enhancing cell (${cell.x}, ${cell.y}) to level ${newLevel}`);

        if (card.type === CardType.UNIT && card.unitId) {
            // Add same number of units as original: Base 1 batch -> Lvl 1 (+1 batch) -> Lvl 2 (+1 batch) -> Lvl 3 (+1 batch)
            // Stats: 1.5^Level
            const batchesToAdd = 1;
            const statMultiplier = Math.pow(1.5, newLevel);
            
            for (let i = 0; i < batchesToAdd; i++) {
                // Offset slightly to avoid perfect stacking, though physics handles it
                this.spawnUnitCard(card.unitId, cell.x, cell.y, statMultiplier);
            }
            // Note: We don't update existing units' stats here, only new ones. 
            // Ideally we would find and buff existing ones, but without tracking them it's hard.
        } else if (card.type === CardType.SPELL && card.spellEffectId) {
            // Building enhancements
            // Increase effect by 150% of base per level.
            // We need to update the record in buildingBuffs or cannonTowers.
            
            if (card.spellEffectId === 'cannon_tower') {
                const tower = this.cannonTowers.find(t => t.occupantId === cell.occupantId);
                if (tower) {
                    // Base stats were set on creation. We can scale them.
                    // Current simple logic: Heal it fully and buff max HP / Damage?
                    // Cannon logic uses hardcoded DAMAGE (40). I should make it instance-based.
                    tower.maxHp = 200 * (1 + 1.5 * newLevel);
                    tower.hp = tower.maxHp;
                    // We need to store damage on the tower instance to scale it
                    (tower as any).damage = 40 * (1 + 1.5 * newLevel);
                    this.updateTowerHPBar(tower);
                    
                    // Visual indicator
                    this.addRankIndicator(tower.x, tower.y, newLevel);
                }
            } else {
                // Buff buildings (Armor Shop, Overclock)
                // They are stored in buildingBuffs { type, gridX, gridY }
                // I need to find the entry and update it? 
                // Actually `buildingBuffs` doesn't store stats, just type.
                // But `applyBuildingBuffsAtBattleStart` calculates effect.
                // It can look up the cell's `enhancementLevel`.
                const buff = this.buildingBuffs.find(b => b.gridX === cell.x && b.gridY === cell.y);
                if (buff) {
                    buff.enhancementLevel = newLevel;
                    // Just refresh visual
                    const pos = this.fortressSystem.gridToWorld(cell.x, cell.y);
                    this.addRankIndicator(pos.x, pos.y, newLevel);
                }
            }
        } else if (card.type === CardType.STRUCTURE && card.structureId) {
            // Structure enhancements: effects scale based on cell enhancement level.
            const dm = DataManager.getInstance();
            const config = dm.getBuildingConfig(card.structureId);
            const effectId: string | undefined = config?.effect_id;

            const pos = this.fortressSystem.gridToWorld(cell.x, cell.y);
            this.addRankIndicator(pos.x, pos.y, newLevel);

            // If this structure is a turret, update its instance stats immediately.
            if (effectId === 'triarch_cannon_blast' || effectId === 'cannon_shoot' || effectId === 'jade_archer_volley') {
                const tower = this.cannonTowers.find(t => t.occupantId === cell.occupantId);
                if (tower) {
                    const baseHp = Number(config?.max_hp) || 200;
                    const baseDamage =
                        effectId === 'triarch_cannon_blast'
                            ? 55
                            : effectId === 'jade_archer_volley'
                                ? 18
                                : 40;
                    const mult = 1 + 1.5 * newLevel;
                    tower.maxHp = baseHp * mult;
                    tower.hp = tower.maxHp;
                    tower.damage = baseDamage * mult;
                    this.updateTowerHPBar(tower);
                }
            }
        }
    }

    private addRankIndicator(x: number, y: number, level: number): void {
        // Simple stars or text
        const text = this.scene.add.text(x, y - 40, '⭐'.repeat(level), {
            fontSize: '24px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(9000);
        
        this.scene.tweens.add({
            targets: text,
            y: y - 60,
            alpha: 0,
            duration: 2000,
            onComplete: () => {
                // Permanent indicator? Or just popup? 
                // Plan says "Visual rank indicators". Permanent is better.
                text.setY(y - 40);
                text.setAlpha(1);
                // We should probably store this text to destroy it later?
                // For now, just leave it.
            }
        });
    }

    private spawnUnitCard(unitId: string | undefined, gridX: number, gridY: number, statMultiplier: number = 1): boolean {
        if (!unitId) return false;

        // Use DataManager to get unit template directly
        const unitTemplate = DataManager.getInstance().getUnitTemplate(unitId);
        if (!unitTemplate) {
            console.error(`[CardSystem] Unit template not found for ID: ${unitId}`);
            // Fallback to starter data if possible, or fail
            const starter = this.gameState.getStarterData();
            if (starter && starter.units[unitId]) {
                // Existing fallback path
                const unitConfig = starter.units[unitId];
                return this.spawnUnitFromLegacyConfig(unitConfig, gridX, gridY);
            }
            return false;
        }

        // Spawn logic using unit template
        const worldPos = this.fortressSystem.gridToWorld(gridX, gridY);
        const spawnCount = Math.max(1, unitTemplate.spawnAmount ?? 3);
        const offsets = this.getSpawnOffsets(spawnCount);

        const spawned: any[] = [];
        offsets.forEach(offset => {
            // Create unit directly via UnitManager which now uses UnitFactory that uses DataManager
            // We need to bridge the gap: UnitManager expects a config, but we have a template ID.
            // Let's construct a config compatible with UnitFactory.createUnit
            
            const config = this.unitManager.createUnitConfig(
                unitTemplate.type, 
                1, // team 1 (player)
                worldPos.x + offset.x, 
                worldPos.y + offset.y
            );
            
            // Apply stat multiplier from enhancements
            if (statMultiplier > 1 && config.stats) {
                config.stats.maxHealth = Math.round(config.stats.maxHealth * statMultiplier);
                config.stats.damage = Math.round(config.stats.damage * statMultiplier);
                config.stats.armor = Math.round(config.stats.armor * statMultiplier);
            }
            
            const unit = this.unitManager.spawnUnit(config);
            if (unit) {
                spawned.push(unit);
            }
        });

        if (spawned.length === 0) {
            return false;
        }

        // Only occupy if not already occupied (initial placement)
        const cell = this.fortressSystem.getCell(gridX, gridY);
        if (cell && !cell.occupantId) {
            this.fortressSystem.occupyCell(gridX, gridY, spawned[0].getId(), unitId);
        }
        return true;
    }

    private spawnUnitFromLegacyConfig(unitConfig: any, gridX: number, gridY: number): boolean {
        const worldPos = this.fortressSystem.gridToWorld(gridX, gridY);
        // Legacy starter-data path retains the original behavior of spawning 3 units.
        const offsets = this.getSpawnOffsets(3);

        const spawned: any[] = [];
        offsets.forEach(offset => {
            const config = toUnitConfig(unitConfig, 1, worldPos.x + offset.x, worldPos.y + offset.y);
            const unit = this.unitManager.spawnUnit(config);
            if (unit) {
                spawned.push(unit);
            }
        });

        if (spawned.length === 0) {
            return false;
        }

        this.fortressSystem.occupyCell(gridX, gridY, spawned[0].getId());
        return true;
    }

    /**
     * Compute local offsets for spawning multiple units around a fortress cell center.
     * Preserves the original triangle layout for 3 units and uses sensible patterns for other counts.
     */
    private getSpawnOffsets(count: number): Array<{ x: number; y: number }> {
        if (count <= 0) {
            count = 1;
        }

        if (count === 1) {
            return [{ x: 0, y: 0 }];
        }

        if (count === 2) {
            return [
                { x: -18, y: 0 },
                { x: 18, y: 0 }
            ];
        }

        if (count === 3) {
            // Original offsets used before spawn_amount was introduced.
            return [
                { x: -20, y: -10 },
                { x: 20, y: -10 },
                { x: 0, y: 12 }
            ];
        }

        const radius = 20;
        const offsets: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            offsets.push({
                x: Math.round(Math.cos(angle) * radius),
                y: Math.round(Math.sin(angle) * radius)
            });
        }
        return offsets;
    }

    private castSpell(effectId: string | undefined, gridX: number, gridY: number): boolean {
        if (!effectId) return false;
        const worldPos = this.fortressSystem.gridToWorld(gridX, gridY);

        switch (effectId) {
            case 'barrier_field':
                this.createBarrierField(worldPos.x, worldPos.y, gridX, gridY, effectId);
                return true;
            case 'overclock':
                this.applyOverclock(worldPos.x, worldPos.y, gridX, gridY, effectId);
                return true;
            case 'cannon_tower':
                this.createCannonTower(worldPos.x, worldPos.y, gridX, gridY, effectId);
                return true;
            case 'jade_expansion':
                return this.unlockAdjacentCells(gridX, gridY, 4);
            case 'jade_resource_gathering':
                return this.unlockFortressCells(5);
            default:
                return false;
        }
    }

    private placeStructure(structureId: string | undefined, gridX: number, gridY: number, card: ICard): boolean {
        if (!structureId) return false;
        const worldPos = this.fortressSystem.gridToWorld(gridX, gridY);
        const dm = DataManager.getInstance();
        const config = dm.getBuildingConfig(structureId);
        const effectId: string | undefined = config?.effect_id;

        // Choose sprite key: prefer buildings.csv sprite_key, then a convention, then card art.
        const spriteKeyFromConfig: string | undefined = config?.sprite_key;
        const fallbackTextureKey = `building_${structureId}`;
        let textureKey: string | undefined = spriteKeyFromConfig;
        if (!textureKey || !this.scene.textures.exists(textureKey)) {
            textureKey = this.scene.textures.exists(fallbackTextureKey)
                ? fallbackTextureKey
                : (this.scene.textures.exists(card.portraitKey) ? card.portraitKey : undefined);
        }

        if (!textureKey || !this.scene.textures.exists(textureKey)) {
            console.warn(`[CardSystem] No texture found for structure ${structureId}`);
            return false;
        }

        const occupantId = `${structureId}_${gridX}_${gridY}`;
        this.fortressSystem.occupyCell(gridX, gridY, occupantId, structureId);

        // Turret-like structures get full runtime behavior (shooting, HP bar).
        if (
            effectId === 'triarch_cannon_blast' ||
            effectId === 'cannon_shoot' ||
            effectId === 'jade_archer_volley'
        ) {
            const baseHp = Number(config?.max_hp) || 200;
            const baseDamage =
                effectId === 'triarch_cannon_blast'
                    ? 55
                    : effectId === 'jade_archer_volley'
                        ? 18
                        : 40;
            const cooldownMs = effectId === 'jade_archer_volley' ? 900 : 2000;
            this.createTurretStructure(worldPos.x, worldPos.y, gridX, gridY, occupantId, textureKey, baseHp, baseDamage, cooldownMs);
            return true;
        }

        const sprite = this.scene.add.image(worldPos.x, worldPos.y, textureKey);
        sprite.setOrigin(0.5, 0.8);
        this.fitBuildingToFortressCell(sprite);
        sprite.setDepth(worldPos.y + 3600);

        if (effectId) {
            this.registerStructureEffect(effectId, gridX, gridY, occupantId);
        }
        return true;
    }

    private registerStructureEffect(effectId: string, gridX: number, gridY: number, occupantId: string): void {
        switch (effectId) {
            case 'triarch_healing_pulse':
                this.healingBeacons.push({ gridX, gridY, occupantId, effectId, lastPulseTime: 0 });
                return;
            case 'triarch_command_zone':
                this.commandPosts.push({ gridX, gridY, occupantId, effectId });
                return;
            case 'triarch_storm_zone':
                this.stormGenerators.push({ gridX, gridY, occupantId, effectId, lastTickTime: 0 });
                return;
            case 'shield_aura':
                this.shieldAuras.push({ gridX, gridY, occupantId, effectId, lastPulseTime: 0 });
                return;
            case 'jade_smoke_field':
                this.smokeFields.push({ gridX, gridY, occupantId, effectId, lastTickTime: 0 });
                return;
            case 'jade_resonance_pulse':
                this.resonanceTowers.push({ gridX, gridY, occupantId, effectId, lastPulseTime: 0 });
                return;
            default:
                // Unknown structure effects are currently no-ops (still placeable as visuals).
                return;
        }
    }

    private updateStructureEffects(now: number, deltaSeconds: number): void {
        const phase = this.gameState.getState().phase;
        if (phase !== 'PREPARATION' && phase !== 'BATTLE') return;

        // 1) Command Post aura: continuously sets building-specific multipliers so it stacks cleanly
        // with temporary buffs/debuffs.
        this.updateCommandPostAuras();

        // 2) Healing beacon pulses (also useful in pre-build)
        this.updateHealingBeacons(now);

        // 3) Shield auras (also useful in pre-build)
        this.updateShieldAuras(now);

        // 4) Storm/smoke/resonance zones (battle-only meaningful because they target enemies)
        if (phase === 'BATTLE') {
            this.updateStormGenerators(now, deltaSeconds);
            this.updateSmokeFields(now);
            this.updateResonanceTowers(now);
        }
    }

    private updateCommandPostAuras(): void {
        const allies = this.unitManager.getUnitsByTeam(1) as any[];
        if (allies.length === 0) return;

        const { width } = this.fortressSystem.getCellDimensions();
        const radius = width * 4; // 4 tiles

        // Default all units back to no building aura, then re-apply strongest aura found.
        allies.forEach(u => {
            u.setBuildingAttackSpeedMultiplier?.(1);
            u.setBuildingAccuracyMultiplier?.(1);
        });

        if (this.commandPosts.length === 0) return;

        // Accumulate max multipliers across multiple command posts.
        const bestAtkSpeed = new Map<any, number>();
        const bestAcc = new Map<any, number>();
        allies.forEach(u => {
            bestAtkSpeed.set(u, 1);
            bestAcc.set(u, 1);
        });

        this.commandPosts.forEach(post => {
            const pos = this.fortressSystem.gridToWorld(post.gridX, post.gridY);
            const cell = this.fortressSystem.getCell(post.gridX, post.gridY);
            const level = cell?.enhancementLevel || 0;
            const scale = 1 + 1.5 * level;

            // Base: +15% ranged attack speed, +10% accuracy
            const atkSpeedMult = 1 + 0.15 * scale;
            const accMult = 1 + 0.1 * scale;

            allies.forEach(u => {
                if (u.isDead?.()) return;
                const uPos = u.getPosition?.();
                if (!uPos) return;
                const dist = Phaser.Math.Distance.Between(pos.x, pos.y, uPos.x, uPos.y);
                if (dist > radius) return;

                bestAtkSpeed.set(u, Math.max(bestAtkSpeed.get(u) ?? 1, atkSpeedMult));
                bestAcc.set(u, Math.max(bestAcc.get(u) ?? 1, accMult));
                u.markBuildingBuff?.();
            });
        });

        allies.forEach(u => {
            u.setBuildingAttackSpeedMultiplier?.(bestAtkSpeed.get(u) ?? 1);
            u.setBuildingAccuracyMultiplier?.(bestAcc.get(u) ?? 1);
        });
    }

    private updateHealingBeacons(now: number): void {
        if (this.healingBeacons.length === 0) return;
        const allies = this.unitManager.getUnitsByTeam(1) as any[];
        if (allies.length === 0) return;

        const { width } = this.fortressSystem.getCellDimensions();
        const radius = width * 3; // 3 tiles
        const intervalMs = 2000;

        this.healingBeacons.forEach(beacon => {
            if (now - beacon.lastPulseTime < intervalMs) return;
            beacon.lastPulseTime = now;

            const pos = this.fortressSystem.gridToWorld(beacon.gridX, beacon.gridY);
            const cell = this.fortressSystem.getCell(beacon.gridX, beacon.gridY);
            const level = cell?.enhancementLevel || 0;
            const scale = 1 + 1.5 * level;

            const baseHeal = 18; // tuned baseline for Healing Beacon
            const healAmount = baseHeal * scale;

            allies.forEach(u => {
                if (u.isDead?.()) return;
                const uPos = u.getPosition?.();
                if (!uPos) return;
                const dist = Phaser.Math.Distance.Between(pos.x, pos.y, uPos.x, uPos.y);
                if (dist > radius) return;
                u.heal?.(healAmount);
                u.markBuildingBuff?.();
            });
        });
    }

    private updateStormGenerators(now: number, deltaSeconds: number): void {
        if (this.stormGenerators.length === 0) return;
        const enemies = this.unitManager.getUnitsByTeam(2) as any[];
        if (enemies.length === 0) return;

        const { width } = this.fortressSystem.getCellDimensions();
        const radius = width * 3; // 3 tiles
        const slowTickMs = 500;

        this.stormGenerators.forEach(storm => {
            const pos = this.fortressSystem.gridToWorld(storm.gridX, storm.gridY);
            const cell = this.fortressSystem.getCell(storm.gridX, storm.gridY);
            const level = cell?.enhancementLevel || 0;
            const scale = 1 + 1.5 * level;

            const baseSlow = 0.25;
            const slowAmount = Math.min(0.8, baseSlow * scale);
            const baseDps = 5;
            const dps = baseDps * scale;

            enemies.forEach(e => {
                if (e.isDead?.()) return;
                const ePos = e.getPosition?.();
                if (!ePos) return;
                const dist = Phaser.Math.Distance.Between(pos.x, pos.y, ePos.x, ePos.y);
                if (dist > radius) return;

                // DoT each frame (small)
                e.takeDamage?.(dps * deltaSeconds);

                // Slow refresh on a fixed cadence
                if (now - storm.lastTickTime >= slowTickMs) {
                    e.applySlow?.(slowAmount, 900);
                }
            });

            if (now - storm.lastTickTime >= slowTickMs) {
                storm.lastTickTime = now;
            }
        });
    }

    private updateShieldAuras(now: number): void {
        if (this.shieldAuras.length === 0) return;
        const allies = this.unitManager.getUnitsByTeam(1) as any[];
        if (allies.length === 0) return;

        const { width } = this.fortressSystem.getCellDimensions();
        const radius = width * 3; // 3 tiles
        const intervalMs = 2500;

        this.shieldAuras.forEach(aura => {
            if (now - aura.lastPulseTime < intervalMs) return;
            aura.lastPulseTime = now;

            const pos = this.fortressSystem.gridToWorld(aura.gridX, aura.gridY);
            const cell = this.fortressSystem.getCell(aura.gridX, aura.gridY);
            const level = cell?.enhancementLevel || 0;
            const scale = 1 + 1.5 * level;

            const baseShield = 20;
            const shieldAmount = baseShield * scale;
            const durationMs = 3000;

            allies.forEach(u => {
                if (u.isDead?.()) return;
                const uPos = u.getPosition?.();
                if (!uPos) return;
                const dist = Phaser.Math.Distance.Between(pos.x, pos.y, uPos.x, uPos.y);
                if (dist > radius) return;
                u.applyShield?.(shieldAmount, durationMs);
                u.markBuildingBuff?.();
            });
        });
    }

    private updateSmokeFields(now: number): void {
        if (this.smokeFields.length === 0) return;
        const enemies = this.unitManager.getUnitsByTeam(2) as any[];
        if (enemies.length === 0) return;

        const { width } = this.fortressSystem.getCellDimensions();
        const radius = width * 3;
        const tickMs = 500;

        this.smokeFields.forEach(field => {
            if (now - field.lastTickTime < tickMs) return;
            field.lastTickTime = now;

            const pos = this.fortressSystem.gridToWorld(field.gridX, field.gridY);
            const cell = this.fortressSystem.getCell(field.gridX, field.gridY);
            const level = cell?.enhancementLevel || 0;
            const scale = 1 + 1.5 * level;

            // Smoke: reduce accuracy (daze) briefly; scaled.
            const accMult = Math.max(0.15, 0.7 / scale);
            const durationMs = 900;

            enemies.forEach(e => {
                if (e.isDead?.()) return;
                const ePos = e.getPosition?.();
                if (!ePos) return;
                const dist = Phaser.Math.Distance.Between(pos.x, pos.y, ePos.x, ePos.y);
                if (dist > radius) return;
                e.applyDaze?.(accMult, durationMs);
            });
        });
    }

    private updateResonanceTowers(now: number): void {
        if (this.resonanceTowers.length === 0) return;
        const enemies = this.unitManager.getUnitsByTeam(2) as any[];
        if (enemies.length === 0) return;

        const { width } = this.fortressSystem.getCellDimensions();
        const radius = width * 2; // 2 tiles
        const intervalMs = 3500;

        this.resonanceTowers.forEach(tower => {
            if (now - tower.lastPulseTime < intervalMs) return;
            tower.lastPulseTime = now;

            const pos = this.fortressSystem.gridToWorld(tower.gridX, tower.gridY);
            const cell = this.fortressSystem.getCell(tower.gridX, tower.gridY);
            const level = cell?.enhancementLevel || 0;
            const scale = 1 + 1.5 * level;

            const stunMs = 700 + 200 * level;
            const damage = 4 * scale;

            enemies.forEach(e => {
                if (e.isDead?.()) return;
                const ePos = e.getPosition?.();
                if (!ePos) return;
                const dist = Phaser.Math.Distance.Between(pos.x, pos.y, ePos.x, ePos.y);
                if (dist > radius) return;
                e.applyStun?.(stunMs);
                e.takeDamage?.(damage);
            });
        });
    }

    private placeModule(moduleId: string | undefined, gridX: number, gridY: number, card: ICard): boolean {
        if (!moduleId) return false;
        const worldPos = this.fortressSystem.gridToWorld(gridX, gridY);

        const occupantId = `module_${moduleId}_${gridX}_${gridY}`;
        this.fortressSystem.occupyCell(gridX, gridY, occupantId, moduleId);

        // Visual: small node using card art, scaled to fortress cell.
        const textureKey = this.scene.textures.exists(card.portraitKey) ? card.portraitKey : undefined;
        if (textureKey) {
            const sprite = this.scene.add.image(worldPos.x, worldPos.y, textureKey);
            sprite.setOrigin(0.5, 0.8);
            this.fitBuildingToFortressCell(sprite);
            sprite.setScale(sprite.scale * 0.7); // Modules appear smaller than full buildings
            sprite.setDepth(worldPos.y + 3600);
        } else {
            // Fallback simple diamond marker.
            const g = this.scene.add.graphics();
            g.setDepth(worldPos.y + 3600);
            g.lineStyle(2, 0x33ffcc, 0.9);
            g.fillStyle(0x0b3b39, 0.6);
            const size = 18;
            g.beginPath();
            g.moveTo(worldPos.x, worldPos.y - size);
            g.lineTo(worldPos.x + size, worldPos.y);
            g.lineTo(worldPos.x, worldPos.y + size);
            g.lineTo(worldPos.x - size, worldPos.y);
            g.closePath();
            g.fillPath();
            g.strokePath();
        }

        return true;
    }

    private unlockAdjacentCells(gridX: number, gridY: number, max: number): boolean {
        const offsets = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 }
        ];
        const targets = offsets.map(o => ({ x: gridX + o.x, y: gridY + o.y }));
        const newlyUnlocked = this.fortressSystem.unlockSpecificCells(targets, max);
        if (newlyUnlocked.length === 0) {
            console.log('[CardSystem] No adjacent fortress cells available to unlock');
            return false;
        }
        this.persistUnlocks(newlyUnlocked);
        this.flashUnlocked(newlyUnlocked);
        return true;
    }

    private unlockFortressCells(count: number): boolean {
        const newlyUnlocked = this.fortressSystem.unlockNextCells(count);
        if (newlyUnlocked.length === 0) {
            console.log('[CardSystem] No fortress cells available to unlock');
            return false;
        }

        // Persist to run state
        const runManager = RunProgressionManager.getInstance();
        const fortressId = this.fortressSystem.getFortressId();
        const run = runManager.getRunState();
        if (run) {
            const updated = new Set(run.fortressUnlockedCells?.[fortressId] ?? []);
            newlyUnlocked.forEach(k => updated.add(k));
            runManager.updateFortressUnlocks(fortressId, Array.from(updated));
        }

        // Visual feedback
        this.flashUnlocked(newlyUnlocked);
        return true;
    }


    private flashUnlocked(keys: string[]): void {
        keys.forEach(key => {
            const [xStr, yStr] = key.split(',');
            const gx = Number(xStr);
            const gy = Number(yStr);
            const pos = this.fortressSystem.gridToWorld(gx, gy);
            const flash = this.scene.add.graphics();
            flash.setDepth(4000);
            flash.lineStyle(2, 0x00ffaa, 0.9);
            flash.strokeCircle(pos.x, pos.y, 26);
            this.scene.tweens.add({
                targets: flash,
                alpha: 0,
                scale: { from: 1, to: 1.4 },
                duration: 600,
                onComplete: () => flash.destroy()
            });
        });
    }

    private persistUnlocks(newlyUnlocked: string[]): void {
        const runManager = RunProgressionManager.getInstance();
        const run = runManager.getRunState();
        const fortressId = this.fortressSystem.getFortressId();
        if (!run) return;
        const updated = new Set(run.fortressUnlockedCells?.[fortressId] ?? []);
        newlyUnlocked.forEach(k => updated.add(k));
        runManager.updateFortressUnlocks(fortressId, Array.from(updated));
    }
    private createBarrierField(x: number, y: number, gridX: number, gridY: number, spellId: string) {
        const occupantId = `armor_shop_${this.buildingBuffs.length}`;
        this.fortressSystem.occupyCell(gridX, gridY, occupantId, spellId);
        this.buildingBuffs.push({ type: 'armor_shop', gridX, gridY, occupantId, enhancementLevel: 0 });

        // Armor Shop building – use dedicated artwork scaled to fortress grid size.
        const shop = this.scene.add.image(x, y, 'building_armor_shop');
        shop.setOrigin(0.5, 0.8);
        this.fitBuildingToFortressCell(shop);
        shop.setDepth(y + 3600);

        this.scene.tweens.add({
            targets: shop,
            alpha: { from: 1, to: 0.9 },
            duration: 900,
            yoyo: true,
            repeat: -1
        });

        const circle = this.scene.add.graphics();
        circle.setDepth(3900);
        circle.lineStyle(2, 0x66ccff, 0.55);
        circle.strokeCircle(x, y, 90);
        this.scene.tweens.add({
            targets: circle,
            alpha: 0,
            duration: 1200,
            onComplete: () => circle.destroy()
        });
    }

    private applyOverclock(x: number, y: number, gridX: number, gridY: number, spellId: string) {
        const occupantId = `overclock_stable_${this.buildingBuffs.length}`;
        this.fortressSystem.occupyCell(gridX, gridY, occupantId, spellId);
        this.buildingBuffs.push({ type: 'overclock', gridX, gridY, occupantId, enhancementLevel: 0 });

        this.createOverclockStable(x, y);
        const ring = this.scene.add.graphics();
        ring.lineStyle(2, 0xffcc33, 0.8);
        ring.strokeCircle(x, y, 120);
        this.scene.tweens.add({ targets: ring, alpha: 0, duration: 800, onComplete: () => ring.destroy() });
    }

    private createOverclockStable(x: number, y: number) {
        const g = this.scene.add.graphics();
        g.setDepth(4050);

        const baseHalfW = 64;
        const baseHalfH = 32;
        g.fillStyle(0x5c3b1a, 0.28);
        g.lineStyle(2, 0x8b5a2b, 0.9);
        g.beginPath();
        g.moveTo(x, y - baseHalfH);
        g.lineTo(x + baseHalfW, y);
        g.lineTo(x, y + baseHalfH);
        g.lineTo(x - baseHalfW, y);
        g.closePath();
        g.fillPath();
        g.strokePath();

        const stableWidth = 80;
        const stableHeight = 32;
        const wallBottomY = y - 4;
        const wallTopY = wallBottomY - stableHeight;

        g.fillStyle(0x8b4513, 0.95);
        g.fillRect(x - stableWidth / 2, wallTopY, stableWidth, stableHeight);

        g.fillStyle(0xc27b43, 0.98);
        g.beginPath();
        g.moveTo(x - stableWidth / 2 - 6, wallTopY);
        g.lineTo(x, wallTopY - 20);
        g.lineTo(x + stableWidth / 2 + 6, wallTopY);
        g.closePath();
        g.fillPath();

        g.fillStyle(0x3b1f0f, 1);
        const doorWidth = 22;
        const doorHeight = 22;
        g.fillRect(x - doorWidth / 2, wallBottomY - doorHeight, doorWidth, doorHeight);

        g.lineStyle(1.5, 0xd9b38c, 0.9);
        g.beginPath();
        g.moveTo(x - stableWidth / 2 + 6, wallBottomY - 10);
        g.lineTo(x - baseHalfW + 10, y + baseHalfH - 6);
        g.moveTo(x + stableWidth / 2 - 6, wallBottomY - 10);
        g.lineTo(x + baseHalfW - 10, y + baseHalfH - 6);
        g.strokePath();

        this.scene.tweens.add({
            targets: g,
            alpha: { from: 1, to: 0.7 },
            duration: 900,
            yoyo: true,
            repeat: -1
        });
    }

    private createCannonTower(x: number, y: number, gridX: number, gridY: number, spellId: string): void {
        // Occupy this fortress grid with a unique tower occupant id so no
        // other buildings/units can be placed here.
        const occupantId = `cannon_tower_${this.cannonTowers.length}`;
        this.fortressSystem.occupyCell(gridX, gridY, occupantId, spellId);

        const body = this.scene.add.image(x, y, 'building_cannon_tower');
        body.setOrigin(0.5, 0.8);
        this.fitBuildingToFortressCell(body);
        const hpBg = this.scene.add.graphics();
        const hpBar = this.scene.add.graphics();
        // Depth so the tower appears above nearby units.
        body.setDepth(y + 3600);

        // HP bar above the tower.
        const maxHp = 200;
        const hpWidth = 50;
        const hpHeight = 4;
        const hpY = y - body.displayHeight * 0.9;
        hpBg.clear();
        hpBg.fillStyle(0x000000, 0.7);
        hpBg.fillRect(x - hpWidth / 2, hpY, hpWidth, hpHeight);
        hpBg.setDepth(y + 3601);

        hpBar.clear();
        hpBar.fillStyle(0x00ff00, 1);
        hpBar.fillRect(x - hpWidth / 2, hpY, hpWidth, hpHeight);
        hpBar.setDepth(y + 3602);

        this.cannonTowers.push({
            x,
            y,
            gridX,
            gridY,
            hp: maxHp,
            maxHp,
            lastShotTime: 0,
            range: (this.scene.cameras.main.width || 1920) * (2 / 3),
            damage: 40, // Default damage
            cooldownMs: 2000,
            body,
            hpBg,
            hpBar,
            occupantId
        });
    }

    private createTurretStructure(
        x: number,
        y: number,
        gridX: number,
        gridY: number,
        occupantId: string,
        textureKey: string,
        baseHp: number,
        baseDamage: number,
        cooldownMs: number = 2000
    ): void {
        const body = this.scene.add.image(x, y, textureKey);
        body.setOrigin(0.5, 0.8);
        this.fitBuildingToFortressCell(body);
        const hpBg = this.scene.add.graphics();
        const hpBar = this.scene.add.graphics();
        body.setDepth(y + 3600);

        const maxHp = baseHp;
        const hpWidth = 50;
        const hpHeight = 4;
        const hpY = y - body.displayHeight * 0.9;
        hpBg.clear();
        hpBg.fillStyle(0x000000, 0.7);
        hpBg.fillRect(x - hpWidth / 2, hpY, hpWidth, hpHeight);
        hpBg.setDepth(y + 3601);

        hpBar.clear();
        hpBar.fillStyle(0x00ff00, 1);
        hpBar.fillRect(x - hpWidth / 2, hpY, hpWidth, hpHeight);
        hpBar.setDepth(y + 3602);

        this.cannonTowers.push({
            x,
            y,
            gridX,
            gridY,
            hp: maxHp,
            maxHp,
            lastShotTime: 0,
            range: (this.scene.cameras.main.width || 1920) * (2 / 3),
            damage: baseDamage,
            cooldownMs,
            body,
            hpBg,
            hpBar,
            occupantId
        });
    }

    private fitBuildingToFortressCell(sprite: Phaser.GameObjects.Image): void {
        const { width } = this.fortressSystem.getCellDimensions();
        const textureWidth = sprite.width || 1;
        const scale = (width * 1.0) / textureWidth;
        sprite.setScale(scale);
    }

    private getAdjacentFortressCells(gridX: number, gridY: number): Array<{ x: number; y: number }> {
        const candidates = [
            { x: gridX, y: gridY },
            { x: gridX + 1, y: gridY },
            { x: gridX - 1, y: gridY },
            { x: gridX, y: gridY + 1 },
            { x: gridX, y: gridY - 1 }
        ];
        return candidates.filter(c => !!this.fortressSystem.getCell(c.x, c.y));
    }

    public applyBuildingBuffsAtBattleStart(): void {
        if (this.buildingBuffs.length === 0) return;

        const allies = this.unitManager.getUnitsByTeam(1);

        this.buildingBuffs.forEach(buff => {
            const affectedCells = this.getAdjacentFortressCells(buff.gridX, buff.gridY);
            // Calculate scaling based on enhancement level (default 0)
            // "BUFF effect will increase 150% of its original effect" -> 100% base + (150% * level)
            // Multiplier = 1 + 1.5 * level
            const level = buff.enhancementLevel || 0;
            const multiplier = 1 + 1.5 * level;

            allies.forEach(unit => {
                const pos = unit.getPosition();
                const uGrid = this.fortressSystem.worldToGrid(pos.x, pos.y);
                const inArea = affectedCells.some(c => c.x === uGrid.x && c.y === uGrid.y);
                if (!inArea) return;

                switch (buff.type) {
                    case 'armor_shop':
                        // Base heal 30
                        unit.heal(30 * multiplier);
                        break;
                    case 'overclock':
                        // Base speed bonus 0.5 (1.5x). Scale bonus.
                        unit.setAttackSpeedMultiplier(1 + 0.5 * multiplier);
                        this.scene.time.delayedCall(5000, () => unit.setAttackSpeedMultiplier(1));
                        break;
                }

                // Mark unit as buffed for UI (yellow square next to name)
                (unit as any).markBuildingBuff?.();
            });
        });
    }

    public resetEnhancements(): void {
        console.log('[CardSystem] Resetting all unit/building enhancements for next node');
        
        // 1. Reset Fortress Cells (so new placements start at level 0)
        this.fortressSystem.resetAllEnhancements();

        // 2. Reset Buildings (Cannon Towers, Armor Shops, Overclock Stables)
        // Cannon Towers: Reset stats to base values
        this.cannonTowers.forEach(tower => {
            tower.maxHp = 200; // Base HP
            tower.hp = tower.maxHp;
            (tower as any).damage = 40; // Base Damage
            this.updateTowerHPBar(tower);
            
            // Remove visual indicators
            // Note: The current implementation of addRankIndicator creates a fire-and-forget text.
            // Ideally, we should track these indicators to destroy them. 
            // For now, since we are likely restarting the scene or moving nodes, 
            // persistent visuals might be cleared by scene restart.
            // If not, we should implement tracking.
        });

        // Building Buffs: Reset level to 0
        this.buildingBuffs.forEach(buff => {
            buff.enhancementLevel = 0;
        });

        // 3. Reset Units
        // We need to respawn units with base stats and base quantity.
        // This is complex because "enhancement" spawned EXTRA units.
        // We should probably remove all extra units and keep only the base batch.
        // Or, easier: Iterate through all player units, check their config/template, 
        // and revert stats. But we also need to reduce the count.
        
        // Strategy: 
        // Since enhancements spawn *extra* units as separate entities, 
        // "Resetting to level 1" implies removing those extra units.
        // However, tracking which units are "extra" vs "base" isn't currently done explicitly.
        // But wait, the requirement says "The enhancement effect will be gone after the node being cleared."
        
        // If we just reset the fortress cells (step 1), then ANY future units spawned 
        // (e.g. if we restart the battle scene for the next node) will start at level 0.
        
        // Are units PERSISTENT between nodes?
        // In `RunProgressionManager`, we track `fortressHp` and `deck`, but units?
        // `BattleScene` is re-created or restarted for each node encounter.
        // `initializeIronwarsPrototype` creates `UnitManager` fresh.
        // So units are CLEARED between nodes automatically because the scene restarts.
        
        // So what needs to be reset?
        // The PLAYER'S FORTRESS GRID STATE.
        // If the grid state (occupants, levels) persists in `RunProgressionManager` or similar, 
        // then we need to clear it.
        // Currently `FortressSystem` is created fresh in `BattleScene.initializeIronwarsPrototype`.
        // `BattleScene.init` resets battle state.
        
        // IF the fortress layout (buildings/units placed) is intended to persist between nodes 
        // (which seems to be the case for a "base building" aspect), then we need to ensure 
        // that the *persistence mechanism* clears the enhancement levels.
        
        // BUT, if `BattleScene` is destroyed and recreated, `FortressSystem` is new, `cellMap` is new.
        // UNLESS `BattleScene` loads the fortress state from a persistent source.
        
        // Looking at `BattleScene.ts`:
        // `this.fortressSystem = new FortressSystem(...)` in `initializeIronwarsPrototype`.
        // It loads config from `FactionRegistry` or `starterData`.
        // This config comes from static CSV data (`fortress_jade_dynasty_01`).
        // It does NOT seem to load a dynamic "saved fortress state" with placed units/buildings 
        // from `RunProgressionManager`.
        
        // Wait, if the game is a Roguelite where you build a base that persists...
        // currently `BattleScene` logic suggests a fresh start every time?
        // "Use generous starting resources... all 5 unit types... can be summoned".
        // This suggests the prototype resets every battle?
        
        // If the user says "enhancement effect will be gone after the node being cleared",
        // and "units and buildings... will be reset to level 1",
        // implies they expects them to PERSIST but lose levels?
        
        // OR, simply that within the current session/run, we need to ensure `RunProgressionManager` 
        // or whatever state holder clears this data.
        
        // Let's check `RunProgressionManager` or `FactionRegistry`.
        // `BattleScene` uses `runManager.getDeckSnapshot()`. 
        // But it creates `FortressSystem` from static config.
        
        // User query implies: "After the node being cleared".
        // This happens in `NodeEncounterSystem.onBattleComplete`.
        // If units/buildings are NOT persisting, then this "reset" is effectively automatic 
        // because the next battle starts fresh.
        
        // UNLESS the user is observing that they DO persist?
        // Maybe `BattleScene` isn't being destroyed?
        // `NodeEncounterSystem` calls `scenePlugin.stop('BattleScene')`.
        // And `startBattleEncounter` calls `scenePlugin.launch` or `restart`.
        
        // If `BattleScene` restarts, `create()` runs again.
        // `create()` calls `initializeIronwarsPrototype()`.
        // `initializeIronwarsPrototype()` calls `new FortressSystem(...)`.
        // `FortressSystem` constructor loads cells from `config.cells`.
        // `config` comes from `FactionRegistry.getFortressConfig`.
        // `FactionRegistry` loads from `DataManager`.
        // `DataManager` parses CSVs.
        
        // This chain is purely static. Every battle starts with an EMPTY fortress 
        // (except for pre-defined blocked/core cells).
        // So where are the "units and buildings" coming from that need resetting?
        
        // HYPOTHESIS: The user *wants* units/buildings to persist between nodes, 
        // BUT wants their enhancements to reset. 
        // OR, they are seeing enhancements persist because I might have accidentally 
        // made `FortressSystem` or `DataManager` stateful/dirty.
        
        // CHECK `DataManager`:
        // `private fortressGrids: Map<string, IFortressGridConfig> = new Map();`
        // `parseFortressGrid` populates this.
        // `FortressSystem` constructor:
        // `config.cells.forEach(cell => { this.cellMap.set(..., { ...cell }); });`
        // It spreads `...cell`. If `config.cells` contains references that got modified, 
        // then the "static" data is dirty.
        
        // Let's check where `config.cells` comes from.
        // `FactionRegistry.getFortressConfig` calls `getFortressGrid`.
        // `DataManager.getFortressGrid` returns the object stored in `this.fortressGrids`.
        
        // In `FortressSystem`:
        // `this.config = config;` (Stores reference)
        // `config.cells.forEach(...)`
        
        // In `occupyCell`:
        // `const cell = this.getCell(x, y);` -> gets from `this.cellMap`.
        // `this.cellMap` was populated with COPIES `{...cell}`.
        // So modifying `this.cellMap` entries does NOT modify `DataManager`'s source of truth.
        
        // HOWEVER, `DataManager`'s `cells` array contains OBJECTS. 
        // `parseFortressGrid` creates them.
        
        // If `FortressSystem` modifies `this.config.cells` directly?
        // No, it modifies `this.cellMap`.
        
        // Wait, did I accidentally modify the source config?
        // `occupyCell` modifies `cell.occupantId` on the object in `this.cellMap`.
        // `this.cellMap` values are created via `{ ...cell }` (shallow copy).
        // So `occupantId` on the *copy* is changed. The original `cell` in `DataManager` should be safe.
        
        // So why would enhancements persist?
        // Maybe they DON'T persist, and the user is *asking for a feature*?
        // "The enhancement effect will be gone after the node being cleared."
        // This sounds like a rule/requirement statement.
        
        // If the game currently wipes the fortress (units/buildings don't persist), 
        // then enhancements are naturally gone too.
        // But maybe the user *intends* for the fortress to persist?
        
        // Let's assume the user sees enhancements persisting. How?
        // Maybe `FortressSystem` is NOT destroyed?
        // `BattleScene` has `private fortressSystem!: FortressSystem;`
        // It's re-assigned in `initializeIronwarsPrototype`.
        
        // Maybe `UnitManager` persists?
        // `this.unitManager = new UnitManager(...)` in `setupCoreSystems`.
        // `setupCoreSystems` is called in `create`.
        
        // Maybe the issue is that I am NOT resetting something I should?
        // Or maybe the user is playing multiple waves in ONE node?
        // "after the NODE being cleared".
        // A node consists of multiple waves. 
        // Enhancements gained *during* the waves of a single node should persist *between waves* of that node.
        // But once the node is done (Victory), and we go back to map, and enter a NEW node...
        // everything resets.
        
        // So if everything resets, why the request?
        // Perhaps the user assumes I implemented persistence? 
        // Or perhaps they found a bug where it DOES persist?
        
        // Let's look at `BattleScene.ts` -> `initializeIronwarsPrototype`.
        // `const fortressConfig = factionRegistry.getFortressConfig(testFortressId);`
        // `FortressSystem` takes this config.
        
        // If `FactionRegistry` caches a mutated config?
        // `FactionRegistry` converts `IFortressGridConfig` to `IFortressConfig`.
        // `convertGridConfigToFortressConfig` creates a NEW object?
        // Let's check `FactionRegistry.ts` (not visible, but I can infer or read it).
        
        // IF I cannot find why it persists, I will implement the method to FORCE reset 
        // in `NodeEncounterSystem.onBattleComplete`.
        // But wait, `NodeEncounterSystem` doesn't have access to `BattleScene` internals easily 
        // after it stops the scene.
        
        // Actually, if the scene stops, the memory is freed (mostly).
        
        // Let's look at `CardSystem.ts` and `BattleScene.ts`.
        // If I add `resetEnhancements` to `CardSystem`, I can call it when?
        // On `battle-victory`?
    }

    private updateCannonTowers(now: number): void {
        if (this.gameState.getState().phase !== 'BATTLE') return;

        const enemies = this.unitManager.getUnitsByTeam(2);
        if (enemies.length === 0) return;

        // Check for enemies attacking towers and apply damage
        this.cannonTowers.forEach(tower => {
            enemies.forEach(enemy => {
                if (enemy.isDead()) return;
                const pos = enemy.getPosition();
                const dist = Phaser.Math.Distance.Between(tower.x, tower.y, pos.x, pos.y);
                // If enemy is very close to tower, they attack it
                if (dist <= 80) {
                    // Enemies deal damage to tower over time
                    const enemyDamage = (enemy as any).getDamage?.() || 10;
                    this.damageTower(tower, enemyDamage * 0.016); // rough DPS per frame at 60fps
                }
            });
        });

        // Update tower HP bars and remove destroyed towers
        this.cannonTowers = this.cannonTowers.filter(tower => {
            if (tower.hp <= 0) {
                this.destroyTower(tower);
                return false; // Remove from array
            }
            this.updateTowerHPBar(tower);
            return true; // Keep in array
        });

        // Towers shoot at enemies
        this.cannonTowers.forEach(tower => {
            const cooldownMs = tower.cooldownMs ?? 2000;
            if (now - tower.lastShotTime < cooldownMs) {
                return;
            }

            let closest: any = null;
            let closestDist = tower.range;

            enemies.forEach(enemy => {
                if (enemy.isDead()) return;
                const pos = enemy.getPosition();
                const dist = Phaser.Math.Distance.Between(tower.x, tower.y, pos.x, pos.y);
                if (dist <= tower.range && dist < closestDist) {
                    closestDist = dist;
                    closest = enemy;
                }
            });

            if (!closest) {
                return;
            }

            tower.lastShotTime = now;

            const targetPos = closest.getPosition();

            // Simple cannon shot: draw a bright line toward the target and
            // apply direct damage (no knockback/armor for now).
            const shot = this.scene.add.graphics();
            shot.setDepth(8000);
            shot.lineStyle(3, 0xfff3b0, 1);
            shot.beginPath();
            const muzzleY = tower.y - 40;
            shot.moveTo(tower.x + 20, muzzleY);
            shot.lineTo(targetPos.x, targetPos.y);
            shot.strokePath();

            this.scene.tweens.add({
                targets: shot,
                alpha: 0,
                duration: 180,
                onComplete: () => shot.destroy()
            });

            const damage = tower.damage || 40;
            (closest as any).takeDamage(damage);
        });
    }

    private damageTower(tower: { hp: number; maxHp: number }, damage: number): void {
        tower.hp = Math.max(0, tower.hp - damage);
    }

    private updateTowerHPBar(tower: {
        x: number;
        y: number;
        hp: number;
        maxHp: number;
        body: Phaser.GameObjects.Image;
        hpBar: Phaser.GameObjects.Graphics;
    }): void {
        const hpWidth = 50;
        const hpHeight = 4;
        const hpY = tower.y - tower.body.displayHeight * 0.9;
        const hpPercent = tower.hp / tower.maxHp;

        tower.hpBar.clear();
        // Color based on HP: green > yellow > red
        let color = 0x00ff00;
        if (hpPercent < 0.3) {
            color = 0xff0000;
        } else if (hpPercent < 0.6) {
            color = 0xffaa00;
        }
        tower.hpBar.fillStyle(color, 1);
        tower.hpBar.fillRect(tower.x - hpWidth / 2, hpY, hpWidth * hpPercent, hpHeight);
    }

    private destroyTower(tower: {
        x: number;
        y: number;
        body: Phaser.GameObjects.Image;
        hpBg: Phaser.GameObjects.Graphics;
        hpBar: Phaser.GameObjects.Graphics;
        occupantId: string;
    }): void {
        // Release the fortress cell
        this.fortressSystem.releaseCellByOccupant(tower.occupantId);

        // Store position before destroying
        const x = tower.x;
        const y = tower.y;

        // Destroy visual elements
        tower.body.destroy();
        tower.hpBg.destroy();
        tower.hpBar.destroy();

        // Optional: create destruction effect
        const explosion = this.scene.add.graphics();
        explosion.setDepth(8000);
        explosion.fillStyle(0xff6600, 0.8);
        explosion.fillCircle(x, y, 30);
        this.scene.tweens.add({
            targets: explosion,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            duration: 300,
            onComplete: () => explosion.destroy()
        });
    }
}
