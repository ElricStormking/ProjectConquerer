import Phaser from 'phaser';
import { IEnemySpawn, IWaveConfig, RelicTrigger, IRelicContext } from '../types/ironwars';
import { UnitManager } from './UnitManager';
import { GameStateManager } from './GameStateManager';
import { RelicManager } from './RelicManager';
import { toUnitConfig } from '../data/ironwars/unitAdapter';
import { UnitType } from '../data/UnitTypes';

export class WaveManager extends Phaser.Events.EventEmitter {
    private waves: IWaveConfig[] = [];
    private activeWaveIndex = -1;
    private pendingSpawnEvents = 0;
    private activeEnemyIds: Set<string> = new Set();
    private timers: Phaser.Time.TimerEvent[] = [];
    private readonly relicManager = RelicManager.getInstance();

    constructor(
        private scene: Phaser.Scene,
        private unitManager: UnitManager,
        private gameState: GameStateManager
    ) {
        super();
        this.scene.events.on('unit-death', (unit: any) => {
            if (unit.getTeam && unit.getTeam() === 2) {
                const unitId = unit.getId();
                const unitType = unit.getConfig?.()?.unitType || 'unknown';
                console.log(`[WaveManager] Enemy death: ${unitType} (ID: ${unitId})`);
                this.activeEnemyIds.delete(unitId);
                this.tryCompleteWave();
            }
        });
    }

    public loadWaves(waves: IWaveConfig[]): void {
        this.waves = waves;
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
        this.pendingSpawnEvents = wave.spawns.length;
        wave.spawns.forEach(spawn => {
            const timer = this.scene.time.delayedCall(spawn.spawnTime * 1000, () => {
                this.spawnEnemy(spawn);
                this.pendingSpawnEvents -= 1;
                this.tryCompleteWave();
            });
            this.timers.push(timer);
        });
        this.emit('wave-started', wave.index);

        const waveStartContext = this.relicManager.applyTrigger(RelicTrigger.ON_WAVE_START, {});
        this.emit('relic-wave-start', waveStartContext);
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

    private spawnEnemy(spawn: IEnemySpawn): void {
        const starter = this.gameState.getStarterData();
        if (!starter) return;
        const unitTemplate = starter.units[spawn.unitId];
        if (!unitTemplate) return;
        const lanePoint = this.getLanePoint(spawn.lane);
        for (let i = 0; i < spawn.count; i++) {
            const offsetX = Phaser.Math.Between(-20, 20);
            const offsetY = Phaser.Math.Between(-20, 20);
            const config = toUnitConfig(unitTemplate, 2, lanePoint.x + offsetX, lanePoint.y + offsetY);
            config.unitType = spawn.unitId as UnitType;
            const unit = this.unitManager.spawnUnit(config);
            if (unit) {
                this.activeEnemyIds.add(unit.getId());
                this.applyEnemyBehavior(unit);
            }
        }
    }

    private applyEnemyBehavior(unit: any) {
        unit.setAttackSpeedMultiplier(1);
    }

    private getLanePoint(lane: IEnemySpawn['lane']): { x: number; y: number } {
        // Spawn enemies (red team) from the lower-right corner of the
        // battlefield, with three lanes fanned slightly.
        const right = 100 + 1720; // battlefield right edge
        const bottom = 100 + 880; // battlefield bottom edge
        const baseX = right - 260;
        const baseY = bottom - 260;

        switch (lane) {
            case 'north':
                return { x: baseX, y: baseY - 80 };
            case 'south':
                return { x: baseX + 80, y: baseY + 80 };
            default:
                return { x: baseX + 40, y: baseY };
        }
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
