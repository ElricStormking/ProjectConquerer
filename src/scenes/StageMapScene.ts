import Phaser from 'phaser';
import { RunProgressionManager } from '../systems/RunProgressionManager';
import { NodeEncounterSystem } from '../systems/NodeEncounterSystem';
import { FactionRegistry } from '../systems/FactionRegistry';
import { IMapNode, IStageConfig } from '../types/ironwars';

const MAP_WIDTH = 2400;
const MAP_HEIGHT = 1080;

interface StageMapSceneData {
    loadSavedRun?: boolean;
}

export class StageMapScene extends Phaser.Scene {
    private readonly runManager = RunProgressionManager.getInstance();
    private readonly factionRegistry = FactionRegistry.getInstance();
    private encounterSystem!: NodeEncounterSystem;
    private nodeContainers: Map<string, Phaser.GameObjects.Container> = new Map();
    private pathGraphics!: Phaser.GameObjects.Graphics;
    private fortressToken?: Phaser.GameObjects.Image;
    private hudText?: Phaser.GameObjects.Text;
    private hudBg?: Phaser.GameObjects.Rectangle;
    private currentStageIndex = 0;
    private stageDecor?: Phaser.GameObjects.Container;
    private loadSavedRun = false;

    constructor() {
        super({ key: 'StageMapScene' });
    }

    init(data: StageMapSceneData): void {
        this.loadSavedRun = data.loadSavedRun ?? false;
    }

    create(): void {
        this.encounterSystem = new NodeEncounterSystem(this);
        
        // Handle saved run loading
        if (this.loadSavedRun) {
            const loaded = this.runManager.loadSavedRun();
            if (!loaded) {
                // No saved run found, go back to title
                this.scene.start('TitleMenuScene');
                return;
            }
        } else if (!this.runManager.hasActiveRun()) {
            // No active run and not loading saved - shouldn't happen, go to title
            this.scene.start('TitleMenuScene');
            return;
        }

        this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
        this.input.setPollAlways();

        this.pathGraphics = this.add.graphics();
        this.pathGraphics.setDepth(1);

        this.createHud();
        this.createHudButtons();
        this.registerRunEvents();
        this.renderCurrentStage();
    }

    private createHud(): void {
        // Dark overlay behind HUD for readability
        this.hudBg = this.add.rectangle(16, 22, 1100, 52, 0x0b0c10, 0.78)
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(198);
        this.hudText = this.add.text(32, 30, '', {
            fontSize: '28px',
            color: '#f8f8f8'
        })
            .setScrollFactor(0)
            .setDepth(200);
        this.refreshHud();
    }

    private createHudButtons(): void {
        const { width } = this.cameras.main;
        
        // Deck button
        this.createHudButton(width - 280, 35, 'DECK', () => this.openDeckBuilding());
        
        // Menu button
        this.createHudButton(width - 120, 35, 'MENU', () => this.openMenu());
    }

