import Phaser from 'phaser';
import { DataManager } from './DataManager';
import { RelicManager } from './RelicManager';
import { SaveManager } from './SaveManager';
import { FactionRegistry } from './FactionRegistry';
import { CommanderManager } from './CommanderManager';
import { COG_DOMINION_STARTER } from '../data/ironwars/cog_dominion_starter';
import {
    IRunState,
    IStageConfig,
    IMapNode,
    ICard,
    NodeType,
    RelicTrigger,
    IFortressConfig,
    IFortressCell,
    IFortressCellState,
    IStorySlideState
} from '../types/ironwars';

export type RunStateSnapshot = IRunState & { deck: ICard[] };

export class RunProgressionManager extends Phaser.Events.EventEmitter {
    private static instance: RunProgressionManager;

    private readonly dataManager = DataManager.getInstance();
    private readonly relicManager = RelicManager.getInstance();
    private readonly saveManager = SaveManager.getInstance();
    private readonly factionRegistry = FactionRegistry.getInstance();
    private readonly commanderManager = CommanderManager.getInstance();
    private runState: IRunState | null = null;
    private stageGraph: Map<number, IStageConfig> = new Map();
    private stageGraphById: Map<string, IStageConfig> = new Map();
    private nodeGraph: Map<string, IMapNode> = new Map();
    private inboundEdges: Map<string, string[]> = new Map();
    private difficultyLevel = 0;

    private constructor() {
        super();
    }

    public static getInstance(): RunProgressionManager {
        if (!RunProgressionManager.instance) {
            RunProgressionManager.instance = new RunProgressionManager();
        }
        return RunProgressionManager.instance;
    }

    public hasActiveRun(): boolean {
        return this.runState !== null;
    }

    private cloneFortressCellStates(
        states?: Record<string, IFortressCellState[]>
    ): Record<string, IFortressCellState[]> | undefined {
        if (!states) return undefined;
        const clone: Record<string, IFortressCellState[]> = {};
        Object.keys(states).forEach(fortressId => {
            clone[fortressId] = states[fortressId].map(cell => ({ ...cell }));
        });
        return clone;
    }

    private createStorySlidesState(preludeSeen = true): IStorySlideState {
        return {
            preludeSeen,
            stageIntroSeen: [],
            stageOutroSeen: [],
            finalSeen: false,
            pendingFinal: false
        };
    }

    private ensureStorySlidesState(preludeSeen = true): IStorySlideState {
        if (!this.runState) {
            return this.createStorySlidesState(preludeSeen);
        }
        if (!this.runState.storySlides) {
            this.runState.storySlides = this.createStorySlidesState(preludeSeen);
        }
        this.runState.storySlides.stageIntroSeen = this.runState.storySlides.stageIntroSeen ?? [];
        this.runState.storySlides.stageOutroSeen = this.runState.storySlides.stageOutroSeen ?? [];
        this.runState.storySlides.finalSeen = this.runState.storySlides.finalSeen ?? false;
        this.runState.storySlides.preludeSeen = this.runState.storySlides.preludeSeen ?? preludeSeen;
        return this.runState.storySlides;
    }

    private cloneStorySlides(state?: IStorySlideState): IStorySlideState | undefined {
        if (!state) return undefined;
        return {
            preludeSeen: state.preludeSeen,
            stageIntroSeen: [...(state.stageIntroSeen ?? [])],
            stageOutroSeen: [...(state.stageOutroSeen ?? [])],
            finalSeen: state.finalSeen,
            pendingStageOutroStageIndex: state.pendingStageOutroStageIndex,
            pendingFinal: state.pendingFinal
        };
    }

    public getRunState(): RunStateSnapshot | null {
        if (!this.runState) return null;
        const snapshot = {
            ...this.runState,
            deck: [...this.runState.deck],
            completedNodeIds: [...this.runState.completedNodeIds],
            relics: [...this.runState.relics],
            curses: [...this.runState.curses],
            commanderRoster: [...this.runState.commanderRoster],
            cardCollection: [...(this.runState.cardCollection ?? [])],
            factionId: this.runState.factionId,
            lives: this.runState.lives,
            fortressUnlockedCells: this.runState.fortressUnlockedCells ? { ...this.runState.fortressUnlockedCells } : undefined,
            fortressCellStates: this.cloneFortressCellStates(this.runState.fortressCellStates),
            storySlides: this.cloneStorySlides(this.runState.storySlides)
        };
        return snapshot;
    }

