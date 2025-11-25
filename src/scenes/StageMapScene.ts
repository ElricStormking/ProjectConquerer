import Phaser from 'phaser';
import { RunProgressionManager } from '../systems/RunProgressionManager';
import { NodeEncounterSystem } from '../systems/NodeEncounterSystem';
import { IMapNode, IStageConfig } from '../types/ironwars';

const MAP_WIDTH = 2400;
const MAP_HEIGHT = 1080;

export class StageMapScene extends Phaser.Scene {
    private readonly runManager = RunProgressionManager.getInstance();
    private encounterSystem!: NodeEncounterSystem;
    private nodeContainers: Map<string, Phaser.GameObjects.Container> = new Map();
    private pathGraphics!: Phaser.GameObjects.Graphics;
    private fortressToken?: Phaser.GameObjects.Ellipse;
    private hudText?: Phaser.GameObjects.Text;
    private currentStageIndex = 0;
    private stageDecor?: Phaser.GameObjects.Container;

    constructor() {
        super({ key: 'StageMapScene' });
    }

    create(): void {
        this.encounterSystem = new NodeEncounterSystem(this);
        if (!this.runManager.hasActiveRun()) {
            this.runManager.startNewRun();
        }

        this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
        this.input.setPollAlways();

        this.pathGraphics = this.add.graphics();
        this.pathGraphics.setDepth(1);

        this.createHud();
        this.registerRunEvents();
        this.renderCurrentStage();
    }

    private createHud(): void {
        this.hudText = this.add.text(32, 32, '', {
            fontSize: '28px',
            color: '#f8f8f8'
        }).setScrollFactor(0);
        this.refreshHud();
    }

