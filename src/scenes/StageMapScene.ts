import Phaser from 'phaser';
import { RunProgressionManager } from '../systems/RunProgressionManager';
import { NodeEncounterSystem } from '../systems/NodeEncounterSystem';
import { FactionRegistry } from '../systems/FactionRegistry';
import { getFinalSlides, getStageIntroSlides, getStageOutroSlides } from '../data/StorySlides';
import { RelicInventoryUI } from '../ui/RelicInventoryUI';
import { IMapNode, IStageConfig } from '../types/ironwars';

const MAP_WIDTH = 2400;
const MAP_HEIGHT = 1080;

interface StageMapSceneData {
    loadSavedRun?: boolean;
}

interface PathRenderStyle {
    color: number;
    alpha: number;
    thickness: number;
    dashLength: number;
    gapLength: number;
}

export class StageMapScene extends Phaser.Scene {
    private readonly runManager = RunProgressionManager.getInstance();
    private readonly factionRegistry = FactionRegistry.getInstance();
    private encounterSystem!: NodeEncounterSystem;
    private nodeContainers: Map<string, Phaser.GameObjects.Container> = new Map();
    private pathGraphics!: Phaser.GameObjects.Graphics;
    private fortressToken?: Phaser.GameObjects.Container;
    private hudText?: Phaser.GameObjects.Text;
    private hudBg?: Phaser.GameObjects.Rectangle;
    private deckAttentionDot?: Phaser.GameObjects.Container;
    private relicInventory?: RelicInventoryUI;
    private currentStageIndex = 0;
    private stageDecor?: Phaser.GameObjects.Container;
    private loadSavedRun = false;
    private stageBgm?: Phaser.Sound.BaseSound;
    private stageBgmKey: string = '';
    private storySlidesActive = false;
    private fortressMoveTween?: Phaser.Tweens.Tween;
    private pendingEncounterNodeId?: string;
    private nodeTransitionInProgress = false;
    private gameOverOverlay?: Phaser.GameObjects.Container;

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
        this.createRelicInventory();
        this.registerRunEvents();
        this.renderCurrentStage();
        this.maybeShowStorySlides();

