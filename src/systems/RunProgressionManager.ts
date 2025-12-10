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
    RelicTrigger
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

    public getRunState(): RunStateSnapshot | null {
        if (!this.runState) return null;
        return {
            ...this.runState,
            deck: [...this.runState.deck],
            completedNodeIds: [...this.runState.completedNodeIds],
            relics: [...this.runState.relics],
            curses: [...this.runState.curses],
            commanderRoster: [...this.runState.commanderRoster],
            cardCollection: [...(this.runState.cardCollection ?? [])],
            factionId: this.runState.factionId
        };
    }

    public getFactionId(): string {
        return this.runState?.factionId ?? 'cog_dominion';
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
            deck: [...deck],
            // Start with an empty collection; new rewards will populate this.
            cardCollection: [],
            relics: this.relicManager.getActiveRelicIds(),
            curses: this.relicManager.getCurses().map(c => c.id),
            commanderRoster: [commanderId],
            factionId: factionId
        };

        this.updateNodeAccessibility();
        this.saveRun();
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
        
        // Restore relics
        this.relicManager.reset();
        savedRun.relics.forEach(id => this.relicManager.addRelic(id));
        savedRun.curses.forEach(id => this.relicManager.addRelic(id));
        
        this.updateNodeAccessibility();
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
        if (this.relicManager.addRelic(relicId)) {
            this.runState.relics = this.relicManager.getActiveRelicIds();
            this.runState.curses = this.relicManager.getCurses().map(c => c.id);
            this.emit('relics-updated', [...this.runState.relics]);
            if (this.relicManager.hasRelic(relicId)) {
                const config = this.dataManager.getRelicConfig(relicId);
                if (config?.isCursed) {
                    this.emit('curses-updated', [...this.runState.curses]);
                }
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
        this.emit('deck-updated', [...deck]);
        return removed;
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
        this.emit('stage-completed', this.getStageSnapshot(stageIndex));

        const nextStage = this.resolveNextStage(stage);
        if (!nextStage) {
            this.emit('run-completed', this.getRunState());
            return;
        }

        this.runState.currentStageIndex = nextStage.index;
        const entryNodeId = this.findEntryNodeId(nextStage.index);
        this.runState.currentNodeId = entryNodeId;
        this.updateNodeAccessibility();
        this.emit('stage-entered', this.getStageSnapshot(nextStage.index));
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
        if (!currentStage || !currentNode) return;

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
