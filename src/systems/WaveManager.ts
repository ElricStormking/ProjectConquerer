import Phaser from 'phaser';
import { IEnemySpawn, IWaveConfig, RelicTrigger, IRelicContext } from '../types/ironwars';
import { UnitManager } from './UnitManager';
import { GameStateManager } from './GameStateManager';
import { RelicManager } from './RelicManager';
import { UnitType } from '../data/UnitTypes';
import { DataManager } from './DataManager';
import { applyUnitLevelScalingToStats, clampUnitLevel } from './UnitLevelScaling';

type EnemyFormationLine = 'front' | 'middle' | 'back';

interface EnemyFormationEntry {
    spawn: IEnemySpawn;
    formationIndex: number;
}

export class WaveManager extends Phaser.Events.EventEmitter {
    private waves: IWaveConfig[] = [];
    private activeWaveIndex = -1;
    private enemyLevel = 1;
    private nodeLevel = 1;
    private enemyCountMultiplier = 1;
    private pendingSpawnEvents = 0;
    private activeEnemyIds: Set<string> = new Set();
    private previewEnemyIds: Set<string> = new Set();
    private previewWaveIndex = -1;
    private isWaveActive = false;
    private timers: Phaser.Time.TimerEvent[] = [];
    private previewGridGraphics?: Phaser.GameObjects.Graphics;
    private readonly relicManager = RelicManager.getInstance();
    private unitDeathHandler: (unit: any) => void;
    private readonly dataManager: DataManager;
    private readonly waveGridColumns = 5;
    private readonly waveGridRows = 5;
    private readonly waveGridCellWidth: number;
    private readonly waveGridCellHeight: number;
    private readonly waveGridCenter = { x: 1580, y: 800 };
    private readonly enemyUnitsPerGrid = 3;

    constructor(
        private scene: Phaser.Scene,
        private unitManager: UnitManager,
        private gameState: GameStateManager,
        waveGridCellDimensions: { width: number; height: number } = { width: 64, height: 32 }
    ) {
        super();
        this.waveGridCellWidth = Math.max(1, waveGridCellDimensions.width);
        this.waveGridCellHeight = Math.max(1, waveGridCellDimensions.height);
        
        // Store handler reference so we can remove it later
        this.unitDeathHandler = (unit: any) => {
            if (unit.getTeam && unit.getTeam() === 2) {
                const unitId = unit.getId();
                const unitType = unit.getConfig?.()?.unitType || 'unknown';
                console.log(`[WaveManager] Enemy death: ${unitType} (ID: ${unitId})`);
                this.activeEnemyIds.delete(unitId);
                this.previewEnemyIds.delete(unitId);
                if (this.isWaveActive) {
                    this.tryCompleteWave();
                }
            }
        };
        this.scene.events.on('unit-death', this.unitDeathHandler);
        this.dataManager = DataManager.getInstance();
        this.createPreviewGrid();
    }
    
    public destroy(): void {
        this.clearPreviewEnemies();
        this.clearTimers();
        this.previewGridGraphics?.destroy();
        this.previewGridGraphics = undefined;
        this.scene.events.off('unit-death', this.unitDeathHandler);
        this.removeAllListeners();
        this.activeEnemyIds.clear();
        this.previewEnemyIds.clear();
        this.waves = [];
        console.log('[WaveManager] Destroyed and cleaned up');
    }

    public loadWaves(waves: IWaveConfig[], enemyLevel = 1, nodeLevel = 1): void {
        // Reset state when loading new waves
        this.clearTimers();
        this.activeWaveIndex = -1;
        this.pendingSpawnEvents = 0;
        this.isWaveActive = false;
        this.activeEnemyIds.clear();
        this.clearPreviewEnemies();
        this.waves = waves;
        this.enemyLevel = clampUnitLevel(enemyLevel);
        this.nodeLevel = this.clampNodeLevel(nodeLevel);
        this.enemyCountMultiplier = this.getEnemyCountMultiplier(this.nodeLevel);
        console.log(`[WaveManager] Loaded ${waves.length} waves at enemy level ${this.enemyLevel}, node level ${this.nodeLevel}, enemy count x${this.enemyCountMultiplier.toFixed(2)}, state reset`);
        this.prepareNextWavePreview();
    }