        this.events.on(Phaser.Scenes.Events.WAKE, this.onSceneWake, this);
        this.events.on(Phaser.Scenes.Events.RESUME, this.onSceneWake, this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.events.off(Phaser.Scenes.Events.WAKE, this.onSceneWake, this);
            this.events.off(Phaser.Scenes.Events.RESUME, this.onSceneWake, this);
            this.stopStageBgm();
            this.fortressMoveTween?.stop();
            this.fortressMoveTween = undefined;
            this.pendingEncounterNodeId = undefined;
            this.nodeTransitionInProgress = false;
            this.gameOverOverlay?.destroy();
            this.gameOverOverlay = undefined;
            this.fortressToken = undefined;
            this.relicInventory?.destroy();
            this.relicInventory = undefined;
        });
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
        const deckButton = this.createHudButton(width - 280, 35, 'DECK', () => this.openDeckBuilding());
        this.deckAttentionDot = this.createDeckAttentionDot(deckButton, 54, -16);
        this.updateDeckAttentionDot();
        
        // Menu button
        this.createHudButton(width - 120, 35, 'MENU', () => this.openMenu());
    }

    private createHudButton(x: number, y: number, label: string, callback: () => void): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        container.setScrollFactor(0);
        container.setDepth(240);
        
        const btnWidth = 120;
        const btnHeight = 40;
        
        const bg = this.add.graphics();
        bg.fillStyle(0x3d4663, 0.9);
        bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 6);
        bg.lineStyle(2, 0xd4a017, 1);
        bg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 6);
        bg.setScrollFactor(0);
        container.add(bg);
        
        const text = this.add.text(0, 0, label, {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        text.setScrollFactor(0);
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
        return container;
    }

    private createDeckAttentionDot(parent: Phaser.GameObjects.Container, x: number, y: number): Phaser.GameObjects.Container {
        const dot = this.add.container(x, y);
        dot.setVisible(false);

        const halo = this.add.circle(0, 0, 13, 0xff2e22, 0.22);
        dot.add(halo);

        const body = this.add.circle(0, 0, 8, 0xd41414, 1);
        body.setStrokeStyle(2, 0xfff1d0, 1);
        dot.add(body);

        const shine = this.add.circle(-3, -3, 2.5, 0xffb6a8, 0.95);
        dot.add(shine);

        this.tweens.add({
            targets: halo,
            scale: { from: 0.82, to: 1.26 },
            alpha: { from: 0.5, to: 0.12 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        parent.add(dot);
        return dot;
    }

    private updateDeckAttentionDot = (): void => {
        this.deckAttentionDot?.setVisible(this.runManager.hasNewCardsAvailable());
    }

    private createRelicInventory(): void {
        const { width } = this.cameras.main;
        this.relicInventory?.destroy();
        this.relicInventory = new RelicInventoryUI(this, width - 32, 110);
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
        this.runManager.on('new-cards-available-updated', this.updateDeckAttentionDot, this);
        this.runManager.on('run-failed', this.onRunFailed, this);
        this.runManager.on('stage-completed', this.onStageCompleted, this);
        this.runManager.on('run-completed', this.onRunCompleted, this);
        this.events.on('battle-failed', this.onBattleFailed, this);
        this.events.on('node-resolved', this.onNodeResolved, this);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.runManager.off('stage-entered', this.onStageEntered, this);
            this.runManager.off('node-selected', this.onNodeSelected, this);
            this.runManager.off('node-completed', this.onNodeCompleted, this);
            this.runManager.off('gold-updated', this.refreshHud, this);
            this.runManager.off('fortress-updated', this.refreshHud, this);
            this.runManager.off('lives-updated', this.refreshHud, this);
            this.runManager.off('new-cards-available-updated', this.updateDeckAttentionDot, this);
            this.runManager.off('run-failed', this.onRunFailed, this);
            this.runManager.off('stage-completed', this.onStageCompleted, this);
            this.runManager.off('run-completed', this.onRunCompleted, this);
            this.events.off('battle-failed', this.onBattleFailed, this);
            this.events.off('node-resolved', this.onNodeResolved, this);
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

        // Stage-specific BGM
        this.playStageBgm();

        this.drawBackground(stage);
        this.drawPaths(stage);
        stage.nodes.forEach(node => this.createNodeContainer(node));
        this.updateAllNodeStates();
        this.moveFortressToken(this.runManager.getCurrentNode());
        this.refreshHud();
    }

    private playStageBgm(): void {
        const state = this.runManager.getRunState();
        const stageIndex = state?.currentStageIndex ?? 0;
        const key =
            stageIndex === 0
                ? 'bgm_stage_triarch'
                : stageIndex === 2
                ? 'bgm_stage_jade'
                : stageIndex === 3
                ? 'bgm_stage_elf'
                : stageIndex === 4
                ? 'bgm_stage_abyss'
                : 'bgm_stage_frost';
        this.stageBgmKey = key;

        // If already playing correct track, keep it.
        const existing = this.sound.get(key);
        if (existing && existing.isPlaying) {
            this.stageBgm = existing;
            return;
        }

        // Stop other music and start the correct map track.
        this.sound.stopAll();
        this.stageBgm?.destroy();
        this.stageBgm = this.sound.add(key, { loop: true, volume: 0.6 });
        this.stageBgm.play();
    }

    private stopStageBgm(): void {
        if (this.stageBgm) {
            this.stageBgm.stop();
            this.stageBgm.destroy();
            this.stageBgm = undefined;
        }
        if (this.stageBgmKey) {
            this.sound.removeByKey(this.stageBgmKey);
        }
    }

    private onSceneWake(): void {
        const stageIndex = this.runManager.getRunState()?.currentStageIndex ?? 0;
        if (stageIndex !== this.currentStageIndex) {
            this.renderCurrentStage();
        } else {
            this.playStageBgm();
            this.moveFortressToken(this.runManager.getCurrentNode());
        }
        this.updateDeckAttentionDot();
        this.maybeShowStorySlides();
    }

    private drawBackground(stage: IStageConfig): void {
        this.cameras.main.fadeIn(300, 0, 0, 0);
        this.stageDecor = this.add.container(0, 0);
        this.stageDecor.setDepth(0);

        this.drawParchmentBase(this.stageDecor);
        this.drawCartographyGrid(this.stageDecor);
        this.drawMapLandmarks(this.stageDecor, stage);
        this.drawCompassRose(this.stageDecor, MAP_WIDTH - 225, MAP_HEIGHT - 205);
        this.drawMapBorder(this.stageDecor);

        const titlePlate = this.add.graphics();
        titlePlate.fillStyle(0x4b321d, 0.26);
        titlePlate.fillRoundedRect(MAP_WIDTH / 2 - 340, 92, 680, 72, 10);
        titlePlate.lineStyle(3, 0xe4c179, 0.42);
        titlePlate.strokeRoundedRect(MAP_WIDTH / 2 - 340, 92, 680, 72, 10);
        titlePlate.lineStyle(1, 0x2a1a0f, 0.35);
        titlePlate.strokeRoundedRect(MAP_WIDTH / 2 - 318, 103, 636, 50, 7);
        this.stageDecor.add(titlePlate);

        const title = this.add.text(MAP_WIDTH / 2, 126, stage.name, {
            fontFamily: 'Georgia, serif',
            fontSize: '44px',
            color: '#2a190d',
            fontStyle: 'bold',
            stroke: '#e5c884',
            strokeThickness: 4
        }).setOrigin(0.5);
        this.stageDecor.add(title);
        this.time.delayedCall(4000, () => {
            titlePlate.destroy();
            title.destroy();
        });
    }

    private drawParchmentBase(container: Phaser.GameObjects.Container): void {
        const base = this.add.rectangle(MAP_WIDTH / 2, MAP_HEIGHT / 2, MAP_WIDTH, MAP_HEIGHT, 0xa98042, 1);
        container.add(base);

        const wash = this.add.graphics();
        wash.fillStyle(0xe4c27d, 0.96);
        wash.fillRect(64, 52, MAP_WIDTH - 128, MAP_HEIGHT - 104);
        wash.fillStyle(0xf4dea6, 0.32);
        wash.fillRect(120, 116, MAP_WIDTH - 240, MAP_HEIGHT - 238);
        wash.fillStyle(0x76562b, 0.18);
        wash.fillRect(64, 52, 26, MAP_HEIGHT - 104);
        wash.fillRect(MAP_WIDTH - 90, 52, 26, MAP_HEIGHT - 104);
        wash.fillRect(64, 52, MAP_WIDTH - 128, 24);
        wash.fillRect(64, MAP_HEIGHT - 76, MAP_WIDTH - 128, 24);
        container.add(wash);

        const texture = this.add.graphics();
        for (let i = 0; i < 240; i++) {
            const x = this.seededRange('map-speck-x', i, 30, MAP_WIDTH - 30);
            const y = this.seededRange('map-speck-y', i, 70, MAP_HEIGHT - 35);
            const radius = this.seededRange('map-speck-r', i, 1.2, 7.5);
            const alpha = this.seededRange('map-speck-a', i, 0.035, 0.13);
            texture.fillStyle(i % 5 === 0 ? 0x50331d : 0xf6e4b6, alpha);
            texture.fillCircle(x, y, radius);
        }

        for (let i = 0; i < 46; i++) {
            const x = this.seededRange('map-stain-x', i, 110, MAP_WIDTH - 110);
            const y = this.seededRange('map-stain-y', i, 115, MAP_HEIGHT - 105);
            const radius = this.seededRange('map-stain-r', i, 22, 84);
            texture.fillStyle(i % 3 === 0 ? 0x295c61 : 0x7a3d21, i % 3 === 0 ? 0.045 : 0.05);
            texture.fillCircle(x, y, radius);
        }

        texture.lineStyle(1, 0x6e4f29, 0.12);
        for (let i = 0; i < 70; i++) {
            const x = this.seededRange('paper-fiber-x', i, 90, MAP_WIDTH - 90);
            const y = this.seededRange('paper-fiber-y', i, 82, MAP_HEIGHT - 82);
            const length = this.seededRange('paper-fiber-l', i, 36, 160);
            const bend = this.seededRange('paper-fiber-b', i, -20, 20);
            texture.lineBetween(x, y, x + length, y + bend);
        }
        container.add(texture);

        const shadow = this.add.graphics();
        shadow.fillStyle(0x201208, 0.22);
        shadow.fillRect(0, 0, MAP_WIDTH, 72);
        shadow.fillRect(0, MAP_HEIGHT - 82, MAP_WIDTH, 82);
        shadow.fillRect(0, 0, 86, MAP_HEIGHT);
        shadow.fillRect(MAP_WIDTH - 90, 0, 90, MAP_HEIGHT);
        shadow.fillStyle(0x0f0b09, 0.12);
        shadow.fillRect(0, 0, MAP_WIDTH, 20);
        shadow.fillRect(0, MAP_HEIGHT - 20, MAP_WIDTH, 20);
        container.add(shadow);
    }

    private drawCartographyGrid(container: Phaser.GameObjects.Container): void {
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x5a412a, 0.1);
        for (let x = 176; x < MAP_WIDTH - 90; x += 196) {
            grid.lineBetween(x, 82, x + this.seededRange('grid-x-drift', x, -22, 22), MAP_HEIGHT - 82);
        }
        for (let y = 150; y < MAP_HEIGHT - 80; y += 148) {
            grid.lineBetween(82, y, MAP_WIDTH - 82, y + this.seededRange('grid-y-drift', y, -16, 16));
        }

        grid.lineStyle(2, 0x315e60, 0.17);
        for (let x = 315; x < MAP_WIDTH; x += 560) {
            grid.strokeCircle(x, MAP_HEIGHT / 2 + this.seededRange('circle-lat', x, -95, 95), 270);
        }

        grid.lineStyle(1, 0x7a2f20, 0.16);
        for (let i = 0; i < 13; i++) {
            const x = this.seededRange('red-hatch-x', i, 140, MAP_WIDTH - 140);
            const y = this.seededRange('red-hatch-y', i, 210, MAP_HEIGHT - 160);
            for (let j = 0; j < 4; j++) {
                grid.lineBetween(x + j * 18, y + j * 4, x + 78 + j * 18, y + 8 + j * 4);
            }
        }

        container.add(grid);
    }

    private drawMapLandmarks(container: Phaser.GameObjects.Container, stage: IStageConfig): void {
        const landmarks = this.add.graphics();
        const stageSeed = `${stage.id}-${stage.index}`;

        for (let i = 0; i < 6; i++) {
            const centerX = this.seededRange(`${stageSeed}-land-x`, i, 210, MAP_WIDTH - 210);
            const centerY = this.seededRange(`${stageSeed}-land-y`, i, 180, MAP_HEIGHT - 160);
            const radiusX = this.seededRange(`${stageSeed}-land-rx`, i, 190, 390);
            const radiusY = this.seededRange(`${stageSeed}-land-ry`, i, 92, 210);
            const points: Phaser.Math.Vector2[] = [];
            const pointCount = 22;

            for (let j = 0; j < pointCount; j++) {
                const angle = (Math.PI * 2 * j) / pointCount;
                const wobble = this.seededRange(`${stageSeed}-land-wobble-${i}`, j, 0.66, 1.28);
                points.push(new Phaser.Math.Vector2(
                    centerX + Math.cos(angle) * radiusX * wobble,
                    centerY + Math.sin(angle) * radiusY * wobble
                ));
            }

            landmarks.fillStyle(i % 2 === 0 ? 0x6f8a66 : 0x9e814e, i % 2 === 0 ? 0.18 : 0.16);
            landmarks.beginPath();
            landmarks.moveTo(points[0].x, points[0].y);
            for (let j = 1; j < points.length; j++) {
                const previous = points[j - 1];
                const current = points[j];
                landmarks.lineTo((previous.x + current.x) / 2, (previous.y + current.y) / 2);
                landmarks.lineTo(current.x, current.y);
            }
            landmarks.closePath();
            landmarks.fillPath();
            landmarks.lineStyle(4, 0x3f2b1a, 0.24);
            landmarks.strokePath();

            landmarks.lineStyle(2, 0x3f2b1a, 0.16);
            for (let j = 0; j < points.length; j += 2) {
                const point = points[j];
                const next = points[(j + 1) % points.length];
                const midX = (point.x + next.x) / 2;
                const midY = (point.y + next.y) / 2;
                landmarks.lineBetween(midX, midY, midX + (midX - centerX) * 0.08, midY + (midY - centerY) * 0.08);
            }
        }

        this.drawFantasyRivers(landmarks, stageSeed);
        this.drawTerrainSymbols(landmarks, stageSeed);

        landmarks.lineStyle(2, 0x7d2e24, 0.28);
        stage.nodes.slice(0, 9).forEach((node, index) => {
            const pos = this.normalizeToPixels(node);
            const offset = index % 2 === 0 ? -1 : 1;
            landmarks.lineBetween(pos.x - 34, pos.y + 94, pos.x + 34, pos.y + 94 + offset * 8);
            landmarks.lineBetween(pos.x - 22, pos.y + 108, pos.x + 22, pos.y + 108 + offset * 7);
        });

        container.add(landmarks);
        this.drawMapRegionNames(container, stageSeed);
    }

    private drawFantasyRivers(graphics: Phaser.GameObjects.Graphics, seed: string): void {
        graphics.lineStyle(4, 0x2a6870, 0.22);
        for (let i = 0; i < 5; i++) {
            const startX = this.seededRange(`${seed}-river-x`, i, 180, MAP_WIDTH - 180);
            const startY = this.seededRange(`${seed}-river-y`, i, 135, 360);
            const length = this.seededRange(`${seed}-river-l`, i, 320, 620);
            const bend = this.seededRange(`${seed}-river-b`, i, -170, 170);
            const curve = new Phaser.Curves.CubicBezier(
                new Phaser.Math.Vector2(startX, startY),
                new Phaser.Math.Vector2(startX - 110, startY + length * 0.32),
                new Phaser.Math.Vector2(startX + bend, startY + length * 0.62),
                new Phaser.Math.Vector2(startX + bend * 0.55, startY + length)
            );
            const points = curve.getSpacedPoints(28);
            for (let j = 1; j < points.length; j++) {
                graphics.lineBetween(points[j - 1].x, points[j - 1].y, points[j].x, points[j].y);
            }
            graphics.lineStyle(1, 0xf1e0af, 0.18);
            for (let j = 1; j < points.length; j += 4) {
                graphics.lineBetween(points[j - 1].x + 4, points[j - 1].y, points[j].x + 4, points[j].y);
            }
            graphics.lineStyle(4, 0x2a6870, 0.22);
        }
    }

    private drawTerrainSymbols(graphics: Phaser.GameObjects.Graphics, seed: string): void {
        graphics.lineStyle(3, 0x3b2817, 0.42);
        graphics.fillStyle(0x6d4f2b, 0.18);
        for (let i = 0; i < 22; i++) {
            const x = this.seededRange(`${seed}-mountain-x`, i, 160, MAP_WIDTH - 160);
            const y = this.seededRange(`${seed}-mountain-y`, i, 170, MAP_HEIGHT - 155);
            const size = this.seededRange(`${seed}-mountain-s`, i, 22, 38);
            graphics.fillTriangle(x, y - size, x - size * 0.8, y + size * 0.65, x + size * 0.85, y + size * 0.65);
            graphics.strokeTriangle(x, y - size, x - size * 0.8, y + size * 0.65, x + size * 0.85, y + size * 0.65);
            graphics.lineBetween(x - size * 0.1, y - size * 0.54, x + size * 0.22, y + size * 0.2);
        }

        graphics.lineStyle(2, 0x234026, 0.38);
        graphics.fillStyle(0x476b38, 0.22);
        for (let i = 0; i < 34; i++) {
            const x = this.seededRange(`${seed}-wood-x`, i, 125, MAP_WIDTH - 125);
            const y = this.seededRange(`${seed}-wood-y`, i, 150, MAP_HEIGHT - 135);
            const size = this.seededRange(`${seed}-wood-s`, i, 12, 24);
            graphics.fillTriangle(x, y - size, x - size, y + size * 0.6, x + size, y + size * 0.6);
            graphics.strokeTriangle(x, y - size, x - size, y + size * 0.6, x + size, y + size * 0.6);
            graphics.lineBetween(x, y + size * 0.55, x, y + size * 1.1);
        }

        graphics.lineStyle(3, 0x4a2b18, 0.42);
        graphics.fillStyle(0x8a5d2d, 0.22);
        for (let i = 0; i < 11; i++) {
            const x = this.seededRange(`${seed}-ruin-x`, i, 170, MAP_WIDTH - 170);
            const y = this.seededRange(`${seed}-ruin-y`, i, 190, MAP_HEIGHT - 160);
            graphics.fillRect(x - 16, y - 26, 32, 36);
            graphics.strokeRect(x - 16, y - 26, 32, 36);
            graphics.lineBetween(x - 24, y + 10, x + 24, y + 10);
            graphics.lineBetween(x - 9, y - 26, x - 9, y + 10);
            graphics.lineBetween(x + 9, y - 26, x + 9, y + 10);
        }
    }

    private drawMapRegionNames(container: Phaser.GameObjects.Container, seed: string): void {
        const labels = [
            { text: 'Ebon Reach', x: 330, y: 205, angle: -4 },
            { text: 'High Marches', x: 780, y: 850, angle: 3 },
            { text: 'Glasswater Expanse', x: 1355, y: 325, angle: -7 },
            { text: 'Old Crown Road', x: 1820, y: 885, angle: 5 }
        ];

        labels.forEach((label, index) => {
            const x = label.x + this.seededRange(`${seed}-label-x`, index, -48, 48);
            const y = label.y + this.seededRange(`${seed}-label-y`, index, -30, 30);
            const text = this.add.text(x, y, label.text.toUpperCase(), {
                fontFamily: 'Georgia, serif',
                fontSize: '24px',
                color: '#5c3c1f',
                fontStyle: 'bold'
            }).setOrigin(0.5).setAlpha(0.32).setAngle(label.angle);
            container.add(text);
        });
    }

    private drawCompassRose(container: Phaser.GameObjects.Container, x: number, y: number): void {
        const compass = this.add.graphics();
        compass.fillStyle(0xe7c77a, 0.12);
        compass.fillCircle(x, y, 92);
        compass.lineStyle(3, 0x3d2a1c, 0.48);
        compass.strokeCircle(x, y, 82);
        compass.lineStyle(1, 0x3d2a1c, 0.34);
        compass.strokeCircle(x, y, 54);

        const points = 16;
        for (let i = 0; i < points; i++) {
            const angle = (Math.PI * 2 * i) / points - Math.PI / 2;
            const longPoint = i % 2 === 0;
            const outer = longPoint ? 78 : 46;
            const inner = longPoint ? 12 : 20;
            compass.lineStyle(longPoint ? 3 : 1, longPoint ? 0x7d2e24 : 0x3d2a1c, longPoint ? 0.44 : 0.28);
            compass.lineBetween(
                x + Math.cos(angle) * inner,
                y + Math.sin(angle) * inner,
                x + Math.cos(angle) * outer,
                y + Math.sin(angle) * outer
            );
        }

        compass.fillStyle(0x3d2a1c, 0.28);
        compass.fillTriangle(x, y - 82, x - 13, y - 35, x + 13, y - 35);
        container.add(compass);

        const label = this.add.text(x, y - 108, 'N', {
            fontFamily: 'Georgia, serif',
            fontSize: '26px',
            color: '#3d2a1c',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(label);
    }

    private drawMapBorder(container: Phaser.GameObjects.Container): void {
        const border = this.add.graphics();
        border.lineStyle(18, 0x2b1a0d, 0.34);
        border.strokeRect(30, 26, MAP_WIDTH - 60, MAP_HEIGHT - 52);
        border.lineStyle(7, 0x7c592c, 0.44);
        border.strokeRect(52, 50, MAP_WIDTH - 104, MAP_HEIGHT - 100);
        border.lineStyle(2, 0xe7c77a, 0.38);
        border.strokeRect(76, 74, MAP_WIDTH - 152, MAP_HEIGHT - 148);
        border.lineStyle(1, 0x2b1a0d, 0.34);
        border.strokeRect(92, 90, MAP_WIDTH - 184, MAP_HEIGHT - 180);

        border.lineStyle(3, 0x3d2a1c, 0.26);
        for (let i = 0; i < 22; i++) {
            const x = this.seededRange('edge-tear-x', i, 40, MAP_WIDTH - 40);
            const topY = this.seededRange('edge-tear-top', i, 24, 58);
            const bottomY = MAP_HEIGHT - this.seededRange('edge-tear-bottom', i, 24, 62);
            border.lineBetween(x - 18, topY, x + 18, topY + this.seededRange('edge-tear-top-slant', i, -9, 9));
            border.lineBetween(x - 18, bottomY, x + 18, bottomY + this.seededRange('edge-tear-bottom-slant', i, -9, 9));
        }
        container.add(border);
    }

    private maybeShowStorySlides(): void {
        if (this.storySlidesActive) return;
        const state = this.runManager.getRunState();
        if (!state) return;

        const stageIndex = state.currentStageIndex;
        const slides: string[] = [];
        let shouldMarkIntro = false;
        let shouldMarkOutro = false;
        let shouldMarkFinal = false;
        let outroStageIndex: number | undefined;

        const pendingOutro = this.runManager.getPendingStageOutroStageIndex();
        if (pendingOutro !== undefined) {
            if (!this.runManager.hasSeenStageOutro(pendingOutro)) {
                outroStageIndex = pendingOutro;
                const outroSlides = getStageOutroSlides(pendingOutro).filter(key => this.textures.exists(key));
                if (outroSlides.length > 0) {
                    slides.push(...outroSlides);
                }
                shouldMarkOutro = true;
            } else {
                this.runManager.clearPendingStageOutro();
            }
        }

        const pendingFinal = this.runManager.isFinalSlidesPending();
        if (pendingFinal) {
            if (!this.runManager.hasSeenFinalSlides()) {
                const finalSlides = getFinalSlides().filter(key => this.textures.exists(key));
                if (finalSlides.length > 0) {
                    slides.push(...finalSlides);
                }
                shouldMarkFinal = true;
            } else {
                this.runManager.clearFinalSlidesPending();
            }
        }

        if (!pendingFinal && !this.runManager.hasSeenStageIntro(stageIndex)) {
            const introSlides = getStageIntroSlides(stageIndex).filter(key => this.textures.exists(key));
            if (introSlides.length > 0) {
                slides.push(...introSlides);
            }
            shouldMarkIntro = true;
        }

        if (!shouldMarkIntro && !shouldMarkOutro && !shouldMarkFinal) {
            return;
        }

        const finalize = () => {
            if (shouldMarkOutro && outroStageIndex !== undefined) {
                this.runManager.markStageOutroSeen(outroStageIndex);
                this.runManager.clearPendingStageOutro();
            }
            if (shouldMarkFinal) {
                this.runManager.markFinalSlidesSeen();
                this.runManager.clearFinalSlidesPending();
            }
            if (shouldMarkIntro) {
                this.runManager.markStageIntroSeen(stageIndex);
            }
            this.storySlidesActive = false;
        };

        if (slides.length === 0) {
            finalize();
            return;
        }

        this.storySlidesActive = true;
        if (this.scene.isActive('StorySlidesScene') || this.scene.isSleeping('StorySlidesScene')) {
            this.scene.stop('StorySlidesScene');
        }
        this.scene.launch('StorySlidesScene', {
            slideKeys: slides,
            returnSceneKey: 'StageMapScene',
            onComplete: finalize
        });
        this.scene.bringToTop('StorySlidesScene');
        this.scene.pause();
    }


    private drawPaths(stage: IStageConfig): void {
        this.pathGraphics.clear();
        const currentNode = this.runManager.getCurrentNode();
        const currentNodeId = currentNode?.id;
        stage.nodes.forEach(snapshotNode => {
            const liveSource = this.runManager.getNodeSnapshot(snapshotNode.id) ?? snapshotNode;
            liveSource.nextNodeIds.forEach(nextId => {
                const targetSnapshot = stage.nodes.find(n => n.id === nextId);
                if (!targetSnapshot) return;
                const liveTarget = this.runManager.getNodeSnapshot(nextId) ?? targetSnapshot;

                // Default: dimmed paths
                let style: PathRenderStyle = {
                    color: 0x5b432c,
                    alpha: 0.48,
                    thickness: 3,
                    dashLength: 24,
                    gapLength: 18
                };

                // Highlight only the paths leading out of the current fortress node.
                // Use completion to avoid highlighting already-cleared nodes.
                const isFromCurrent = currentNodeId && liveSource.id === currentNodeId;
                const isNextReachable = isFromCurrent && !liveTarget.isCompleted;
                if (isNextReachable) {
                    style = {
                        color: 0x31d15b,
                        alpha: 0.95,
                        thickness: 6,
                        dashLength: 34,
                        gapLength: 14
                    };
                }

                const start = this.normalizeToPixels(liveSource);
                const end = this.normalizeToPixels(liveTarget);
                this.drawDashedCurve(start, end, `${liveSource.id}->${liveTarget.id}`, style);
            });
        });
    }

    private drawDashedCurve(
        start: { x: number; y: number },
        end: { x: number; y: number },
        edgeKey: string,
        style: PathRenderStyle
    ): void {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 1) return;

        const hash = this.hashString(edgeKey);
        const firstNoise = ((hash & 0xffff) / 0xffff) * 2 - 1;
        const secondNoise = (((hash >>> 16) & 0xffff) / 0xffff) * 2 - 1;
        const directionX = dx / distance;
        const directionY = dy / distance;
        const normalX = -directionY;
        const normalY = directionX;
        const curveSide = firstNoise >= 0 ? 1 : -1;
        const curveAmount = Phaser.Math.Clamp(distance * (0.16 + Math.abs(firstNoise) * 0.12), 48, 170) * curveSide;
        const alongDrift = Phaser.Math.Clamp(distance * 0.08, 20, 90) * secondNoise;

        const curve = new Phaser.Curves.CubicBezier(
            new Phaser.Math.Vector2(start.x, start.y),
            new Phaser.Math.Vector2(
                start.x + dx * 0.32 + normalX * curveAmount + directionX * alongDrift,
                start.y + dy * 0.32 + normalY * curveAmount + directionY * alongDrift
            ),
            new Phaser.Math.Vector2(
                start.x + dx * 0.68 + normalX * curveAmount * 0.72 - directionX * alongDrift,
                start.y + dy * 0.68 + normalY * curveAmount * 0.72 - directionY * alongDrift
            ),
            new Phaser.Math.Vector2(end.x, end.y)
        );

        const points = curve.getSpacedPoints(Math.max(16, Math.ceil(distance / 18)));
        this.pathGraphics.lineStyle(style.thickness, style.color, style.alpha);

        let remainingDash = style.dashLength;
        let drawing = true;

        for (let i = 1; i < points.length; i++) {
            const segmentStart = points[i - 1];
            const segmentEnd = points[i];
            const segmentLength = Phaser.Math.Distance.Between(segmentStart.x, segmentStart.y, segmentEnd.x, segmentEnd.y);
            if (segmentLength <= 0) continue;

            let consumed = 0;
            while (consumed < segmentLength) {
                const step = Math.min(remainingDash, segmentLength - consumed);
                const fromT = consumed / segmentLength;
                const toT = (consumed + step) / segmentLength;
                const fromX = Phaser.Math.Linear(segmentStart.x, segmentEnd.x, fromT);
                const fromY = Phaser.Math.Linear(segmentStart.y, segmentEnd.y, fromT);
                const toX = Phaser.Math.Linear(segmentStart.x, segmentEnd.x, toT);
                const toY = Phaser.Math.Linear(segmentStart.y, segmentEnd.y, toT);

                if (drawing) {
                    this.pathGraphics.lineBetween(fromX, fromY, toX, toY);
                }

                consumed += step;
                remainingDash -= step;
                if (remainingDash <= 0) {
                    drawing = !drawing;
                    remainingDash = drawing ? style.dashLength : style.gapLength;
                }
            }
        }
    }

    private hashString(value: string): number {
        let hash = 2166136261;
        for (let i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    private seededRange(seed: string, index: number, min: number, max: number): number {
        const hash = this.hashString(`${seed}:${index}`);
        const ratio = (hash % 10000) / 10000;
        return min + (max - min) * ratio;
    }

    private createNodeContainer(node: IMapNode): void {
        const position = this.normalizeToPixels(node);
        const container = this.add.container(position.x, position.y);
        container.setDepth(5);

        const iconBase = node.iconKey || 'node_battle';
        const icon = this.add.image(0, 0, `${iconBase}_off`);
        icon.setOrigin(0.5);
        icon.setDisplaySize(96, 96);
        container.add(icon);

        const label = this.add.text(0, 58, node.type.toUpperCase(), {
            fontSize: '16px',
            color: '#352315',
            fontFamily: 'Georgia, serif',
            fontStyle: 'bold',
            stroke: '#e7c77a',
            strokeThickness: 3
        }).setOrigin(0.5);
        container.add(label);

        icon.setInteractive({ useHandCursor: true });
        icon.on('pointerdown', () => this.handleNodeClick(node.id));
        icon.on('pointerover', () => container.setScale(1.1));
        icon.on('pointerout', () => container.setScale(1));

        this.nodeContainers.set(node.id, container);
    }

    private handleNodeClick(nodeId: string): void {
        if (this.nodeTransitionInProgress) {
            return;
        }

        const node = this.runManager.getNodeSnapshot(nodeId);
        if (!node) return;
        if (!this.runManager.canAccessNode(nodeId)) {
            return;
        }

        this.pendingEncounterNodeId = nodeId;
        this.nodeTransitionInProgress = true;

        const moved = this.runManager.moveToNode(nodeId);
        if (!moved) {
            this.pendingEncounterNodeId = undefined;
            this.nodeTransitionInProgress = false;
            return;
        }
        
        // Update node visuals to reflect that other paths are now locked
        this.updateAllNodeStates();
        const stage = this.runManager.getCurrentStage();
        if (stage) {
            this.drawPaths(stage);
        }
    }

    private updateAllNodeStates(): void {
        this.nodeContainers.forEach((container, nodeId) => {
            const node = this.runManager.getNodeSnapshot(nodeId);
            if (!node) return;
            const icon = container.list[0] as Phaser.GameObjects.Image;
            const iconBase = node.iconKey || 'node_battle';
            const onKey = `${iconBase}_on`;
            const offKey = `${iconBase}_off`;

            if (node.isCompleted) {
                icon.setTexture(onKey);
                container.setAlpha(1);
                container.setScale(1);
            } else if (node.isAccessible) {
                icon.setTexture(onKey);
                container.setAlpha(1);
                container.setScale(1.08);
            } else {
                icon.setTexture(offKey);
                container.setAlpha(0.55);
                container.setScale(1);
            }
        });

        const stage = this.runManager.getStageSnapshot(this.currentStageIndex);
        if (stage) {
            this.drawPaths(stage);
        }
    }

    private moveFortressToken(node?: IMapNode, onMoveComplete?: () => void): void {
        if (!node) return;
        const position = this.normalizeToPixels(node);
        // Lift the fortress token above the node so it doesn't block the node visuals.
        const tokenY = position.y - 92;
        if (!this.isFortressTokenAlive()) {
            this.fortressToken = this.createFortressToken(position.x, tokenY);
        }
        this.fortressToken?.setVisible(true);
        this.fortressToken?.setAlpha(1);
        this.fortressToken?.setDepth(4);
        this.fortressMoveTween?.stop();

        const currentX = this.fortressToken?.x ?? position.x;
        const currentY = this.fortressToken?.y ?? tokenY;
        const distance = Phaser.Math.Distance.Between(currentX, currentY, position.x, tokenY);
        const duration = distance < 2 ? 0 : 450;

        if (duration === 0) {
            this.fortressToken?.setPosition(position.x, tokenY);
            this.cameras.main.pan(position.x, position.y, 1, 'Sine.easeInOut');
            onMoveComplete?.();
            return;
        }

        this.fortressMoveTween = this.tweens.add({
            targets: this.fortressToken,
            x: position.x,
            y: tokenY,
            duration: 450,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.fortressMoveTween = undefined;
                onMoveComplete?.();
            }
        });
        this.cameras.main.pan(position.x, position.y, duration, 'Sine.easeInOut');
    }

    private startPendingNodeEncounter(node: IMapNode): void {
        if (this.pendingEncounterNodeId !== node.id) {
            return;
        }

        this.pendingEncounterNodeId = undefined;
        this.nodeTransitionInProgress = false;

        const liveNode = this.runManager.getNodeSnapshot(node.id);
        if (!liveNode) {
            return;
        }

        this.encounterSystem.resolveNode(liveNode);
    }

    private isFortressTokenAlive(): boolean {
        return !!this.fortressToken && this.fortressToken.active && this.fortressToken.scene === this;
    }

    private createFortressToken(x: number, y: number): Phaser.GameObjects.Container {
        const token = this.add.container(x, y);
        token.setDepth(4);

        const shadow = this.add.ellipse(0, 18, 86, 24, 0x000000, 0.35);
        token.add(shadow);

        const glow = this.add.graphics();
        glow.fillStyle(0x31d15b, 0.18);
        glow.fillCircle(0, 0, 54);
        glow.lineStyle(4, 0x31d15b, 0.95);
        glow.strokeCircle(0, 0, 43);
        glow.lineStyle(2, 0xffffff, 0.9);
        glow.strokeCircle(0, 0, 36);
        token.add(glow);

        const imageKey = this.getCurrentFortressImageKey();
        if (imageKey && this.textures.exists(imageKey)) {
            const image = this.add.image(0, 0, imageKey);
            image.setDisplaySize(68, 68);
            token.add(image);
        } else {
            const fallback = this.add.graphics();
            fallback.fillStyle(0x1d9bf0, 1);
            fallback.fillCircle(0, 0, 25);
            fallback.lineStyle(4, 0xf0f4ff, 1);
            fallback.strokeCircle(0, 0, 25);
            fallback.fillStyle(0xf0f4ff, 1);
            fallback.fillTriangle(0, -18, 18, 14, -18, 14);
            token.add(fallback);
        }

        this.tweens.add({
            targets: token,
            scale: { from: 0.96, to: 1.05 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return token;
    }

    private getCurrentFortressImageKey(): string | undefined {
        const runState = this.runManager.getRunState();
        const factionId = runState?.factionId ?? 'jade_dynasty';
        const faction = this.factionRegistry.getFaction(factionId);
        const fortressId = faction?.fortressId ?? `fortress_${factionId}_01`;
        const gridConfig = this.factionRegistry.getFortressGridConfig(fortressId);
        return gridConfig?.imageKey ?? fortressId;
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
        this.updateDeckAttentionDot();
        this.maybeShowStorySlides();
    };

    private onNodeSelected = (node?: IMapNode) => {
        if (node) {
            const shouldStartEncounter = this.pendingEncounterNodeId === node.id;
            this.moveFortressToken(
                node,
                shouldStartEncounter ? () => this.startPendingNodeEncounter(node) : undefined
            );
        }
        this.updateAllNodeStates();
    };

    private onNodeCompleted = () => {
        this.updateAllNodeStates();
    };

    private onNodeResolved = () => {
        const stageIndex = this.runManager.getRunState()?.currentStageIndex ?? 0;
        if (stageIndex !== this.currentStageIndex) {
            this.renderCurrentStage();
        } else {
            this.moveFortressToken(this.runManager.getCurrentNode());
            this.updateAllNodeStates();
        }
        this.updateDeckAttentionDot();
        this.maybeShowStorySlides();
    };

    private onStageCompleted = (stage?: IStageConfig) => {
        this.showBanner(`${stage?.name ?? 'Stage'} Cleared!`);
    };

    private onRunCompleted = () => {
        this.showBanner('Run Complete! Victory!');
    };

    private onBattleFailed = (_node?: IMapNode, livesLeft?: number) => {
        this.refreshHud();
        if (livesLeft !== undefined && livesLeft <= 0) {
            return;
        }
        const message = livesLeft !== undefined ? `Life lost! Lives left: ${livesLeft}` : 'Life lost!';
        this.showBanner(message);
    };

    private onRunFailed = () => {
        this.showGameOverOverlay();
    };

    private showGameOverOverlay(): void {
        if (this.gameOverOverlay) {
            return;
        }

        const { width, height } = this.cameras.main;
        this.stopStageBgm();

        const overlay = this.add.container(width / 2, height / 2);
        overlay.setScrollFactor(0);
        overlay.setDepth(10000);
        overlay.setAlpha(0);

        const dim = this.add.rectangle(0, 0, width, height, 0x050307, 0.86);
        dim.setInteractive({ useHandCursor: true });
        overlay.add(dim);

        const panel = this.add.graphics();
        panel.fillStyle(0x1a0f0a, 0.96);
        panel.fillRoundedRect(-360, -165, 720, 330, 8);
        panel.lineStyle(4, 0x8b1e1e, 0.95);
        panel.strokeRoundedRect(-360, -165, 720, 330, 8);
        panel.lineStyle(1, 0xf0dba5, 0.55);
        panel.strokeRoundedRect(-330, -135, 660, 270, 6);
        overlay.add(panel);

        const title = this.add.text(0, -70, 'GAME OVER', {
            fontFamily: 'Georgia, serif',
            fontSize: '76px',
            color: '#d02222',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);
        overlay.add(title);

        const subtitle = this.add.text(0, 15, 'Your command has fallen.', {
            fontFamily: 'Georgia, serif',
            fontSize: '28px',
            color: '#f0dba5',
            fontStyle: 'italic'
        }).setOrigin(0.5);
        overlay.add(subtitle);

        const prompt = this.add.text(0, 93, 'Click to return to menu', {
            fontFamily: 'Georgia, serif',
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        overlay.add(prompt);

        this.tweens.add({
            targets: prompt,
            alpha: { from: 0.35, to: 1 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        let returningToMenu = false;
        const returnToMenu = () => {
            if (returningToMenu) {
                return;
            }
            returningToMenu = true;
            dim.disableInteractive();
            panel.disableInteractive();
            title.disableInteractive();
            subtitle.disableInteractive();
            prompt.disableInteractive();
            this.cameras.main.fadeOut(450, 0, 0, 0);
            this.time.delayedCall(460, () => {
                this.scene.start('TitleMenuScene');
            });
        };

        dim.on('pointerup', returnToMenu);
        panel.setInteractive(
            new Phaser.Geom.Rectangle(-360, -165, 720, 330),
            Phaser.Geom.Rectangle.Contains
        );
        panel.on('pointerup', returnToMenu);
        title.setInteractive({ useHandCursor: true }).on('pointerup', returnToMenu);
        subtitle.setInteractive({ useHandCursor: true }).on('pointerup', returnToMenu);
        prompt.setInteractive({ useHandCursor: true }).on('pointerup', returnToMenu);

        this.gameOverOverlay = overlay;
        this.tweens.add({
            targets: overlay,
            alpha: 1,
            duration: 260,
            ease: 'Sine.easeOut'
        });
    }

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