    public getFactionId(): string {
        return this.runState?.factionId ?? 'cog_dominion';
    }

    public hasSeenStageIntro(stageIndex: number): boolean {
        if (!this.runState) return false;
        const story = this.ensureStorySlidesState(true);
        return story.stageIntroSeen.includes(stageIndex);
    }

    public markStageIntroSeen(stageIndex: number): void {
        if (!this.runState) return;
        const story = this.ensureStorySlidesState(true);
        if (!story.stageIntroSeen.includes(stageIndex)) {
            story.stageIntroSeen.push(stageIndex);
            this.saveRun();
        }
    }

    public hasSeenStageOutro(stageIndex: number): boolean {
        if (!this.runState) return false;
        const story = this.ensureStorySlidesState(true);
        return story.stageOutroSeen.includes(stageIndex);
    }

    public markStageOutroSeen(stageIndex: number): void {
        if (!this.runState) return;
        const story = this.ensureStorySlidesState(true);
        if (!story.stageOutroSeen.includes(stageIndex)) {
            story.stageOutroSeen.push(stageIndex);
            this.saveRun();
        }
    }

    public hasSeenFinalSlides(): boolean {
        if (!this.runState) return false;
        const story = this.ensureStorySlidesState(true);
        return story.finalSeen;
    }

    public markFinalSlidesSeen(): void {
        if (!this.runState) return;
        const story = this.ensureStorySlidesState(true);
        if (!story.finalSeen) {
            story.finalSeen = true;
            this.saveRun();
        }
    }

    public getPendingStageOutroStageIndex(): number | undefined {
        if (!this.runState) return undefined;
        const story = this.ensureStorySlidesState(true);
        return story.pendingStageOutroStageIndex;
    }

    public setPendingStageOutro(stageIndex: number): void {
        if (!this.runState) return;
        const story = this.ensureStorySlidesState(true);
        story.pendingStageOutroStageIndex = stageIndex;
        this.saveRun();
    }

    public clearPendingStageOutro(): void {
        if (!this.runState) return;
        const story = this.ensureStorySlidesState(true);
        if (story.pendingStageOutroStageIndex !== undefined) {
            story.pendingStageOutroStageIndex = undefined;
            this.saveRun();
        }
    }

    public isFinalSlidesPending(): boolean {
        if (!this.runState) return false;
        const story = this.ensureStorySlidesState(true);
        return !!story.pendingFinal;
    }

    public setFinalSlidesPending(pending: boolean): void {
        if (!this.runState) return;
        const story = this.ensureStorySlidesState(true);
        story.pendingFinal = pending;
        this.saveRun();
    }

    public clearFinalSlidesPending(): void {
        if (!this.runState) return;
        const story = this.ensureStorySlidesState(true);
        if (story.pendingFinal) {
            story.pendingFinal = false;
            this.saveRun();
        }
    }

