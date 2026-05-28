import Phaser from 'phaser';
import { IEnemySpawn, IWaveConfig, RelicTrigger, IRelicContext } from '../types/ironwars';
import { UnitManager } from './UnitManager';
import { GameStateManager } from './GameStateManager';
import { RelicManager } from './RelicManager';
import { UnitType } from '../data/UnitTypes';
import { DataManager } from './DataManager';
import { applyUnitLevelScalingToStats, clampUnitLevel } from './UnitLevelScaling';

export class WaveManager extends Phaser.Events.EventEmitter {
    private waves: IWaveConfig[] = [];
    private activeWaveIndex = -1;
    private enemyLevel = 1;
    private nodeLevel = 1;
    private enemyCountMultiplier = 1;
    private pendingSpawnEvents = 0;
    private activeEnemyIds: Set<string> = new Set();
    private timers: Phaser.Time.TimerEvent[] = [];
    private readonly relicManager = RelicManager.getInstance();
    private unitDeathHandler: (unit: any) => void;
    private readonly dataManager: DataManager;
    private readonly waveGridColumns = 5;
    private readonly waveGridRows = 5;
    private readonly waveGridCellSpacing = 74;
    private readonly waveGridCenter = { x: 1580, y: 760 };

    constructor(
        private scene: Phaser.Scene,
        private unitManager: UnitManager,
        private gameState: GameStateManager
    ) {
        super();
        
        // Store handler reference so we can remove it later
        this.unitDeathHandler = (unit: any) => {
            if (unit.getTeam && unit.getTeam() === 2) {
                const unitId = unit.getId();
                const unitType = unit.getConfig?.()?.unitType || 'unknown';
                console.log(`[WaveManager] Enemy death: ${unitType} (ID: ${unitId})`);
                this.activeEnemyIds.delete(unitId);
                this.tryCompleteWave();
            }
        };
        this.scene.events.on('unit-death', this.unitDeathHandler);
        this.dataManager = DataManager.getInstance();
    }
    
    public destroy(): void {
        this.clearTimers();
        this.scene.events.off('unit-death', this.unitDeathHandler);
        this.removeAllListeners();
        this.activeEnemyIds.clear();
        this.waves = [];
        console.log('[WaveManager] Destroyed and cleaned up');
    }

    public loadWaves(waves: IWaveConfig[], enemyLevel = 1, nodeLevel = 1): void {
        // Reset state when loading new waves
        this.clearTimers();
        this.activeWaveIndex = -1;
        this.pendingSpawnEvents = 0;
        this.activeEnemyIds.clear();
        this.waves = waves;
        this.enemyLevel = clampUnitLevel(enemyLevel);
        this.nodeLevel = this.clampNodeLevel(nodeLevel);
        this.enemyCountMultiplier = this.getEnemyCountMultiplier(this.nodeLevel);
        console.log(`[WaveManager] Loaded ${waves.length} waves at enemy level ${this.enemyLevel}, node level ${this.nodeLevel}, enemy count x${this.enemyCountMultiplier.toFixed(2)}, state reset`);
    }

    public startFirstWave(): void {
        this.startWave(0);
    }

    public startWave(index: number): void {
        if (!this.waves[index]) {
            console.log(`[WaveManager] No wave at index ${index}`);
            return;
        }
        this.clearTimers();
        this.activeWaveIndex = index;
        const wave = this.waves[index];
        console.log(`[WaveManager] Starting wave ${wave.index} (array index ${index}) with ${wave.spawns.length} spawn events`);
        this.pendingSpawnEvents = 0;
        this.emit('wave-started', wave.index);

        const waveStartContext = this.relicManager.applyTrigger(RelicTrigger.ON_WAVE_START, {});
        this.emit('relic-wave-start', waveStartContext);
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

    public isWaveComplete(): boolean {
        return this.pendingSpawnEvents === 0 && this.activeEnemyIds.size === 0;
    }

    private spawnWaveEnemies(wave: IWaveConfig): void {
        const expandedSpawns: IEnemySpawn[] = [];
        wave.spawns.forEach(spawn => {
            const spawnCount = this.getScaledSpawnCount(spawn.count);
            for (let i = 0; i < spawnCount; i++) {
                expandedSpawns.push(spawn);
            }
        });

        expandedSpawns.forEach((spawn, index) => {
            this.spawnEnemy(spawn, index);
        });
    }

    private spawnEnemy(spawn: IEnemySpawn, formationIndex: number): void {
        const unitTemplate = this.dataManager.getUnitTemplate(spawn.unitId);
        if (!unitTemplate) {
            console.warn(`[WaveManager] Missing unit template for ${spawn.unitId}, skipping spawn`);
            return;
        }
        const spawnPoint = this.getWaveGridPoint(formationIndex);
        const config = this.unitManager.createUnitConfig(
            unitTemplate.type as UnitType,
            2,
            spawnPoint.x,
            spawnPoint.y
        );
        this.applyEnemyLevelScaling(config);
        const unit = this.unitManager.spawnUnit(config);
        if (unit) {
            this.activeEnemyIds.add(unit.getId());
            this.applyEnemyBehavior(unit);
        }
    }

    private applyEnemyBehavior(unit: any) {
        unit.setAttackSpeedMultiplier(1);
    }

    private applyEnemyLevelScaling(config: ReturnType<UnitManager['createUnitConfig']>): void {
        const level = clampUnitLevel(this.enemyLevel);
        config.stats = applyUnitLevelScalingToStats(config.stats, level);
        config.unitLevel = level;
        config.enemyLevel = level;
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
        const startX = this.waveGridCenter.x - ((this.waveGridColumns - 1) * this.waveGridCellSpacing) / 2;
        const startY = this.waveGridCenter.y - ((this.waveGridRows - 1) * this.waveGridCellSpacing) / 2;
        const layerOffset = layer === 0
            ? { x: 0, y: 0 }
            : {
                x: ((layer - 1) % 3 - 1) * 14,
                y: (Math.floor((layer - 1) / 3) % 3 - 1) * 14
            };

        return {
            x: startX + column * this.waveGridCellSpacing + layerOffset.x,
            y: startY + row * this.waveGridCellSpacing + layerOffset.y
        };
    }

    private tryCompleteWave(): void {
        console.log(`[WaveManager] Checking wave completion - Wave ${this.activeWaveIndex + 1}, Pending spawns: ${this.pendingSpawnEvents}, Active enemies: ${this.activeEnemyIds.size}`);
        if (this.isWaveComplete()) {
            console.log(`[WaveManager] Wave ${this.activeWaveIndex + 1} cleared!`);

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

    private clearTimers(): void {
        this.timers.forEach(timer => timer.remove());
        this.timers = [];
        this.pendingSpawnEvents = 0;
        this.activeEnemyIds.clear();
    }
}