    private registerRunEvents(): void {
        this.runManager.on('stage-entered', this.onStageEntered, this);
        this.runManager.on('node-selected', this.onNodeSelected, this);
        this.runManager.on('node-completed', this.onNodeCompleted, this);
        this.runManager.on('gold-updated', this.refreshHud, this);
        this.runManager.on('fortress-updated', this.refreshHud, this);
        this.runManager.on('stage-completed', this.onStageCompleted, this);
        this.runManager.on('run-completed', this.onRunCompleted, this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.runManager.off('stage-entered', this.onStageEntered, this);
            this.runManager.off('node-selected', this.onNodeSelected, this);
            this.runManager.off('node-completed', this.onNodeCompleted, this);
            this.runManager.off('gold-updated', this.refreshHud, this);
            this.runManager.off('fortress-updated', this.refreshHud, this);
            this.runManager.off('stage-completed', this.onStageCompleted, this);
            this.runManager.off('run-completed', this.onRunCompleted, this);
        });
    }

    private renderCurrentStage(): void {
        const state = this.runManager.getRunState();
        this.currentStageIndex = state?.currentStageIndex ?? 0;
        const stage = this.runManager.getStageSnapshot(this.currentStageIndex);
        if (!stage) return;
        this.renderStage(stage);
    }

    private renderStage(stage: IStageConfig): void {
        this.stageDecor?.destroy();
        this.stageDecor = undefined;
        this.nodeContainers.forEach(container => container.destroy());
        this.nodeContainers.clear();
        this.pathGraphics.clear();
        this.currentStageIndex = stage.index;

        this.drawBackground(stage);
        this.drawPaths(stage);
        stage.nodes.forEach(node => this.createNodeContainer(node));
        this.updateAllNodeStates();
        this.moveFortressToken(this.runManager.getCurrentNode());
        this.refreshHud();
    }

    private drawBackground(stage: IStageConfig): void {
        this.cameras.main.fadeIn(300, 0, 0, 0);
        this.stageDecor = this.add.container(0, 0);
        this.stageDecor.setDepth(0);
        const bg = this.add.rectangle(MAP_WIDTH / 2, MAP_HEIGHT / 2, MAP_WIDTH, MAP_HEIGHT, 0x1c1f2b, 1).setDepth(0);
        this.stageDecor.add(bg);
        const title = this.add.text(MAP_WIDTH / 2, 80, stage.name, {
            fontSize: '48px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2);
        this.stageDecor.add(title);
        this.time.delayedCall(4000, () => title.destroy());
    }

    private drawPaths(stage: IStageConfig): void {
        this.pathGraphics.clear();
        stage.nodes.forEach(snapshotNode => {
            const liveSource = this.runManager.getNodeSnapshot(snapshotNode.id) ?? snapshotNode;
            liveSource.nextNodeIds.forEach(nextId => {
                const targetSnapshot = stage.nodes.find(n => n.id === nextId);
                if (!targetSnapshot) return;
                const liveTarget = this.runManager.getNodeSnapshot(nextId) ?? targetSnapshot;

                // Default: locked path
                let color = 0x353c4f;
                let alpha = 0.25;
                let thickness = 4;

                if (liveSource.isCompleted) {
                    // Path already taken
                    color = 0x22c55e;
                    alpha = 0.95;
                    thickness = 7;
                } else if (liveSource.isAccessible && !liveSource.isCompleted && !liveTarget.isCompleted) {
                    // Next step options from current accessible node
                    color = 0xfbbf24;
                    alpha = 0.9;
                    thickness = 6;
                }

                this.pathGraphics.lineStyle(thickness, color, alpha);
                const start = this.normalizeToPixels(liveSource);
                const end = this.normalizeToPixels(liveTarget);
                this.pathGraphics.lineBetween(start.x, start.y, end.x, end.y);
            });
        });
    }

    private createNodeContainer(node: IMapNode): void {
        const position = this.normalizeToPixels(node);
        const container = this.add.container(position.x, position.y);
        container.setDepth(5);

        const circle = this.add.circle(0, 0, 28, 0x4e566d, 0.95);
        circle.setStrokeStyle(4, 0x0b0e16);
        container.add(circle);

        const label = this.add.text(0, 40, node.type.toUpperCase(), {
            fontSize: '16px',
            color: '#d7e0ff'
        }).setOrigin(0.5);
        container.add(label);

        container.setSize(80, 80);
        container.setInteractive(new Phaser.Geom.Circle(0, 0, 32), Phaser.Geom.Circle.Contains);
        container.on('pointerdown', () => this.handleNodeClick(node.id));
        container.on('pointerover', () => container.setScale(1.1));
        container.on('pointerout', () => container.setScale(1));

        this.nodeContainers.set(node.id, container);
    }

    private handleNodeClick(nodeId: string): void {
        const node = this.runManager.getNodeSnapshot(nodeId);
        if (!node) return;
        if (!this.runManager.canAccessNode(nodeId)) {
            return;
        }

        this.runManager.moveToNode(nodeId);
        this.moveFortressToken(node);
        this.encounterSystem.resolveNode(node);
    }

    private updateAllNodeStates(): void {
        this.nodeContainers.forEach((container, nodeId) => {
            const node = this.runManager.getNodeSnapshot(nodeId);
            if (!node) return;
            const circle = container.list[0] as Phaser.GameObjects.Arc;
            if (node.isCompleted) {
                circle.setFillStyle(0x16a34a, 1);
                circle.setStrokeStyle(4, 0x22c55e, 1);
                container.setAlpha(1);
                container.setScale(1);
            } else if (node.isAccessible) {
                circle.setFillStyle(0xf97316, 1);
                circle.setStrokeStyle(4, 0xfff7c2, 1);
                container.setAlpha(1);
                container.setScale(1.08);
            } else {
                circle.setFillStyle(0x374151, 0.6);
                circle.setStrokeStyle(2, 0x111827, 0.7);
                container.setAlpha(0.55);
                container.setScale(1);
            }
        });

        const stage = this.runManager.getStageSnapshot(this.currentStageIndex);
        if (stage) {
            this.drawPaths(stage);
        }
    }

    private moveFortressToken(node?: IMapNode): void {
        if (!node) return;
        const position = this.normalizeToPixels(node);
        if (!this.fortressToken) {
            this.fortressToken = this.add.ellipse(position.x, position.y, 28, 28, 0xf0f4ff, 1);
            this.fortressToken.setStrokeStyle(4, 0x1d9bf0);
            this.fortressToken.setDepth(10);
        }
        this.tweens.add({
            targets: this.fortressToken,
            x: position.x,
            y: position.y,
            duration: 450,
            ease: 'Sine.easeInOut'
        });
        this.cameras.main.pan(position.x, position.y, 450, 'Sine.easeInOut');
    }

    private normalizeToPixels(node: IMapNode): { x: number; y: number } {
        return {
            x: node.posX * MAP_WIDTH,
            y: node.posY * MAP_HEIGHT
        };
    }

    private refreshHud(): void {
        if (!this.hudText) return;
        const state = this.runManager.getRunState();
        if (!state) {
            this.hudText.setText('No run active');
            return;
        }
        const stage = this.runManager.getStageSnapshot(state.currentStageIndex);
        this.hudText.setText(
            `Stage: ${stage?.name ?? '-'}  |  Fortress HP: ${state.fortressHp}/${state.fortressMaxHp}  |  Gold: ${state.gold}`
        );
    }

    private onStageEntered = (stage?: IStageConfig) => {
        if (stage) {
            this.renderStage(stage);
        } else {
            this.renderCurrentStage();
        }
    };

    private onNodeSelected = (node?: IMapNode) => {
        if (node) {
            this.moveFortressToken(node);
        }
        this.updateAllNodeStates();
    };

    private onNodeCompleted = () => {
        this.updateAllNodeStates();
    };

    private onStageCompleted = (stage?: IStageConfig) => {
        this.showBanner(`${stage?.name ?? 'Stage'} Cleared!`);
    };

    private onRunCompleted = () => {
        this.showBanner('Run Complete! Victory!');
    };

    private showBanner(message: string): void {
        const banner = this.add.text(960, 120, message, {
            fontSize: '54px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(20);
        this.tweens.add({
            targets: banner,
            alpha: 0,
            duration: 2000,
            delay: 800,
            onComplete: () => banner.destroy()
        });
    }
}