    private getInitialUnlockedCells(fortress: IFortressConfig): string[] {
        const centerX = Math.floor(fortress.gridWidth / 2);
        const centerY = Math.floor(fortress.gridHeight / 2);
        const cellByKey = new Map<string, IFortressCell>(fortress.cells.map(c => [`${c.x},${c.y}`, c]));

        const initialSet = new Set<string>();
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const x = centerX + dx;
                const y = centerY + dy;
                const key = `${x},${y}`;
                const cell = cellByKey.get(key);
                if (cell && cell.type !== 'blocked') {
                    initialSet.add(key);
                }
            }
        }

        const targetCount = 9;
        if (initialSet.size < targetCount) {
            const sorted = fortress.cells
                .filter(c => c.type !== 'blocked')
                .map(c => ({ key: `${c.x},${c.y}`, dist: Math.abs(c.x - centerX) + Math.abs(c.y - centerY) }))
                .sort((a, b) => a.dist - b.dist);
            for (const c of sorted) {
                if (initialSet.size >= targetCount) break;
                initialSet.add(c.key);
            }
        }
        return Array.from(initialSet);
    }

    public getStageSnapshot(stageIndex: number): IStageConfig | undefined {
        const stage = this.stageGraph.get(stageIndex);
        if (!stage) return undefined;
        return {
            ...stage,
            nodes: stage.nodes.map(node => ({ ...node, nextNodeIds: [...node.nextNodeIds] }))
        };
    }

    public getNodeSnapshot(nodeId: string): IMapNode | undefined {
        const node = this.nodeGraph.get(nodeId);
        if (!node) return undefined;
        return { ...node, nextNodeIds: [...node.nextNodeIds] };
    }

    public startNewRun(factionId = 'cog_dominion', difficulty = 0, commanderIdOverride?: string): void {
        this.difficultyLevel = difficulty;
        this.buildStageGraph();
        
        // Get faction-specific data
        const fortress = this.factionRegistry.getFortressForFaction(factionId);
        const starterCommander = commanderIdOverride
            ? this.commanderManager.getCommander(commanderIdOverride)
            : this.commanderManager.getStarterCommander(factionId);
        const starterDeck = starterCommander
            ? this.commanderManager.getCardsForCommander(starterCommander.id).slice(0, 6)
            : this.commanderManager.getStarterDeck(factionId);
        
        // Fallback to COG_DOMINION_STARTER if faction data not found
        const fallbackStarter = COG_DOMINION_STARTER;
        const baseFortressHp = fortress?.maxHp ?? fallbackStarter.fortress.maxHp;
        const commanderId = starterCommander?.id ?? fallbackStarter.commander.id;
        const deck = starterDeck.length > 0 ? starterDeck : [...fallbackStarter.deck];
        const fortressId = fortress?.id ?? fallbackStarter.fortress.id;
        const fortressConfig = fortress ?? this.factionRegistry.getFortressConfig(fortressId) ?? fallbackStarter.fortress;
        const initialUnlocked = this.getInitialUnlockedCells(fortressConfig);
        
        const startingStageIndex = 0;
        const entryNodeId = this.findEntryNodeId(startingStageIndex);

        this.relicManager.reset();

        const startingRelicIds = this.relicManager.generateStartingRelics(2);
        startingRelicIds.forEach(id => this.relicManager.addRelic(id));

        if (this.difficultyLevel >= 3) {
            const curse = this.relicManager.generateRandomCurse();
            if (curse) {
                this.relicManager.addRelic(curse.id);
            }
        }

        const modifiedFortressHp = this.relicManager.applyFortressHpModifier(baseFortressHp);

        let startingGold = 120;
        const runStartContext = this.relicManager.applyTrigger(RelicTrigger.ON_RUN_START, {});
        const startingLives = 3 + (Number(runStartContext.extraLives) || 0);
        if (runStartContext.goldBonus) {
            startingGold += runStartContext.goldBonus as number;
        }

        this.runState = {
            currentStageIndex: startingStageIndex,
            currentNodeId: entryNodeId,
            completedNodeIds: [],
            fortressHp: modifiedFortressHp,
            fortressMaxHp: modifiedFortressHp,
            gold: startingGold,
            lives: startingLives,
            deck: [...deck],
            // Start with an empty collection; new rewards will populate this.
            cardCollection: [],
            relics: this.relicManager.getActiveRelicIds(),
            curses: this.relicManager.getCurses().map(c => c.id),
            commanderRoster: [commanderId],
            factionId: factionId,
            storySlides: this.createStorySlidesState(true),
            fortressUnlockedCells: { [fortressId]: initialUnlocked },
            fortressCellStates: { [fortressId]: [] }
        };

        this.updateNodeAccessibility();
        this.saveRun();
        this.emit('lives-updated', startingLives);
        this.emit('run-started', this.getRunState());
        this.emit('stage-entered', this.getStageSnapshot(startingStageIndex));
        this.emit('node-selected', this.getNodeSnapshot(entryNodeId));
    }

    public loadSavedRun(): boolean {
        const savedRun = this.saveManager.loadRun();
        if (!savedRun) {
            return false;
        }
        
        this.buildStageGraph();
        this.runState = savedRun;
        if (this.runState && !this.runState.fortressUnlockedCells) {
            const fortress = this.factionRegistry.getFortressForFaction(this.runState.factionId) ?? COG_DOMINION_STARTER.fortress;
            this.runState.fortressUnlockedCells = { [fortress.id]: this.getInitialUnlockedCells(fortress) };
        }
        if (this.runState && !this.runState.fortressCellStates) {
            const fortress = this.factionRegistry.getFortressForFaction(this.runState.factionId) ?? COG_DOMINION_STARTER.fortress;
            this.runState.fortressCellStates = { [fortress.id]: [] };
        }
        if (this.runState && (this.runState as any).lives === undefined) {
            this.runState.lives = 3;
        }
        if (this.runState) {
            const storySlides = this.ensureStorySlidesState(true);
            if (storySlides.stageIntroSeen.length === 0) {
                storySlides.stageIntroSeen = [this.runState.currentStageIndex];
            }
            this.saveRun();
        }
        
        // Restore relics
        this.relicManager.reset();
        savedRun.relics.forEach(id => this.relicManager.addRelic(id));
        savedRun.curses.forEach(id => this.relicManager.addRelic(id));
        
        this.updateNodeAccessibility();
        if (this.runState) {
            this.emit('lives-updated', this.runState.lives);
        }
        this.emit('run-loaded', this.getRunState());
        this.emit('stage-entered', this.getStageSnapshot(savedRun.currentStageIndex));
        this.emit('node-selected', this.getNodeSnapshot(savedRun.currentNodeId));
        
        return true;
    }

    public saveRun(): void {
        if (this.runState) {
            this.saveManager.saveRun(this.runState);
        }
    }

    public abandonRun(): void {
        this.saveManager.deleteSavedRun();
        this.runState = null;
        this.emit('run-abandoned');
    }

    public updateFortressUnlocks(fortressId: string, unlockedKeys: string[]): void {
        if (!this.runState) return;
        const record = this.runState.fortressUnlockedCells ?? {};
        record[fortressId] = unlockedKeys;
        this.runState.fortressUnlockedCells = record;
        this.saveRun();
    }

    public getFortressCellStates(fortressId: string): IFortressCellState[] {
        if (!this.runState) return [];
        const states = this.runState.fortressCellStates?.[fortressId] ?? [];
        return states.map(cell => ({ ...cell }));
    }

    public upsertFortressCellState(fortressId: string, entry: IFortressCellState): void {
        if (!this.runState) return;
        const record = this.runState.fortressCellStates ?? {};
        const states = record[fortressId] ? [...record[fortressId]] : [];
        const index = states.findIndex(cell => cell.x === entry.x && cell.y === entry.y);
        if (index >= 0) {
            states[index] = { ...entry };
        } else {
            states.push({ ...entry });
        }
        record[fortressId] = states;
        this.runState.fortressCellStates = record;
        this.saveRun();
    }

    public removeFortressCellState(fortressId: string, x: number, y: number): void {
        if (!this.runState) return;
        const record = this.runState.fortressCellStates ?? {};
        const states = record[fortressId] ? [...record[fortressId]] : [];
        const nextStates = states.filter(cell => cell.x !== x || cell.y !== y);
        record[fortressId] = nextStates;
        this.runState.fortressCellStates = record;
        this.saveRun();
    }

    public moveToNode(nodeId: string): boolean {
        if (!this.runState) return false;
        const node = this.nodeGraph.get(nodeId);
        if (!node || !node.isAccessible) {
            return false;
        }
        this.runState.currentNodeId = nodeId;
        // Update accessibility so other nodes become locked once a path is chosen
        this.updateNodeAccessibility();
        this.saveRun();
        this.emit('node-selected', this.getNodeSnapshot(nodeId));
        return true;
    }

    public canAccessNode(nodeId: string): boolean {
        const node = this.nodeGraph.get(nodeId);
        return !!node && node.isAccessible && !node.isCompleted;
    }

    public completeNode(nodeId: string): void {
        if (!this.runState) return;
        const node = this.nodeGraph.get(nodeId);
        if (!node || node.isCompleted) return;

        node.isCompleted = true;
        node.isAccessible = false;
        if (!this.runState.completedNodeIds.includes(nodeId)) {
            this.runState.completedNodeIds.push(nodeId);
        }
        this.saveRun();
        this.emit('node-completed', this.getNodeSnapshot(nodeId));

        if (node.type === NodeType.BOSS) {
            this.handleStageCompletion(node.stageIndex);
        } else {
            this.updateNodeAccessibility();
        }
    }

    public addCardToRunDeck(card: ICard): void {
        if (!this.runState) return;
        this.runState.deck.push(card);
        this.saveRun();
        this.emit('deck-updated', [...this.runState.deck]);
    }

    public removeCardFromRunDeck(cardId: string): ICard | undefined {
        if (!this.runState) return undefined;
        const index = this.runState.deck.findIndex(c => c.id === cardId);
        if (index === -1) return undefined;
        const [removed] = this.runState.deck.splice(index, 1);
        this.saveRun();
        this.emit('deck-updated', [...this.runState.deck]);
        return removed;
    }

    public setRunDeck(deck: ICard[]): void {
        if (!this.runState) return;
        this.runState.deck = [...deck];
        this.saveRun();
        this.emit('deck-updated', [...this.runState.deck]);
    }

    /**
     * Track that the player has acquired a card template (by id) during this run.
     * This does NOT add the card to the active deck; it only expands the pool
     * of cards visible in DeckBuilding \"Available Cards\".
     */
    public addCardToCollection(card: ICard): void {
        if (!this.runState) return;
        const baseId = this.normalizeCardId(card.id);
        if (!this.runState.cardCollection) {
            this.runState.cardCollection = [];
        }
        this.runState.cardCollection.push(baseId);
        this.saveRun();
    }

    public clearCardCollection(): void {
        if (!this.runState) return;
        this.runState.cardCollection = [];
        this.saveRun();
    }

    private normalizeCardId(id: string): string {
        let base = id.replace(/_\d+$/, '');
        base = base.replace(/_\d+$/, '');
        return base;
    }

    public addCommanderToRoster(commanderId: string): boolean {
        if (!this.runState) return false;
        if (this.runState.commanderRoster.includes(commanderId)) return false;
        this.runState.commanderRoster.push(commanderId);
        this.saveRun();
        this.emit('roster-updated', [...this.runState.commanderRoster]);
        return true;
    }

    public getCommanderRoster(): string[] {
        return this.runState?.commanderRoster ? [...this.runState.commanderRoster] : [];
    }

    public addRelic(relicId: string): void {
        if (!this.runState) return;
        const config = this.dataManager.getRelicConfig(relicId);
        if (this.relicManager.addRelic(relicId)) {
            this.runState.relics = this.relicManager.getActiveRelicIds();
            this.runState.curses = this.relicManager.getCurses().map(c => c.id);
            this.emit('relics-updated', [...this.runState.relics]);
                if (config?.isCursed) {
                    this.emit('curses-updated', [...this.runState.curses]);
                }
            if (config?.effect?.type === 'extra_life') {
                const bonus = Number(config.effect.value) || 1;
                this.addLives(bonus);
            } else {
                this.saveRun();
            }
        }
    }

    public addCurse(curseId: string): void {
        if (!this.runState) return;
        this.addRelic(curseId);
    }

    public removeRelic(relicId: string): boolean {
        if (!this.runState) return false;
        if (this.relicManager.removeRelic(relicId)) {
            this.runState.relics = this.relicManager.getActiveRelicIds();
            this.runState.curses = this.relicManager.getCurses().map(c => c.id);
            this.emit('relics-updated', [...this.runState.relics]);
            this.emit('curses-updated', [...this.runState.curses]);
            return true;
        }
        return false;
    }

    public removeCurse(curseId: string): boolean {
        return this.removeRelic(curseId);
    }

    public getRelicManager(): RelicManager {
        return this.relicManager;
    }

    public healFortress(amount: number): void {
        if (!this.runState) return;
        const modifiedAmount = this.relicManager.applyHealingModifier(amount);
        const nextHp = Math.min(this.runState.fortressHp + modifiedAmount, this.runState.fortressMaxHp);
        this.runState.fortressHp = nextHp;
        this.saveRun();
        this.emit('fortress-updated', { hp: nextHp, max: this.runState.fortressMaxHp });
    }

    public spendGold(amount: number): boolean {
        if (!this.runState) return false;
        const cost = Math.abs(amount);
        const nextGold = this.runState.gold - cost;
        if (nextGold < 0) return false;
        this.runState.gold = nextGold;
        this.saveRun();
        this.emit('gold-updated', nextGold);
        return true;
    }

    public gainGold(amount: number): void {
        if (!this.runState) return;
        const modifiedAmount = this.relicManager.applyGoldModifier(amount);
        this.runState.gold += modifiedAmount;
        this.saveRun();
        this.emit('gold-updated', this.runState.gold);
    }

    public getGold(): number {
        return this.runState ? this.runState.gold : 0;
    }

    public getLives(): number {
        return this.runState ? this.runState.lives : 0;
    }

    public addLives(amount: number): number {
        if (!this.runState) return 0;
        const gain = Math.max(0, Math.floor(amount));
        if (gain === 0) {
            return this.runState.lives;
        }
        this.runState.lives += gain;
        this.saveRun();
        this.emit('lives-updated', this.runState.lives);
        return this.runState.lives;
    }

    public loseLife(amount: number = 1): number {
        if (!this.runState) return 0;
        const loss = Math.max(0, Math.floor(amount));
        const nextLives = Math.max(0, this.runState.lives - loss);
        this.runState.lives = nextLives;
        if (nextLives > 0) {
            this.saveRun();
            this.emit('lives-updated', nextLives);
        } else {
            this.emit('lives-updated', nextLives);
            this.handleRunFailure();
        }
        return nextLives;
    }

    public getDeckSnapshot(): ICard[] {
        return this.runState ? [...this.runState.deck] : [];
    }

    public getCardCollection(): string[] {
        return this.runState ? [...(this.runState.cardCollection ?? [])] : [];
    }

    public removeRandomCard(predicate?: (card: ICard) => boolean): ICard | undefined {
        if (!this.runState || this.runState.deck.length === 0) return undefined;
        const deck = this.runState.deck;
        let indices = deck.map((_, index) => index);
        if (predicate) {
            indices = indices.filter(idx => predicate(deck[idx]));
        }
        if (indices.length === 0) return undefined;
        const removeIndex = Phaser.Math.Between(0, indices.length - 1);
        const index = indices[removeIndex];
        const [removed] = deck.splice(index, 1);
        this.saveRun();
        this.emit('deck-updated', [...deck]);
        return removed;
    }

    public damageFortress(amount: number): void {
        if (!this.runState) return;
        const loss = Math.max(0, Math.floor(amount));
        if (loss === 0) return;
        const nextHp = Math.max(0, this.runState.fortressHp - loss);
        this.runState.fortressHp = nextHp;
        this.saveRun();
        this.emit('fortress-updated', { hp: nextHp, max: this.runState.fortressMaxHp });
    }

    private handleRunFailure(): void {
        const snapshot = this.getRunState();
        this.saveManager.deleteSavedRun();
        this.runState = null;
        this.emit('run-failed', snapshot);
    }

    private buildStageGraph(): void {
        this.stageGraph.clear();
        this.stageGraphById.clear();
        this.nodeGraph.clear();
        this.inboundEdges.clear();

        const stages = this.dataManager.getAllStages();
        stages.forEach(stage => {
            const stageClone: IStageConfig = {
                id: stage.id,
                index: stage.index,
                name: stage.name,
                theme: stage.theme,
                musicKey: stage.musicKey,
                nodes: [],
                backgroundKey: stage.backgroundKey,
                bossNodeId: stage.bossNodeId,
                nextStageId: stage.nextStageId
            };

            stage.nodes.forEach(node => {
                const clonedNode: IMapNode = {
                    ...node,
                    nextNodeIds: [...node.nextNodeIds],
                    isCompleted: false,
                    isAccessible: false
                };
                stageClone.nodes.push(clonedNode);
                this.nodeGraph.set(clonedNode.id, clonedNode);

                clonedNode.nextNodeIds.forEach(nextId => {
                    const inbound = this.inboundEdges.get(nextId) ?? [];
                    inbound.push(clonedNode.id);
                    this.inboundEdges.set(nextId, inbound);
                });
            });

            this.stageGraph.set(stageClone.index, stageClone);
            this.stageGraphById.set(stageClone.id, stageClone);
        });
    }

    private findEntryNodeId(stageIndex: number): string {
        const stage = this.stageGraph.get(stageIndex);
        if (!stage || stage.nodes.length === 0) {
            throw new Error(`Stage ${stageIndex} has no nodes defined.`);
        }

        const entry = stage.nodes.find(node => {
            const inbound = (this.inboundEdges.get(node.id) || []).filter(prevId => {
                const prevNode = this.nodeGraph.get(prevId);
                return prevNode?.stageIndex === stageIndex;
            });
            return inbound.length === 0;
        });

        return (entry ?? stage.nodes[0]).id;
    }

    private handleStageCompletion(stageIndex: number): void {
        if (!this.runState) return;
        const stage = this.stageGraph.get(stageIndex);
        const storySlides = this.ensureStorySlidesState(true);
        storySlides.pendingStageOutroStageIndex = stageIndex;
        storySlides.pendingFinal = false;
        this.emit('stage-completed', this.getStageSnapshot(stageIndex));

        const nextStage = this.resolveNextStage(stage);
        if (!nextStage) {
            storySlides.pendingFinal = true;
            this.saveRun();
            this.emit('run-completed', this.getRunState());
            return;
        }

        this.runState.currentStageIndex = nextStage.index;
        const entryNodeId = this.findEntryNodeId(nextStage.index);
        this.runState.currentNodeId = entryNodeId;

        this.updateNodeAccessibility();
        this.saveRun();
        this.emit('stage-entered', this.getStageSnapshot(nextStage.index));
        this.emit('node-selected', this.getNodeSnapshot(entryNodeId));
    }

    private resolveNextStage(stage?: IStageConfig): IStageConfig | undefined {
        if (!stage) return undefined;
        if (stage.nextStageId) {
            return this.stageGraphById.get(stage.nextStageId);
        }
        return this.stageGraph.get(stage.index + 1);
    }

    private updateNodeAccessibility(): void {
        if (!this.runState) return;
        const currentNodeId = this.runState.currentNodeId;
        const currentNode = this.nodeGraph.get(currentNodeId);

        // Reset all nodes to inaccessible
        this.nodeGraph.forEach(node => {
            node.isAccessible = false;
        });

        const currentStage = this.stageGraph.get(this.runState.currentStageIndex);
        if (!currentStage || !currentNode || currentNode.stageIndex !== currentStage.index) {
            // Fallback: if current node is missing (e.g., new stage entry), jump to stage entry node
            const entryId = this.findEntryNodeId(this.runState.currentStageIndex);
            if (entryId) {
                this.runState.currentNodeId = entryId;
                const entryNode = this.nodeGraph.get(entryId);
                if (entryNode) {
                    entryNode.isAccessible = true;
                    this.saveRun();
                    return;
                }
            }
            return;
        }

        // CASE 1: Player is standing on a node that isn't finished yet.
        // Only that node should be clickable; all other paths are locked out.
        if (!currentNode.isCompleted) {
            currentNode.isAccessible = true;
                return;
            }

        // CASE 2: Current node is completed. The only valid choices are the
        // immediate children of this node (its outgoing edges). This enforces
        // a single-path progression like Slay the Spire: once you choose a
        // branch, you can't go back and pick nodes from a different branch.
        currentNode.nextNodeIds.forEach(nextId => {
            const nextNode = this.nodeGraph.get(nextId);
            if (nextNode && !nextNode.isCompleted) {
                nextNode.isAccessible = true;
            }
        });
    }

    public getCurrentStage(): IStageConfig | undefined {
        if (!this.runState) return undefined;
        return this.getStageSnapshot(this.runState.currentStageIndex);
    }

    public getCurrentNode(): IMapNode | undefined {
        if (!this.runState) return undefined;
        return this.getNodeSnapshot(this.runState.currentNodeId);
    }

    public getNodesForStage(stageIndex: number): IMapNode[] {
        const stage = this.stageGraph.get(stageIndex);
        if (!stage) return [];
        return stage.nodes.map(node => ({ ...node, nextNodeIds: [...node.nextNodeIds] }));
    }
}
