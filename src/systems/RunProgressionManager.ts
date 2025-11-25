import Phaser from 'phaser';
import { DataManager } from './DataManager';
import { COG_DOMINION_STARTER } from '../data/ironwars/cog_dominion_starter';
import {
    IRunState,
    IStageConfig,
    IMapNode,
    ICard,
    NodeType
} from '../types/ironwars';

export type RunStateSnapshot = IRunState & { deck: ICard[] };

export class RunProgressionManager extends Phaser.Events.EventEmitter {
    private static instance: RunProgressionManager;

    private readonly dataManager = DataManager.getInstance();
    private runState: IRunState | null = null;
    private stageGraph: Map<number, IStageConfig> = new Map();
    private stageGraphById: Map<string, IStageConfig> = new Map();
    private nodeGraph: Map<string, IMapNode> = new Map();
    private inboundEdges: Map<string, string[]> = new Map();

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
            commanderRoster: [...this.runState.commanderRoster]
        };
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

    public startNewRun(): void {
        this.buildStageGraph();
        const starter = COG_DOMINION_STARTER;
        const startingStageIndex = 0;
        const entryNodeId = this.findEntryNodeId(startingStageIndex);

        this.runState = {
            currentStageIndex: startingStageIndex,
            currentNodeId: entryNodeId,
            completedNodeIds: [],
            fortressHp: starter.fortress.maxHp,
            fortressMaxHp: starter.fortress.maxHp,
            gold: 120,
            deck: [...starter.deck],
            relics: [],
            curses: [],
            commanderRoster: [starter.commander.id]
        };

        this.updateNodeAccessibility();
        this.emit('run-started', this.getRunState());
        this.emit('stage-entered', this.getStageSnapshot(startingStageIndex));
        this.emit('node-selected', this.getNodeSnapshot(entryNodeId));
    }

    public moveToNode(nodeId: string): boolean {
        if (!this.runState) return false;
        const node = this.nodeGraph.get(nodeId);
        if (!node || !node.isAccessible) {
            return false;
        }
        this.runState.currentNodeId = nodeId;
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
        this.emit('deck-updated', [...this.runState.deck]);
    }

    public addRelic(relicId: string): void {
        if (!this.runState) return;
        if (!this.runState.relics.includes(relicId)) {
            this.runState.relics.push(relicId);
            this.emit('relics-updated', [...this.runState.relics]);
        }
    }

    public addCurse(curseId: string): void {
        if (!this.runState) return;
        this.runState.curses.push(curseId);
        this.emit('curses-updated', [...this.runState.curses]);
    }

    public healFortress(amount: number): void {
        if (!this.runState) return;
        const nextHp = Math.min(this.runState.fortressHp + amount, this.runState.fortressMaxHp);
        this.runState.fortressHp = nextHp;
        this.emit('fortress-updated', { hp: nextHp, max: this.runState.fortressMaxHp });
    }

    public spendGold(amount: number): boolean {
        if (!this.runState) return false;
        const cost = Math.abs(amount);
        const nextGold = this.runState.gold - cost;
        if (nextGold < 0) return false;
        this.runState.gold = nextGold;
        this.emit('gold-updated', nextGold);
        return true;
    }

    public gainGold(amount: number): void {
        if (!this.runState) return;
        this.runState.gold += amount;
        this.emit('gold-updated', this.runState.gold);
    }

    public getGold(): number {
        return this.runState ? this.runState.gold : 0;
    }

    public getDeckSnapshot(): ICard[] {
        return this.runState ? [...this.runState.deck] : [];
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
        const completed = new Set(this.runState.completedNodeIds);

        this.nodeGraph.forEach(node => {
            node.isAccessible = false;
            if (completed.has(node.id)) {
                node.isAccessible = false;
            }
        });

        const currentStage = this.stageGraph.get(this.runState.currentStageIndex);
        if (!currentStage) return;

        currentStage.nodes.forEach(node => {
            if (completed.has(node.id)) {
                node.isAccessible = false;
                return;
            }

            const inbound = (this.inboundEdges.get(node.id) || []).filter(prevId => {
                const prevNode = this.nodeGraph.get(prevId);
                return prevNode?.stageIndex === currentStage.index;
            });

            if (inbound.length === 0) {
                node.isAccessible = true;
                return;
            }

            const unlocked = inbound.every(prevId => completed.has(prevId));
            node.isAccessible = unlocked;
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