    private createHudButton(x: number, y: number, label: string, callback: () => void): void {
        const container = this.add.container(x, y);
        container.setScrollFactor(0);
        container.setDepth(100);
        
        const btnWidth = 120;
        const btnHeight = 40;
        
        const bg = this.add.graphics();
        bg.fillStyle(0x3d4663, 0.9);
        bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 6);
        bg.lineStyle(2, 0xd4a017, 1);
        bg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 6);
        container.add(bg);
        
        const text = this.add.text(0, 0, label, {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(text);
        
        // Interactive on the button background instead of the container
        bg.setInteractive(
            new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight),
            Phaser.Geom.Rectangle.Contains
        );
        
        bg.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x4d5673, 0.95);
            bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 6);
            bg.lineStyle(2, 0xf0dba5, 1);
            bg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 6);
            container.setScale(1.05);
        });
        
        bg.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x3d4663, 0.9);
            bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 6);
            bg.lineStyle(2, 0xd4a017, 1);
            bg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 6);
            container.setScale(1);
        });
        
        bg.on('pointerup', callback);
    }

    private openDeckBuilding(): void {
        const state = this.runManager.getRunState();
        if (!state) return;

        // Do not allow entering Deck Building while any modal reward/shop scenes are active,
        // otherwise those UIs can end up appearing on top of DeckBuildingScene and feel misplaced.
        const scenePlugin = this.scene;
        if (
            scenePlugin.isActive('RewardScene') ||
            scenePlugin.isActive('RelicRewardScene') ||
            scenePlugin.isActive('ShopScene') ||
            scenePlugin.isActive('RestScene') ||
            scenePlugin.isActive('CardRewardScene')
        ) {
            return;
        }
        
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.time.delayedCall(300, () => {
            this.scene.start('DeckBuildingScene', {
                factionId: state.factionId,
                isNewRun: false
            });
        });
    }

    private openMenu(): void {
        // Create menu overlay
        const { width, height } = this.cameras.main;
        
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
        overlay.setScrollFactor(0);
        overlay.setDepth(200);
        overlay.setInteractive();
        
        const menuContainer = this.add.container(width / 2, height / 2);
        menuContainer.setScrollFactor(0);
        menuContainer.setDepth(201);
        
        // Menu panel
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x1a1d2e, 0.95);
        panelBg.fillRoundedRect(-200, -180, 400, 360, 16);
        panelBg.lineStyle(2, 0xd4a017, 1);
        panelBg.strokeRoundedRect(-200, -180, 400, 360, 16);
        menuContainer.add(panelBg);
        
        // Title
        const title = this.add.text(0, -140, 'MENU', {
            fontFamily: 'Georgia, serif',
            fontSize: '32px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        menuContainer.add(title);
        
        // Resume button
        this.addMenuButton(menuContainer, 0, -60, 'Resume', () => {
            overlay.destroy();
            menuContainer.destroy();
        });
        
        // Options button
        this.addMenuButton(menuContainer, 0, 0, 'Options', () => {
            overlay.destroy();
            menuContainer.destroy();
            this.scene.launch('OptionsScene');
            this.scene.pause();
        });
        
        // Save & Quit button
        this.addMenuButton(menuContainer, 0, 60, 'Save & Quit', () => {
            this.runManager.saveRun();
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.time.delayedCall(300, () => {
                this.scene.start('TitleMenuScene');
            });
        });
        
        // Abandon Run button
        this.addMenuButton(menuContainer, 0, 120, 'Abandon Run', () => {
            this.runManager.abandonRun();
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.time.delayedCall(300, () => {
                this.scene.start('TitleMenuScene');
            });
        }, true);
    }

    private addMenuButton(
        container: Phaser.GameObjects.Container, 
        x: number, 
        y: number, 
        label: string, 
        callback: () => void,
        isDanger = false
    ): void {
        const btnContainer = this.add.container(x, y);
        const btnWidth = 240;
        const btnHeight = 50;
        
        const bg = this.add.graphics();
        const fillColor = isDanger ? 0x8b0000 : 0x3d4663;
        bg.fillStyle(fillColor, 0.9);
        bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 8);
        btnContainer.add(bg);
        
        const text = this.add.text(0, 0, label, {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        btnContainer.add(text);
        
        // Interactive on the button background instead of the container
        bg.setInteractive(
            new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight),
            Phaser.Geom.Rectangle.Contains
        );
        
        bg.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(isDanger ? 0xa00000 : 0x4d5673, 0.95);
            bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 8);
            btnContainer.setScale(1.05);
        });
        
        bg.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(fillColor, 0.9);
            bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 8);
            btnContainer.setScale(1);
        });
        
        bg.on('pointerup', callback);
        
        container.add(btnContainer);
    }

    private registerRunEvents(): void {
        this.runManager.on('stage-entered', this.onStageEntered, this);
        this.runManager.on('node-selected', this.onNodeSelected, this);
        this.runManager.on('node-completed', this.onNodeCompleted, this);
        this.runManager.on('gold-updated', this.refreshHud, this);
        this.runManager.on('fortress-updated', this.refreshHud, this);
        this.runManager.on('lives-updated', this.refreshHud, this);
        this.runManager.on('run-failed', this.onRunFailed, this);
        this.runManager.on('stage-completed', this.onStageCompleted, this);
        this.runManager.on('run-completed', this.onRunCompleted, this);
        this.events.on('battle-failed', this.onBattleFailed, this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.runManager.off('stage-entered', this.onStageEntered, this);
            this.runManager.off('node-selected', this.onNodeSelected, this);
            this.runManager.off('node-completed', this.onNodeCompleted, this);
            this.runManager.off('gold-updated', this.refreshHud, this);
            this.runManager.off('fortress-updated', this.refreshHud, this);
            this.runManager.off('lives-updated', this.refreshHud, this);
            this.runManager.off('run-failed', this.onRunFailed, this);
            this.runManager.off('stage-completed', this.onStageCompleted, this);
            this.runManager.off('run-completed', this.onRunCompleted, this);
            this.events.off('battle-failed', this.onBattleFailed, this);
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
        const bgKey = stage.backgroundKey || 'stage_default';
        if (this.textures.exists(bgKey)) {
            const bgImage = this.add.image(MAP_WIDTH / 2, MAP_HEIGHT / 2, bgKey);
            bgImage.setDisplaySize(MAP_WIDTH, MAP_HEIGHT);
            bgImage.setDepth(0);
            this.stageDecor.add(bgImage);
        } else {
            const bg = this.add.rectangle(MAP_WIDTH / 2, MAP_HEIGHT / 2, MAP_WIDTH, MAP_HEIGHT, 0x1c1f2b, 1).setDepth(0);
            this.stageDecor.add(bg);
        }
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

        // Interactive on the circle itself instead of the container.
        // Let Phaser infer the hit area from the circle shape.
        circle.setInteractive({ useHandCursor: true });
        circle.on('pointerdown', () => this.handleNodeClick(node.id));
        circle.on('pointerover', () => container.setScale(1.1));
        circle.on('pointerout', () => container.setScale(1));

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
        
        // Update node visuals to reflect that other paths are now locked
        this.updateAllNodeStates();
        const stage = this.runManager.getCurrentStage();
        if (stage) {
            this.drawPaths(stage);
        }
        
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
        // Lift the fortress token above the node so it doesn't block the node visuals.
        const tokenY = position.y - 100;
        if (!this.fortressToken) {
            // Get the player's current fortress image key
            const runState = this.runManager.getRunState();
            const factionId = runState?.factionId ?? 'jade_dynasty';
            const gridConfig = this.factionRegistry.getFortressGridConfig(`fortress_${factionId}_01`);
            const imageKey = gridConfig?.imageKey ?? 'fortress_jade_dynasty_01';
            
            // Create fortress image as the map token
            if (this.textures.exists(imageKey)) {
                this.fortressToken = this.add.image(position.x, tokenY, imageKey);
                this.fortressToken.setScale(0.12); // Scale down for map display
                this.fortressToken.setDepth(10);
            } else {
                // Fallback to a simple circle if image not found
                const fallback = this.add.ellipse(position.x, tokenY, 28, 28, 0xf0f4ff, 1);
                fallback.setStrokeStyle(4, 0x1d9bf0);
                fallback.setDepth(10);
                this.fortressToken = fallback as unknown as Phaser.GameObjects.Image;
            }
        }
        this.tweens.add({
            targets: this.fortressToken,
            x: position.x,
            y: tokenY,
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
        const faction = this.factionRegistry.getFaction(state.factionId);
        this.hudText.setText(
            `${faction?.name ?? 'Unknown'}  |  Stage: ${stage?.name ?? '-'}  |  HP: ${state.fortressHp}/${state.fortressMaxHp}  |  Lives: ${state.lives}  |  Gold: ${state.gold}  |  Deck: ${state.deck.length}`
        );
        const textWidth = this.hudText.width;
        const textHeight = this.hudText.height;
        const paddingX = 32;
        const paddingY = 16;
        if (this.hudBg) {
            const targetW = textWidth + paddingX * 2;
            const targetH = textHeight + paddingY * 2;
            this.hudBg.setVisible(true);
            this.hudBg.setSize(targetW, targetH);
        }
        // #region agent log
        // logging disabled (previously posted HUD sizing to local ingest)
        // #endregion
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

    private onBattleFailed = (_node?: IMapNode, livesLeft?: number) => {
        this.refreshHud();
        const message = livesLeft !== undefined ? `Life lost! Lives left: ${livesLeft}` : 'Life lost!';
        this.showBanner(message);
    };

    private onRunFailed = () => {
        this.showBanner('Run Failed - Out of Lives');
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.time.delayedCall(450, () => {
            this.scene.start('TitleMenuScene');
        });
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