    public startFirstWave(): void {
        this.startWave(0);
    }

    public startWave(index: number): void {
        if (!this.waves[index]) {
            console.log(`[WaveManager] No wave at index ${index}`);
            return;
        }
        this.clearTimers(false);
        this.activeWaveIndex = index;
        const wave = this.waves[index];
        console.log(`[WaveManager] Starting wave ${wave.index} (array index ${index}) with ${wave.spawns.length} spawn events`);
        this.pendingSpawnEvents = 0;
        this.activeEnemyIds.clear();
        this.isWaveActive = true;
        this.emit('wave-started', wave.index);

        const waveStartContext = this.relicManager.applyTrigger(RelicTrigger.ON_WAVE_START, {});
        this.emit('relic-wave-start', waveStartContext);
        this.clearPreviewEnemies();
        this.spawnWaveEnemies(wave);
        this.tryCompleteWave();
    }

    public getWaveStartContext(): IRelicContext {
        return this.relicManager.applyTrigger(RelicTrigger.ON_WAVE_START, {});
    }

    public hasNextWave(): boolean {
        return this.activeWaveIndex + 1 < this.waves.length;
    }

    public startNextWave(): void {
        if (this.hasNextWave()) {
            this.startWave(this.activeWaveIndex + 1);
        }
    }

    public getPreviewGridCenter(): { x: number; y: number } {
        return { ...this.waveGridCenter };
    }

    public prepareNextWavePreview(): void {
        if (this.isWaveActive) {
            return;
        }

        const nextWaveIndex = this.activeWaveIndex + 1;
        const wave = this.waves[nextWaveIndex];
        if (!wave) {
            this.clearPreviewEnemies();
            this.previewGridGraphics?.setVisible(false);
            return;
        }

        if (this.previewWaveIndex === nextWaveIndex && this.previewEnemyIds.size > 0) {
            return;
        }

        this.clearPreviewEnemies();
        this.previewWaveIndex = nextWaveIndex;
        this.spawnWavePreviewEnemies(wave);
        this.previewGridGraphics?.setVisible(true);
    }

    public isWaveComplete(): boolean {
        return this.pendingSpawnEvents === 0 && this.activeEnemyIds.size === 0;
    }

    private spawnWaveEnemies(wave: IWaveConfig): void {
        const formationEntries = this.getFormationEntries(this.expandWaveSpawns(wave));

        formationEntries.forEach(entry => {
            const delayMs = Math.max(0, Number(entry.spawn.spawnTime) || 0) * 1000;
            if (delayMs <= 0) {
                this.spawnEnemy(entry.spawn, entry.formationIndex);
                return;
            }

            this.pendingSpawnEvents++;
            const timer = this.scene.time.delayedCall(delayMs, () => {
                this.pendingSpawnEvents = Math.max(0, this.pendingSpawnEvents - 1);
                this.spawnEnemy(entry.spawn, entry.formationIndex);
                this.tryCompleteWave();
            });
            this.timers.push(timer);
        });
    }

    private spawnWavePreviewEnemies(wave: IWaveConfig): void {
        const formationEntries = this.getFormationEntries(this.expandWaveSpawns(wave));

        formationEntries.forEach(entry => {
            const units = this.createEnemyUnits(entry.spawn, entry.formationIndex);
            units.forEach(unit => {
                this.previewEnemyIds.add(unit.getId());
                this.applyEnemyBehavior(unit);
            });
        });
    }

