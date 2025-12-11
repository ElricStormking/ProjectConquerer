import Phaser from 'phaser';
import { IRunState, IMetaProgression, ISaveData, ICard } from '../types/ironwars';

const SAVE_KEY = 'ironwars_save';
const SAVE_VERSION = '1.0.0';

const DEFAULT_META_PROGRESSION: IMetaProgression = {
    unlockedCommanderIds: [],
    unlockedRelicIds: [],
    totalRunsCompleted: 0,
    highestStageReached: 0
};

export class SaveManager extends Phaser.Events.EventEmitter {
    private static instance: SaveManager;
    private saveData: ISaveData;

    private constructor() {
        super();
        this.saveData = this.loadFromStorage();
    }

    public static getInstance(): SaveManager {
        if (!SaveManager.instance) {
            SaveManager.instance = new SaveManager();
        }
        return SaveManager.instance;
    }

    private loadFromStorage(): ISaveData {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) {
                return this.createDefaultSaveData();
            }
            const parsed = JSON.parse(raw) as ISaveData;
            // Version migration could happen here
            if (parsed.version !== SAVE_VERSION) {
                console.warn(`[SaveManager] Save version mismatch: ${parsed.version} vs ${SAVE_VERSION}`);
                // For now, just use what we have
            }
            return parsed;
        } catch (e) {
            console.error('[SaveManager] Failed to load save data:', e);
            return this.createDefaultSaveData();
        }
    }

    private createDefaultSaveData(): ISaveData {
        return {
            version: SAVE_VERSION,
            runState: null,
            metaProgression: { ...DEFAULT_META_PROGRESSION },
            timestamp: Date.now()
        };
    }

    private persist(): void {
        try {
            this.saveData.timestamp = Date.now();
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.saveData));
            this.emit('save-updated', this.saveData);
        } catch (e) {
            console.error('[SaveManager] Failed to persist save data:', e);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Run State Methods
    // ─────────────────────────────────────────────────────────────────

    public hasSavedRun(): boolean {
        return this.saveData.runState !== null;
    }

    public saveRun(runState: IRunState): void {
        // Deep clone the deck to avoid reference issues
        this.saveData.runState = {
            ...runState,
            deck: runState.deck.map(card => ({ ...card })),
            completedNodeIds: [...runState.completedNodeIds],
            relics: [...runState.relics],
            curses: [...runState.curses],
            commanderRoster: [...runState.commanderRoster]
        };
        this.persist();
        console.log('[SaveManager] Run saved');
    }

    public loadRun(): IRunState | null {
        if (!this.saveData.runState) return null;
        // Return a deep clone
        const run = this.saveData.runState;
        const lives = (run as any).lives ?? 3;
        return {
            ...run,
            lives,
            deck: run.deck.map(card => ({ ...card })),
            completedNodeIds: [...run.completedNodeIds],
            relics: [...run.relics],
            curses: [...run.curses],
            commanderRoster: [...run.commanderRoster]
        };
    }

    public deleteSavedRun(): void {
        this.saveData.runState = null;
        this.persist();
        console.log('[SaveManager] Saved run deleted');
    }

    public updateRunDeck(deck: ICard[]): void {
        if (this.saveData.runState) {
            this.saveData.runState.deck = deck.map(card => ({ ...card }));
            this.persist();
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Meta Progression Methods
    // ─────────────────────────────────────────────────────────────────

    public getMetaProgression(): IMetaProgression {
        return { ...this.saveData.metaProgression };
    }

    public isCommanderUnlocked(commanderId: string): boolean {
        return this.saveData.metaProgression.unlockedCommanderIds.includes(commanderId);
    }

    public unlockCommander(commanderId: string): boolean {
        if (this.isCommanderUnlocked(commanderId)) {
            return false;
        }
        this.saveData.metaProgression.unlockedCommanderIds.push(commanderId);
        this.persist();
        this.emit('commander-unlocked', commanderId);
        console.log(`[SaveManager] Commander unlocked: ${commanderId}`);
        return true;
    }

    public getUnlockedCommanderIds(): string[] {
        return [...this.saveData.metaProgression.unlockedCommanderIds];
    }

    public isRelicUnlocked(relicId: string): boolean {
        return this.saveData.metaProgression.unlockedRelicIds.includes(relicId);
    }

    public unlockRelic(relicId: string): boolean {
        if (this.isRelicUnlocked(relicId)) {
            return false;
        }
        this.saveData.metaProgression.unlockedRelicIds.push(relicId);
        this.persist();
        this.emit('relic-unlocked', relicId);
        return true;
    }

    public getUnlockedRelicIds(): string[] {
        return [...this.saveData.metaProgression.unlockedRelicIds];
    }

    public incrementRunsCompleted(): void {
        this.saveData.metaProgression.totalRunsCompleted++;
        this.persist();
    }

    public updateHighestStage(stageIndex: number): void {
        if (stageIndex > this.saveData.metaProgression.highestStageReached) {
            this.saveData.metaProgression.highestStageReached = stageIndex;
            this.persist();
        }
    }

    public getTotalRunsCompleted(): number {
        return this.saveData.metaProgression.totalRunsCompleted;
    }

    public getHighestStageReached(): number {
        return this.saveData.metaProgression.highestStageReached;
    }

    // ─────────────────────────────────────────────────────────────────
    // Utility Methods
    // ─────────────────────────────────────────────────────────────────

    public resetAllData(): void {
        this.saveData = this.createDefaultSaveData();
        this.persist();
        console.log('[SaveManager] All data reset');
    }

    public exportSaveData(): string {
        return JSON.stringify(this.saveData, null, 2);
    }

    public importSaveData(jsonString: string): boolean {
        try {
            const imported = JSON.parse(jsonString) as ISaveData;
            if (!imported.version || !imported.metaProgression) {
                console.error('[SaveManager] Invalid save data format');
                return false;
            }
            this.saveData = imported;
            this.persist();
            return true;
        } catch (e) {
            console.error('[SaveManager] Failed to import save data:', e);
            return false;
        }
    }
}

