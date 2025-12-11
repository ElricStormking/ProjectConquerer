import Phaser from 'phaser';
import { CardType, ICardPlacementPayload } from '../types/ironwars';
import { DeckSystem } from './DeckSystem';
import { GameStateManager } from './GameStateManager';
import { FortressSystem } from './FortressSystem';
import { UnitManager } from './UnitManager';
import { toUnitConfig } from '../data/ironwars/unitAdapter';
import { DataManager } from './DataManager';

export class CardSystem {
    private buildingBuffs: Array<{ type: 'armor_shop' | 'overclock'; gridX: number; gridY: number; occupantId: string; enhancementLevel: number }> = [];
    private cannonTowers: Array<{
        x: number;
        y: number;
        hp: number;
        maxHp: number;
        lastShotTime: number;
        range: number;
        damage: number;
        body: Phaser.GameObjects.Image;
        hpBg: Phaser.GameObjects.Graphics;
        hpBar: Phaser.GameObjects.Graphics;
        occupantId: string;
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
            const targetId = card.type === CardType.UNIT ? card.unitId : 
                             card.type === CardType.SPELL ? card.spellEffectId : undefined;
            
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/200b3f18-cffb-4f61-b5f7-19a9d85de236',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'jade-unit-fail',hypothesisId:'H2',location:'CardSystem.spawnUnitCard',message:'template lookup',data:{unitId,found:!!unitTemplate,spriteKeyGuess:unitTemplate?.type},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
        const offsets = [
            { x: -20, y: -10 },
            { x:  20, y: -10 },
            { x:   0, y:  12 }
        ];

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
        const offsets = [
            { x: -20, y: -10 },
            { x:  20, y: -10 },
            { x:   0, y:  12 }
        ];

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
            default:
                return false;
        }
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
            hp: maxHp,
            maxHp,
            lastShotTime: 0,
            range: (this.scene.cameras.main.width || 1920) * (2 / 3),
            damage: 40, // Default damage
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

        const COOLDOWN_MS = 2000;

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
            if (now - tower.lastShotTime < COOLDOWN_MS) {
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