    private expandWaveSpawns(wave: IWaveConfig): IEnemySpawn[] {
        const expandedSpawns: IEnemySpawn[] = [];
        wave.spawns.forEach(spawn => {
            const spawnCount = this.getScaledSpawnCount(spawn.count);
            for (let i = 0; i < spawnCount; i++) {
                expandedSpawns.push(spawn);
            }
        });
        return expandedSpawns;
    }

    private getFormationEntries(expandedSpawns: IEnemySpawn[]): EnemyFormationEntry[] {
        const groupedSpawns: Record<EnemyFormationLine, IEnemySpawn[]> = {
            front: [],
            middle: [],
            back: []
        };

        expandedSpawns.forEach(spawn => {
            groupedSpawns[this.getFormationLineForSpawn(spawn)].push(spawn);
        });

        const usedSlots = new Set<number>();
        const entries: EnemyFormationEntry[] = [];
        const assignLine = (line: EnemyFormationLine, columns: number[]) => {
            const slotOrder = this.getFormationSlotOrder(columns, expandedSpawns.length);
            while (groupedSpawns[line].length > 0) {
                const formationIndex = slotOrder.find(index => !usedSlots.has(index));
                if (formationIndex === undefined) {
                    return;
                }
                const spawn = groupedSpawns[line].shift()!;
                usedSlots.add(formationIndex);
                entries.push({ spawn, formationIndex });
            }
        };

        assignLine('front', [0, 1]);
        assignLine('middle', [2]);
        assignLine('back', [4, 3]);
        assignLine('front', [2, 3, 4]);
        assignLine('middle', [1, 3, 0, 4]);
        assignLine('back', [2, 1, 0]);

        return entries.sort((a, b) => a.formationIndex - b.formationIndex);
    }

    private getFormationLineForSpawn(spawn: IEnemySpawn): EnemyFormationLine {
        const unitTemplate = this.dataManager.getUnitTemplate(spawn.unitId);
        if (!unitTemplate) {
            return 'middle';
        }

        if (unitTemplate.unitClass === 'frontline') {
            return 'front';
        }

        if (unitTemplate.unitClass === 'support') {
            return 'middle';
        }

        return 'back';
    }

    private getFormationSlotOrder(columnOrder: number[], spawnCount: number): number[] {
        const slotsPerLayer = this.waveGridColumns * this.waveGridRows;
        const layerCount = Math.max(1, Math.ceil(spawnCount / slotsPerLayer));
        const rowOrder = Array.from({ length: this.waveGridRows }, (_, row) => row);
        const slotOrder: number[] = [];

        for (let layer = 0; layer < layerCount; layer++) {
            columnOrder.forEach(column => {
                rowOrder.forEach(row => {
                    slotOrder.push(layer * slotsPerLayer + row * this.waveGridColumns + column);
                });
            });
        }

        return slotOrder;
    }

    private spawnEnemy(spawn: IEnemySpawn, formationIndex: number): void {
        const units = this.createEnemyUnits(spawn, formationIndex);
        units.forEach(unit => {
            this.activeEnemyIds.add(unit.getId());
            this.applyEnemyBehavior(unit);
        });
    }

    private createEnemyUnits(spawn: IEnemySpawn, formationIndex: number): any[] {
        const unitTemplate = this.dataManager.getUnitTemplate(spawn.unitId);
        if (!unitTemplate) {
            console.warn(`[WaveManager] Missing unit template for ${spawn.unitId}, skipping spawn`);
            return [];
        }
        const spawnPoint = this.getWaveGridPoint(formationIndex);
        const offsets = this.getEnemySpawnOffsets(this.enemyUnitsPerGrid);
        const spawned: any[] = [];

        offsets.forEach(offset => {
            const config = this.unitManager.createUnitConfig(
                unitTemplate.type as UnitType,
                2,
                spawnPoint.x + offset.x,
                spawnPoint.y + offset.y
            );
            this.applyEnemyLevelScaling(config, spawn.unitLevel);
            this.applySpawnStatOverrides(config, spawn);
            const unit = this.unitManager.spawnUnit(config);
            if (unit) {
                spawned.push(unit);
            }
        });

        return spawned;
    }

    private applyEnemyBehavior(unit: any) {
        unit.setAttackSpeedMultiplier(1);
    }

    private applyEnemyLevelScaling(config: ReturnType<UnitManager['createUnitConfig']>, unitLevel?: number): void {
        const level = clampUnitLevel(unitLevel ?? this.enemyLevel);
        config.stats = applyUnitLevelScalingToStats(config.stats, level);
        config.unitLevel = level;
        config.enemyLevel = level;
    }

    private applySpawnStatOverrides(config: ReturnType<UnitManager['createUnitConfig']>, spawn: IEnemySpawn): void {
        const hpMultiplier = this.getPositiveMultiplier(spawn.hpMultiplier);
        const damageMultiplier = this.getPositiveMultiplier(spawn.damageMultiplier);
        const moveSpeedMultiplier = this.getPositiveMultiplier(spawn.moveSpeedMultiplier);
        const attackSpeedMultiplier = this.getPositiveMultiplier(spawn.attackSpeedMultiplier);
        const armorBonus = Number(spawn.armorBonus);

        if (hpMultiplier !== undefined) {
            config.stats.maxHealth = Math.max(1, Math.round(config.stats.maxHealth * hpMultiplier));
        }
        if (damageMultiplier !== undefined) {
            config.stats.damage = Math.max(0, Math.round(config.stats.damage * damageMultiplier));
        }
        if (Number.isFinite(armorBonus) && armorBonus !== 0) {
            config.stats.armor = Math.max(0, Math.round(config.stats.armor + armorBonus));
        }
        if (moveSpeedMultiplier !== undefined) {
            config.stats.moveSpeed = Math.max(1, Math.round(config.stats.moveSpeed * moveSpeedMultiplier));
        }
        if (attackSpeedMultiplier !== undefined) {
            config.stats.attackSpeed = Math.max(0.05, config.stats.attackSpeed * attackSpeedMultiplier);
        }
    }

    private getPositiveMultiplier(value?: number): number | undefined {
        const multiplier = Number(value);
        return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : undefined;
    }

    private clampNodeLevel(nodeLevel: number): number {
        return Math.max(1, Math.min(15, Math.round(Number(nodeLevel) || 1)));
    }

    private getEnemyCountMultiplier(nodeLevel: number): number {
        if (nodeLevel <= 3) return 1;
        return 1 + (nodeLevel - 3) * 0.12;
    }

    private getScaledSpawnCount(baseCount: number): number {
        const count = Math.max(0, Math.round(Number(baseCount) || 0));
        if (count <= 0) return 0;
        return Math.max(count, Math.ceil(count * this.enemyCountMultiplier));
    }

    private getWaveGridPoint(index: number): { x: number; y: number } {
        const slots = this.waveGridColumns * this.waveGridRows;
        const slot = index % slots;
        const layer = Math.floor(index / slots);
        const column = slot % this.waveGridColumns;
        const row = Math.floor(slot / this.waveGridColumns);
        const centerColumn = (this.waveGridColumns - 1) / 2;
        const centerRow = (this.waveGridRows - 1) / 2;
        const gridX = column - centerColumn;
        const gridY = row - centerRow;
        const halfW = this.waveGridCellWidth / 2;
        const halfH = this.waveGridCellHeight / 2;
        const layerOffset = layer === 0
            ? { x: 0, y: 0 }
            : {
                x: ((layer - 1) % 3 - 1) * 14,
                y: (Math.floor((layer - 1) / 3) % 3 - 1) * 14
            };

        return {
            x: this.waveGridCenter.x + (gridX - gridY) * halfW + layerOffset.x,
            y: this.waveGridCenter.y + (gridX + gridY) * halfH + layerOffset.y
        };
    }

    private getEnemySpawnOffsets(count: number): Array<{ x: number; y: number }> {
        const halfW = Math.max(1, this.waveGridCellWidth / 2);
        const halfH = Math.max(1, this.waveGridCellHeight / 2);
        const safeW = Math.max(4, Math.round(halfW * 0.45));
        const safeH = Math.max(4, Math.round(halfH * 0.45));
        const clusterW = Math.max(3, Math.round(safeW * 0.55));
        const clusterH = Math.max(3, Math.round(safeH * 0.55));

        if (count <= 1) {
            return [{ x: 0, y: 0 }];
        }

        if (count === 2) {
            return [
                { x: -clusterW, y: 0 },
                { x: clusterW, y: 0 }
            ];
        }

        if (count === 3) {
            return [
                { x: -clusterW, y: -clusterH },
                { x: clusterW, y: -clusterH },
                { x: 0, y: clusterH }
            ];
        }

        const radius = Math.max(3, Math.min(clusterW, clusterH));
        const offsets: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            offsets.push({
                x: Math.round(Math.cos(angle) * radius),
                y: Math.round(Math.sin(angle) * radius)
            });
        }
        return offsets.map(offset => ({
            x: Phaser.Math.Clamp(offset.x, -safeW, safeW),
            y: Phaser.Math.Clamp(offset.y, -safeH, safeH)
        }));
    }

    private tryCompleteWave(): void {
        if (!this.isWaveActive) {
            return;
        }
        console.log(`[WaveManager] Checking wave completion - Wave ${this.activeWaveIndex + 1}, Pending spawns: ${this.pendingSpawnEvents}, Active enemies: ${this.activeEnemyIds.size}`);
        if (this.isWaveComplete()) {
            console.log(`[WaveManager] Wave ${this.activeWaveIndex + 1} cleared!`);
            this.isWaveActive = false;

            const waveEndContext = this.relicManager.applyTrigger(RelicTrigger.ON_WAVE_END, {});
            this.emit('relic-wave-end', waveEndContext);

            if (waveEndContext.fortressDamage) {
                this.gameState.takeFortressDamage(waveEndContext.fortressDamage as number);
            }
            if (waveEndContext.fortressHealBonus) {
                this.gameState.healFortress(waveEndContext.fortressHealBonus as number);
            }

            this.emit('wave-cleared', this.activeWaveIndex);
        }
    }

    public getWaveEndContext(): IRelicContext {
        return this.relicManager.applyTrigger(RelicTrigger.ON_WAVE_END, {});
    }

    private clearTimers(clearActiveEnemyIds = true): void {
        this.timers.forEach(timer => timer.remove());
        this.timers = [];
        this.pendingSpawnEvents = 0;
        if (clearActiveEnemyIds) {
            this.activeEnemyIds.clear();
        }
    }

    private clearPreviewEnemies(): void {
        this.previewEnemyIds.forEach(unitId => {
            this.unitManager.removeUnit(unitId);
        });
        this.previewEnemyIds.clear();
        this.previewWaveIndex = -1;
    }

    private createPreviewGrid(): void {
        const graphics = this.scene.add.graphics();
        graphics.setDepth(3100);
        graphics.lineStyle(2, 0xff6655, 0.75);
        graphics.fillStyle(0xff3333, 0.08);

        for (let row = 0; row < this.waveGridRows; row++) {
            for (let column = 0; column < this.waveGridColumns; column++) {
                const index = row * this.waveGridColumns + column;
                const center = this.getWaveGridPoint(index);
                const halfW = this.waveGridCellWidth / 2;
                const halfH = this.waveGridCellHeight / 2;
                graphics.beginPath();
                graphics.moveTo(center.x, center.y - halfH);
                graphics.lineTo(center.x + halfW, center.y);
                graphics.lineTo(center.x, center.y + halfH);
                graphics.lineTo(center.x - halfW, center.y);
                graphics.closePath();
                graphics.fillPath();
                graphics.strokePath();
            }
        }

        this.previewGridGraphics = graphics;
        this.previewGridGraphics.setVisible(false);
    }
}
