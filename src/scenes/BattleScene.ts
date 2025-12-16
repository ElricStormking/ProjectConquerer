import Phaser from 'phaser';
import { IsometricRenderer } from '../systems/IsometricRenderer';
import { PhysicsManager } from '../systems/PhysicsManager';
import { UnitManager } from '../systems/UnitManager';
import { CombatSystem, StatusEffect } from '../systems/CombatSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { DeckSystem } from '../systems/DeckSystem';
import { CardSystem } from '../systems/CardSystem';
import { GameStateManager } from '../systems/GameStateManager';
import { FortressSystem } from '../systems/FortressSystem';
import { WaveManager } from '../systems/WaveManager';
import { CommanderSystem } from '../systems/CommanderSystem';
import { COG_DOMINION_STARTER } from '../data/ironwars/cog_dominion_starter';
import { BattlePhase, ICard, IDeckState, IHandUpdatePayload, IGameState, IFortressGridConfig, ICommanderFullConfig } from '../types/ironwars';

type CardPlayPayload = { card: ICard; screenX: number; screenY: number };
type CommanderCastPayload = { screenX: number; screenY: number };
import { UnitType } from '../data/UnitTypes';

const STARTING_HAND = 5;

import { DataManager } from '../systems/DataManager';
import { RunProgressionManager } from '../systems/RunProgressionManager';
import { FactionRegistry } from '../systems/FactionRegistry';
import { CommanderManager } from '../systems/CommanderManager';
import KeyCodes = Phaser.Input.Keyboard.KeyCodes;

export class BattleScene extends Phaser.Scene {
    private isometricRenderer!: IsometricRenderer;
    private physicsManager!: PhysicsManager;
    private unitManager!: UnitManager;
    private combatSystem!: CombatSystem;
    private projectileSystem!: ProjectileSystem;
    private deckSystem!: DeckSystem;
    private cardSystem!: CardSystem;
    private fortressSystem!: FortressSystem;
    private waveManager!: WaveManager;
    private commanderSystem!: CommanderSystem;
    private readonly gameState = GameStateManager.getInstance();
    // COG_DOMINION_STARTER is now only used for Fortress/Commander layout fallback, 
    // data should come from DataManager
    private readonly starterData = COG_DOMINION_STARTER;
    private commanderRoster: ICommanderFullConfig[] = [];
    private activeCommanderIndex = 0;
    private commanderHotkeys: Phaser.Input.Keyboard.Key[] = [];

    private battlefield = { centerX: 960, centerY: 540, width: 1720, height: 880 };
    private currentDraggedCard?: ICard;
    private fortressCoreWorld = { x: 0, y: 0 };
    private fortressCoreGraphic?: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
    private startButton!: Phaser.GameObjects.Container;
    private startButtonLabel!: Phaser.GameObjects.Text;
    private startButtonBg?: Phaser.GameObjects.Rectangle;
    private overlayContainer?: Phaser.GameObjects.Container;
    private battleState: 'preparation' | 'running' | 'victory' | 'defeat' = 'preparation';
    private hasStartedFirstWave = false;
    private waveIntermissionCameraLock = false;
    private bgm?: Phaser.Sound.BaseSound;
    private bgmKey: string = '';
    private medicLastHeal: Map<string, number> = new Map();
    private frostScientistBuffTimers: Map<string, number> = new Map();
    private jadeCrossbowHitCounter: Map<string, number> = new Map();
    private jadeSpiritLanternTick: Map<string, number> = new Map();
    private jadeOniTauntTick: Map<string, number> = new Map();
    
    // Scene data passed from NodeEncounterSystem
    private encounterId: string = 'default';

    constructor() {
        super({ key: 'BattleScene' });
    }

    /**
     * Simple modal shown between waves. Blocks input until player clicks to continue.
     */
    private showWaveClearedOverlay(onContinue: () => void): void {
        const { width, height } = this.cameras.main;
        const container = this.add.container(width / 2, height / 2);
        container.setDepth(12000);

        // Hide and disable the start button while the intermission UI is active.
        this.startButton?.setVisible(false);
        this.startButtonBg?.disableInteractive();
        this.waveIntermissionCameraLock = true;

        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.65).setOrigin(0.5);
        bg.setInteractive();

        const panel = this.add.rectangle(0, 0, 520, 220, 0x1a1d2e, 0.92).setOrigin(0.5);
        panel.setStrokeStyle(3, 0xd4a017, 0.9);

        const title = this.add.text(0, -40, 'Wave Cleared!', {
            fontFamily: 'Georgia, serif',
            fontSize: '40px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const subtitle = this.add.text(0, 20, 'Click to continue', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            color: '#c0c0c0'
        }).setOrigin(0.5);

        container.add([bg, panel, title, subtitle]);

        const proceed = () => {
            container.destroy();
            onContinue();
        };

        bg.on('pointerup', proceed);
        panel.on('pointerup', proceed);
        title.on('pointerup', proceed);
        subtitle.on('pointerup', proceed);
    }

    public init(data: { nodeId?: string; encounterId?: string; nodeType?: string }): void {
        this.encounterId = data.encounterId ?? 'default';
        
        // Reset battle state for new encounter
        this.battleState = 'preparation';
        this.hasStartedFirstWave = false;
    }

    public create() {
        this.launchUIScene();
        this.setupCamera();
        this.setupCoreSystems();
        this.createEnvironment();
        this.initializeIronwarsPrototype();
        this.setupPointerBridge();
        this.startBackgroundMusic();
        this.registerFrostAbilityEvents();

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.stopBackgroundMusic();
            // Ensure no battle music leaks into other scenes.
            this.sound.stopAll();
        });
    }

    private startBackgroundMusic() {
        const runManager = RunProgressionManager.getInstance();
        const stageIndex = runManager.getRunState()?.currentStageIndex ?? 0;
        const key = stageIndex === 0 ? 'bgm_battle_jade' : 'bgm_battle_frost';
        this.bgmKey = key;

        this.sound.stopAll();

        // Avoid stacking multiple instances if scene is restarted.
        const existing = this.sound.get(key);
        if (existing && existing.isPlaying) {
            this.bgm = existing;
            return;
        }
        this.bgm = this.sound.add(key, { loop: true, volume: 0.45 });
        this.bgm.play();
    }

    private stopBackgroundMusic() {
        if (this.bgm) {
            this.bgm.stop();
            this.bgm.destroy();
            this.bgm = undefined;
        }
        if (this.bgmKey) {
            this.sound.removeByKey(this.bgmKey);
        }
    }

    public update(_time: number, delta: number) {
        const deltaSeconds = delta / 1000;
        this.physicsManager.update(deltaSeconds);
        this.unitManager.update(deltaSeconds);
        this.combatSystem.update(deltaSeconds);
        this.projectileSystem.update(deltaSeconds);
        this.isometricRenderer.update();

        if (this.battleState === 'running') {
            this.updateUnitAI();
            this.checkCombat();
            this.processPassiveSkills();
            this.updateJadeAuras();
            this.updateFrostAuras();
            this.updateMedicHealing(this.time.now);
            this.cardSystem.update(this.time.now, deltaSeconds);
        }
    }

    private launchUIScene() {
        if (!this.scene.isActive('UIScene')) {
            this.scene.launch('UIScene');
        }
    }

    private setupCamera() {
        const camera = this.cameras.main;
        // Allow camera to move freely enough that we can center on the
        // fortress grid and then zoom back out to full battlefield.
        camera.setZoom(1);
        camera.setBounds(0, 0, 1920, 1080);
        camera.centerOn(this.battlefield.centerX, this.battlefield.centerY);
        camera.roundPixels = true;

        this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
            const zoom = camera.zoom;
            camera.zoom = Phaser.Math.Clamp(zoom - deltaY * 0.001, 1, 2.5);
        });
    }

    private setupCoreSystems() {
        this.isometricRenderer = new IsometricRenderer(this);
        this.physicsManager = new PhysicsManager(this);
        this.unitManager = new UnitManager(this, this.physicsManager);
        this.combatSystem = new CombatSystem(this, this.unitManager);
        this.projectileSystem = new ProjectileSystem(this);
        this.physicsManager.setBattlefieldBounds(100, 100, 1720, 880, 5, 5);
    }

    private createEnvironment() {
        // Pick battle background based on current stage (stage 1 uses Jade map)
        const runManager = RunProgressionManager.getInstance();
        const stageIndex = runManager.getRunState()?.currentStageIndex ?? 0;
        let bgKey = 'world_bg';
        if (stageIndex === 0 && this.textures.exists('battle_bg_stage_1')) {
            bgKey = 'battle_bg_stage_1';
        }
        const bg = this.add.image(960, 540, bgKey);
        bg.setDepth(-10000);
        bg.setDisplaySize(1920, 1080);

        // Global isometric grid covering the whole canvas. Use medium-sized
        // diamonds (128x64) so they are easy to hit but not oversized.
        const gridSize = 46;
        const cellWidth = 128;
        const cellHeight = 64;
        const gridGraphics = this.add.graphics();
        gridGraphics.setDepth(-9000);
        gridGraphics.lineStyle(1, 0xffffff, 0.06);

        for (let gx = -gridSize; gx <= gridSize; gx++) {
            for (let gy = -gridSize; gy <= gridSize; gy++) {
                const worldX = (gx - gy) * (cellWidth / 2) + 960;
                const worldY = (gx + gy) * (cellHeight / 2) + 540;

                if (worldX < -cellWidth || worldX > 1920 + cellWidth || worldY < -cellHeight || worldY > 1080 + cellHeight) {
                    continue;
                }

                const halfW = cellWidth / 2;
                const halfH = cellHeight / 2;
                gridGraphics.beginPath();
                gridGraphics.moveTo(worldX, worldY - halfH);
                gridGraphics.lineTo(worldX + halfW, worldY);
                gridGraphics.lineTo(worldX, worldY + halfH);
                gridGraphics.lineTo(worldX - halfW, worldY);
                gridGraphics.closePath();
                gridGraphics.strokePath();
            }
        }

        const boundaryGraphics = this.add.graphics();
        boundaryGraphics.lineStyle(3, 0xffffff, 0.15);
        const left = this.battlefield.centerX - this.battlefield.width / 2;
        const top = this.battlefield.centerY - this.battlefield.height / 2;
        boundaryGraphics.strokeRect(left, top, this.battlefield.width, this.battlefield.height);

        this.createEnvironmentalObjects();
    }

    private initializeIronwarsPrototype() {
        // Use generous starting resources in the prototype so all 5 unit types
        // (soldier, railgunner, tank, medic, cannon) can be summoned for testing.
        this.gameState.initialize(this.starterData, 10, 40);

        // Get fortress config from FactionRegistry (uses DataManager CSV grids if available)
        // Use current run faction fortress if available, fallback to Jade Dynasty
        const factionRegistry = FactionRegistry.getInstance();
        const runState = RunProgressionManager.getInstance().getRunState();
        const factionIdForFortress = runState?.factionId ?? 'jade_dynasty';
        const testFortressId = `fortress_${factionIdForFortress}_01`;
        let fortressConfig = factionRegistry.getFortressConfig(testFortressId);
        
        // Fallback to starterData if no CSV fortress found
        if (!fortressConfig) {
            console.warn(`[BattleScene] Fortress ${testFortressId} not found, using starterData fallback`);
            fortressConfig = this.starterData.fortress;
        } else {
            console.log(`[BattleScene] Using fortress from CSV: ${fortressConfig.name} (${fortressConfig.gridWidth}x${fortressConfig.gridHeight})`);
        }

        // Get cell size from grid config if available
        const gridConfig = factionRegistry.getFortressGridConfig(testFortressId);
        const cellWidth = gridConfig?.cellSizeWidth ?? 64;
        const cellHeight = gridConfig?.cellSizeHeight ?? 32;

        // Position the player's fortress/grid (blue team summon area) in the
        // upper-left region of the canvas.
        this.fortressSystem = new FortressSystem(
            this,
            this.isometricRenderer,
            fortressConfig,
            340, 200,
            cellWidth, cellHeight
        );
        this.fortressSystem.initialize();
        
        // Calculate fortress core world position BEFORE creating the image
        const coreX = Math.floor(fortressConfig.gridWidth / 2);
        const coreY = Math.floor(fortressConfig.gridHeight / 2);
        this.fortressCoreWorld = this.fortressSystem.gridToWorld(coreX, coreY);
        
        // Create fortress image behind the grid (needs fortressCoreWorld to be set)
        this.createFortressImage(gridConfig?.imageKey ?? testFortressId, fortressConfig.gridWidth, gridConfig);
        
        this.createFortressCorePlaceholder();

        this.deckSystem = new DeckSystem(7);
        
        // Prefer the player's run deck from RunProgressionManager.
        const runManager = RunProgressionManager.getInstance();
        const runDeck = runManager.getDeckSnapshot();

        if (runDeck.length > 0) {
            // Use the customized run deck built in DeckBuildingScene.
            this.deckSystem.reset(runDeck);
        } else {
            // Fallback: use all cards from DataManager (prototype behavior).
        const cards = DataManager.getInstance().getAllCards();
        this.deckSystem.reset(cards);
        }
        this.deckSystem.draw(STARTING_HAND);
        
        this.cardSystem = new CardSystem(
            this,
            this.deckSystem,
            this.gameState,
            this.fortressSystem,
            this.unitManager
        );

        // Destroy old WaveManager if it exists to clean up event listeners
        if (this.waveManager) {
            this.waveManager.destroy();
        }

        this.waveManager = new WaveManager(this, this.unitManager, this.gameState);
        
        // Load waves for this specific encounter (battle/elite/boss node)
        const waves = DataManager.getInstance().getWavesForEncounter(this.encounterId);
        console.log(`[BattleScene] Loading waves for encounter: ${this.encounterId}, found ${waves.length} waves`);
        this.waveManager.loadWaves(waves);

        const commanderManager = CommanderManager.getInstance();
        const rosterIds = (runState?.commanderRoster ?? [this.starterData.commander.id]).slice(0, 5);
        const fallbackCommander: ICommanderFullConfig = {
            ...this.starterData.commander,
            isStarter: true,
            cardIds: this.starterData.deck.map(c => c.id)
        };
        this.commanderRoster = rosterIds
            .map(id => commanderManager.getCommander(id))
            .filter((cfg): cfg is ICommanderFullConfig => Boolean(cfg));
        if (this.commanderRoster.length === 0) {
            this.commanderRoster = [fallbackCommander];
        }
        this.activeCommanderIndex = 0;

        this.commanderSystem = new CommanderSystem(this, this.unitManager);
        // Only allow commander skill casting during the BATTLE phase.
        this.commanderSystem.setCanCastPredicate(
            () => this.gameState.getState().phase === 'BATTLE'
        );
        this.commanderSystem.initialize(this.commanderRoster[this.activeCommanderIndex]);
        this.bindCommanderHotkeys();

        this.bindStateEvents();
        this.createPhaseControls();
        this.gameState.setDeckState(this.deckSystem.getState());

        // Start in building phase view, zoomed in on the fortress grid.
        this.updateCameraForPhase('PREPARATION');
    }

    private bindCommanderHotkeys(): void {
        // Clean up old bindings
        this.commanderHotkeys.forEach(key => key.destroy());
        this.commanderHotkeys = [];

        const keyboard = this.input.keyboard;
        if (!keyboard) return;

        const keys = [KeyCodes.ONE, KeyCodes.TWO, KeyCodes.THREE, KeyCodes.FOUR, KeyCodes.FIVE];
        keys.forEach((code, idx) => {
            const key = keyboard.addKey(code);
            key.on('down', () => this.switchCommander(idx));
            this.commanderHotkeys.push(key);
        });
    }

    private switchCommander(index: number): void {
        if (index < 0 || index >= this.commanderRoster.length) return;
        if (this.activeCommanderIndex === index) return;
        this.activeCommanderIndex = index;
        const commander = this.commanderRoster[this.activeCommanderIndex];
        console.log(`[BattleScene] Switched to commander ${commander.name} (${commander.id})`);
        this.commanderSystem.initialize(commander);
    }

    private bindStateEvents() {
        // Clean up previous listeners for local systems
        if (this.deckSystem) {
            this.deckSystem.removeAllListeners();
        }
        if (this.waveManager) {
            this.waveManager.removeAllListeners();
        }
        if (this.commanderSystem) {
            this.commanderSystem.removeAllListeners();
        }
        // Note: GameStateManager is a singleton, so we must be careful not to remove listeners from other scenes (like UIScene).
        // Ideally, we should store the handler reference and use off(), but for now we'll rely on uniqueness or assume restart clears.
        // Actually, `this.gameState` is global. If we attach here, we MUST detach on shutdown.
        // But BattleScene doesn't have a robust shutdown yet.
        // Let's implement a cleanup method for GameState listeners specifically for this scene instance.
        // Since we can't easily identify "our" listeners without storing them, let's just assume
        // we need to be careful. A better approach is to use `this.events.on('shutdown', ...)` to clean up.
        this.events.on('shutdown', () => {
            this.cleanupListeners();
        });

        this.deckSystem.on('deck-state-changed', (state: IDeckState) => {
            this.gameState.setDeckState(state);
        });

        this.deckSystem.on('hand-updated', (payload: IHandUpdatePayload) => {
            this.events.emit('hand-updated', payload);
        });

        this.gameState.on('state-updated', (state: IGameState) => {
            this.events.emit('state-updated', state);
        });

        this.gameState.on('phase-changed', (phase: BattlePhase) => {
            this.events.emit('phase-changed', phase);
            this.updateCameraForPhase(phase);
        });

        this.gameState.on('fortress-damaged', (payload: { hp: number; max: number }) => {
            this.events.emit('fortress-damaged', payload);
        });

        this.gameState.on('fortress-destroyed', () => {
            if (this.battleState !== 'defeat' && this.battleState !== 'victory') {
                this.handleDefeat();
            }
        });

        this.waveManager.on('wave-started', (index: number) => {
            this.events.emit('wave-started', index);
            this.gameState.advanceWave();
            this.gameState.setPhase('BATTLE');
            this.battleState = 'running';
        });

        this.waveManager.on('relic-wave-start', (context: { cardDrawBonus?: number; resourceBonus?: number; fortressHealBonus?: number }) => {
            console.log(`[BattleScene] Received relic-wave-start event, context:`, context);
            if (context.cardDrawBonus && context.cardDrawBonus > 0) {
                console.log(`[BattleScene] Relic bonus: Drawing ${context.cardDrawBonus} extra card(s)`);
                this.deckSystem.draw(context.cardDrawBonus);
            }
            if (context.resourceBonus && context.resourceBonus > 0) {
                console.log(`[BattleScene] Relic bonus: Gaining ${context.resourceBonus} extra resources`);
                this.gameState.gainResource(context.resourceBonus);
            }
            if (context.fortressHealBonus && context.fortressHealBonus > 0) {
                console.log(`[BattleScene] Relic bonus: Healing fortress for ${context.fortressHealBonus}`);
                this.gameState.healFortress(context.fortressHealBonus);
            }
        });

        this.waveManager.on('wave-cleared', () => {
            console.log('[BattleScene] Wave cleared, checking for next wave...');
            if (this.waveManager.hasNextWave()) {
                console.log('[BattleScene] Next wave available, returning to preparation phase and showing card reward');
                // Between waves, return to a full building phase so the
                // player can adjust their fortress and play additional
                // cards before the next fight.
                this.waveIntermissionCameraLock = true; // keep camera at center until reward is done
                this.battleState = 'preparation';
                this.gameState.setPhase('PREPARATION');
                this.resetAlliedUnitsToSpawnPositions();
                
                // Grant resources between waves (scales with wave progression)
                const currentWave = this.gameState.getState().currentWave;
                const baseIncome = 8;
                const bonusIncome = Math.floor(currentWave / 3) * 2; // +2 every 3 waves
                const totalIncome = baseIncome + bonusIncome;
                this.gameState.gainResource(totalIncome);
                console.log(`[BattleScene] Granted ${totalIncome} resources (wave ${currentWave})`);
                
                // Hide start button while the victory UI is up
                this.hideStartButton();
                // Between waves: show a Wave Cleared overlay before offering card reward
                this.showWaveClearedOverlay(() => {
                this.showCardRewardScreen();
                });
            } else {
                console.log('[BattleScene] No more waves, triggering victory');
                this.handleVictory();
            }
        });

        this.commanderSystem.on('skill-cast', (payload: { cooldown: number; lastCast: number }) => {
            this.events.emit('commander-cast', payload);
        });

        this.gameState.on('phase-changed', (phase: BattlePhase) => {
            // Only show/enable the start button in PREPARATION and when not locked by intermission
            if (phase === 'PREPARATION' && !this.waveIntermissionCameraLock) {
                this.showStartButton(this.hasStartedFirstWave ? 'Start Next Wave' : 'Start Battle');
            } else {
                this.hideStartButton();
            }
        });
    }

    private cleanupListeners() {
        // Remove input listeners
        this.input.off('pointermove');
        this.input.off('wheel');

        // Remove local event listeners
        this.events.off('ui:card-drag-start');
        this.events.off('ui:card-drag-end');
        this.events.off('ui:card-drag');
        this.events.off('ui:card-play');
        this.events.off('ui:start-wave');
        this.events.off('ui:commander-cast');
        
        // Note: We don't aggressively clear GameStateManager listeners here because
        // we didn't store the references to remove them specifically. 
        // This is a technical debt item: GameStateManager needs a better subscription model for scenes.
    }

    private createPhaseControls() {
        const container = this.add.container(960, 860);
        const background = this.add.rectangle(0, 0, 260, 66, 0x1d1f2c, 0.85)
            .setStrokeStyle(2, 0xffffff, 0.35)
            .setOrigin(0.5);
        const label = this.add.text(0, 0, 'Start Battle', {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add([background, label]);
        container.setDepth(5000);

        // Interactive on the button background instead of the container
        background.setInteractive(
            new Phaser.Geom.Rectangle(-130, -33, 260, 66),
            Phaser.Geom.Rectangle.Contains
        );
        background.on('pointerover', () => background.setFillStyle(0x262a40, 0.95));
        background.on('pointerout', () => background.setFillStyle(0x1d1f2c, 0.85));
        background.on('pointerdown', () => this.tryStartWave());
        this.startButton = container;
        this.startButtonLabel = label;
        this.startButtonBg = background;
    }

    private showStartButton(text: string) {
        // Only during preparation and not during intermission lock
        if (this.waveIntermissionCameraLock || this.gameState.getState().phase !== 'PREPARATION') {
            this.hideStartButton();
            return;
        }
        this.startButtonLabel.setText(text);
        this.startButton.setVisible(true);
        if (this.gameState.getState().phase === 'PREPARATION') {
            this.startButtonBg?.setInteractive(
                new Phaser.Geom.Rectangle(-130, -33, 260, 66),
                Phaser.Geom.Rectangle.Contains
            );
        } else {
            this.startButtonBg?.disableInteractive();
        }
    }

    private hideStartButton() {
        this.startButton.setVisible(false);
        this.startButtonBg?.disableInteractive();
    }

    private showCardRewardScreen(): void {
        if (!this.scene.isActive('CardRewardScene')) {
            console.log('[BattleScene] Launching CardRewardScene');
            this.scene.launch('CardRewardScene');
        }

        this.scene.bringToTop('CardRewardScene');

        const rewardScene = this.scene.get('CardRewardScene') as any;
        console.log('[BattleScene] Calling CardRewardScene.showCardReward');

        // Build current deck pool from DeckSystem state so reward distribution
        // matches the actual deck composition (drawPile + discard + hand).
        const deckState = this.deckSystem.getState();
        const deckPool: ICard[] = [
            ...deckState.drawPile,
            ...deckState.discardPile,
            ...deckState.hand
        ];

        rewardScene.showCardReward(deckPool, (selectedCard: ICard) => {
            console.log(`[BattleScene] Card selected: ${selectedCard.name}`);

            this.deckSystem.addCard(selectedCard);

            this.scene.stop('CardRewardScene');

            this.showStartButton('Start Next Wave');
            // Release camera lock and return to fortress view
            this.waveIntermissionCameraLock = false;
            this.updateCameraForPhase('PREPARATION');
        });
    }

    private tryStartWave() {
        if (this.waveIntermissionCameraLock) {
            return;
        }
        if (this.battleState === 'running') {
            return;
        }
        // When the player starts the fighting phase, apply all building
        // buffs (Armor Shop, Overclock Stable) to units in their adjacent
        // fortress cells.
        this.cardSystem.applyBuildingBuffsAtBattleStart();
        if (!this.hasStartedFirstWave) {
            this.waveManager.startFirstWave();
            this.hasStartedFirstWave = true;
        } else {
            this.waveManager.startNextWave();
        }
        this.hideStartButton();
    }

    private setupPointerBridge() {
        // Ensure clean slate by removing previous listeners to prevent accumulation
        this.events.off('ui:card-drag-start');
        this.events.off('ui:card-drag-end');
        this.events.off('ui:card-drag');
        this.events.off('ui:card-play');
        this.events.off('ui:start-wave');
        this.events.off('ui:commander-cast');

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer));

        this.events.on('ui:card-drag-start', (card: ICard) => {
            this.currentDraggedCard = card;
            if (this.gameState.getState().phase === 'PREPARATION') {
                this.fortressSystem.showPlacementHints();
            }
        });

        this.events.on('ui:card-drag-end', () => {
            this.currentDraggedCard = undefined;
            this.fortressSystem.clearHover();
            this.fortressSystem.clearPlacementHints();
        });

        this.events.on('ui:card-drag', (payload: { screenX: number; screenY: number }) => {
            this.handleCardDragMove(payload.screenX, payload.screenY);
        });

        this.events.on('ui:card-play', (payload: CardPlayPayload) => {
            this.handleCardPlacement(payload);
        });

        this.events.on('ui:start-wave', () => this.tryStartWave());

        this.events.on('ui:commander-cast', (payload: CommanderCastPayload) => {
            const worldPoint = this.cameras.main.getWorldPoint(payload.screenX, payload.screenY);
            this.commanderSystem.tryCast(worldPoint.x, worldPoint.y);
        });
    }

    private handlePointerMove(pointer: Phaser.Input.Pointer) {
        this.handleCardDragMove(pointer.x, pointer.y);
    }

    private handleCardDragMove(screenX: number, screenY: number) {
        if (!this.currentDraggedCard) {
            this.fortressSystem.clearHover();
            return;
        }
        const worldPoint = this.cameras.main.getWorldPoint(screenX, screenY);
        const grid = this.fortressSystem.worldToGrid(worldPoint.x, worldPoint.y);
        const isValid = this.gameState.getState().phase === 'PREPARATION' && this.fortressSystem.isValidCell(grid.x, grid.y);
        this.fortressSystem.setHoverCell(grid.x, grid.y, isValid);
    }

    private handleCardPlacement(payload: CardPlayPayload) {
        const state = this.gameState.getState();
        if (state.phase !== 'PREPARATION') {
            this.events.emit('card-placement-result', { cardId: payload.card.id, success: false });
            return;
        }
        const worldPoint = this.cameras.main.getWorldPoint(payload.screenX, payload.screenY);
        const grid = this.fortressSystem.worldToGrid(worldPoint.x, worldPoint.y);
        const success = this.cardSystem.resolveCardPlacement({
            card: payload.card,
            gridX: grid.x,
            gridY: grid.y
        });
        if (success) {
            this.fortressSystem.clearHover();
        }
        this.events.emit('card-placement-result', { cardId: payload.card.id, success });
    }

    private fortressImage?: Phaser.GameObjects.Image;

    /**
     * Create the fortress image behind the spawn grid.
     * The image is positioned at the grid center and scaled to fit the grid.
     */
    private createFortressImage(imageKey: string, gridWidth: number, gridConfig?: IFortressGridConfig) {
        if (this.fortressImage) {
            this.fortressImage.destroy();
        }

        // Check if the texture exists
        if (!this.textures.exists(imageKey)) {
            console.warn(`[BattleScene] Fortress image "${imageKey}" not found, skipping`);
            return;
        }

        // Get the center of the grid (fortressCoreWorld must be set before calling this)
        const coreX = this.fortressCoreWorld.x;
        const coreY = this.fortressCoreWorld.y;

        // Nudge the art upward so the fortress floor lines up with the grid
        const verticalOffset = -320 + (gridConfig?.imageOffsetY ?? 0);
        const horizontalOffset = -60 + (gridConfig?.imageOffsetX ?? 0); // shift left to match grid alignment
        const fortress = this.add.image(coreX + horizontalOffset, coreY + verticalOffset, imageKey);
        
        // Position the fortress so the grid appears on top of it
        // Origin at center horizontally, and about 30% down (top surface center)
        fortress.setOrigin(0.5, 0.3);
        
        // Scale the fortress to match the grid size
        // For isometric diamond grid, the visual width spans gridWidth cells diagonally
        const { width: cellWidth } = this.fortressSystem.getCellDimensions();
        const gridVisualWidth = gridWidth * cellWidth;
        // Existing scale boosted by 1.5x to make the fortress visually larger
        const targetScale = gridVisualWidth / fortress.width * 1.3;
        const scaleMultiplier = gridConfig?.imageScale ?? 1;
        fortress.setScale(targetScale * 1.25 * scaleMultiplier);

        // Place behind the grid graphics but in front of background
        // Use a depth that's below the grid lines but above world background
        fortress.setDepth(-500);
        
        this.fortressImage = fortress;
        console.log(`[BattleScene] Created fortress image: ${imageKey} at (${coreX}, ${coreY}), scale: ${targetScale.toFixed(2)}`);
    }

    private createFortressCorePlaceholder() {
        const x = this.fortressCoreWorld.x;
        const y = this.fortressCoreWorld.y;

        if (this.fortressCoreGraphic) {
            this.fortressCoreGraphic.destroy();
        }
        
        // For now, skip the core building placeholder when using fortress image
        // The fortress image already has a visual center
        if (this.fortressImage) {
            return;
        }
        
        const core = this.add.image(x, y, 'building_fortress_core');
        core.setOrigin(0.5, 0.8);
        const { width } = this.fortressSystem.getCellDimensions();
        const baseScale = (width * 1.0) / (core.width || 1);
        core.setScale(baseScale);

        // Depth: keep tower in front of units standing near the core.
        core.setDepth(y + 4000);
        this.fortressCoreGraphic = core;

        // Gentle breathing animation so the eye feels alive.
        this.tweens.add({
            targets: core,
            scaleX: baseScale * 1.03,
            scaleY: baseScale * 1.03,
            duration: 900,
            yoyo: true,
            repeat: -1
        });
    }

    private handleVictory() {
        if (this.battleState === 'victory') return;
        this.battleState = 'victory';
        // Play victory stinger when final wave (boss) is defeated.
        if (this.sound && this.sound.get('sfx_victory')?.isPlaying !== true) {
            this.sound.play('sfx_victory', { volume: 0.7 });
        }
        this.showOverlay('Victory!', 'All 10 waves cleared! Iron Juggernaut defeated!', 0x44ff88);
        this.events.emit('battle-victory');
    }

    private handleDefeat() {
        if (this.battleState === 'defeat') return;
        this.battleState = 'defeat';
        this.showOverlay('Fortress Destroyed', 'Rebuild and try again.', 0xff5566);
        this.events.emit('battle-defeat');
    }

    private updateCameraForPhase(phase: BattlePhase) {
        const camera = this.cameras.main;
        const duration = 600;

        if (this.waveIntermissionCameraLock) {
            // Keep camera steady during wave-cleared reward flow
            return;
        }
        if (phase === 'PREPARATION') {
            // Zoom in and center on the player's fortress grid (building phase),
            // so the spawn diamonds sit in the middle of the screen.
            const target = this.fortressCoreWorld;
            camera.pan(target.x, target.y, duration, 'Sine.easeInOut');
            camera.zoomTo(2.5, duration);
        } else {
            // Zoom back out to full battlefield view for fighting / wave clear.
            camera.pan(this.battlefield.centerX, this.battlefield.centerY, duration, 'Sine.easeInOut');
            camera.zoomTo(1, duration);
        }
    }

    private showOverlay(title: string, subtitle: string, tint: number) {
        if (this.overlayContainer) {
            this.overlayContainer.destroy();
        }
        const container = this.add.container(960, 540);
        const bg = this.add.rectangle(0, 0, 620, 260, 0x0b0c10, 0.9)
            .setStrokeStyle(3, tint, 0.8)
            .setOrigin(0.5);
        const titleText = this.add.text(0, -40, title, {
            fontSize: '48px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        titleText.setTint(tint);
        const subtitleText = this.add.text(0, 30, subtitle, {
            fontSize: '24px',
            color: '#bfc5d2'
        }).setOrigin(0.5);
        const restart = this.add.text(0, 100, 'Press R to restart prototype', {
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);
        container.add([bg, titleText, subtitleText, restart]);
        container.setDepth(9000);
        this.overlayContainer = container;

        this.input.keyboard?.once('keydown-R', () => {
            this.scene.restart();
        });
    }

    private updateUnitAI() {
        const units = this.unitManager.getAllUnits();
        units.forEach(unit => {
            if (unit.isDead()) return;

            const currentPos = unit.getPosition();
            const bfLeft = this.battlefield.centerX - this.battlefield.width / 2;
            const bfTop = this.battlefield.centerY - this.battlefield.height / 2;
            const bounds = {
                minX: bfLeft + 5,
                maxX: bfLeft + this.battlefield.width - 5,
                minY: bfTop + 5,
                maxY: bfTop + this.battlefield.height - 5
            };

            if (currentPos.x < bounds.minX || currentPos.x > bounds.maxX ||
                currentPos.y < bounds.minY || currentPos.y > bounds.maxY) {
                const clampedX = Phaser.Math.Clamp(currentPos.x, bounds.minX, bounds.maxX);
                const clampedY = Phaser.Math.Clamp(currentPos.y, bounds.minY, bounds.maxY);
                (unit as any).teleportTo(clampedX, clampedY);
                return;
            }

            const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
            let targetPos: { x: number; y: number } | null = null;

            if (enemies.length > 0) {
                let closestEnemy: any = null;
                let closestDistance = Infinity;
                enemies.forEach(enemy => {
                    if (enemy.isDead()) return;
                    const distance = Phaser.Math.Distance.Between(
                        unit.getPosition().x, unit.getPosition().y,
                        enemy.getPosition().x, enemy.getPosition().y
                    );
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestEnemy = enemy;
                    }
                });

                if (closestEnemy) {
                    targetPos = closestEnemy.getPosition();
                }
            } else if (unit.getTeam() === 2) {
                // When there are no player units left, enemy units should
                // advance directly toward the fortress core at full speed.
                targetPos = this.fortressCoreWorld;
            }

            if (!targetPos) {
                return;
            }

            const dxToTarget = targetPos.x - currentPos.x;
            const dyToTarget = targetPos.y - currentPos.y;
            const distanceToTarget = Math.sqrt(dxToTarget * dxToTarget + dyToTarget * dyToTarget);

            const unitConfig = unit.getConfig();
            if (this.isRangedUnit(unitConfig.unitType) && distanceToTarget <= unit.getRange()) {
                return;
            }

            if (unitConfig.unitType === UnitType.NINJA && targetPos !== this.fortressCoreWorld) {
                const jumped = (unit as any).attemptNinjaJump(targetPos, this.time.now);
                if (jumped) {
                    return;
                }
            }

            const direction = { x: dxToTarget, y: dyToTarget };
            const nextX = currentPos.x + direction.x * 0.1;
            const nextY = currentPos.y + direction.y * 0.1;

            if (nextX < bounds.minX || nextX > bounds.maxX || nextY < bounds.minY || nextY > bounds.maxY) {
                if (nextX < bounds.minX) direction.x = Math.max(0, direction.x);
                if (nextX > bounds.maxX) direction.x = Math.min(0, direction.x);
                if (nextY < bounds.minY) direction.y = Math.max(0, direction.y);
                if (nextY > bounds.maxY) direction.y = Math.min(0, direction.y);
            }

            const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
            if (magnitude > 0) {
                direction.x /= magnitude;
                direction.y /= magnitude;
                unit.move(direction);
            }
        });
    }

    private checkCombat() {
        const currentTime = this.time.now;
        const state = this.gameState.getState();
        const fortressAlive = state.fortressHp > 0;
        const fortressPos = this.fortressCoreWorld;
        const units = this.unitManager.getAllUnits();
        units.forEach(unit => {
            if (unit.isDead()) return;
            if (!unit.canAttack(currentTime)) return;

            const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
            let targetEnemy = null;
            let closestDistance = unit.getRange();

            enemies.forEach(enemy => {
                if (enemy.isDead()) return;
                const distance = Phaser.Math.Distance.Between(
                    unit.getPosition().x, unit.getPosition().y,
                    enemy.getPosition().x, enemy.getPosition().y
                );
                if (distance <= unit.getRange() && distance < closestDistance) {
                    closestDistance = distance;
                    targetEnemy = enemy;
                }
            });

            if (targetEnemy) {
                const unitConfig = unit.getConfig();
                if (unitConfig.unitType === UnitType.RAIDER_BOSS) {
                    this.performBossAreaAttack(unit);
                } else if (this.isRangedUnit(unitConfig.unitType)) {
                    this.handleRangedAttack(unit, targetEnemy);
                } else if (this.isMeleeUnit(unitConfig.unitType)) {
                    unit.performMeleeAttack(targetEnemy, currentTime, this.unitManager as any, this.combatSystem as any);
                }
                unit.setLastAttackTime(currentTime);
                return;
            }

            // If this is an enemy unit and there are no player units in
            // range, let it attack the fortress core like a unit target.
            if (unit.getTeam() === 2 && fortressAlive) {
                const pos = unit.getPosition();
                const distToFortress = Phaser.Math.Distance.Between(
                    pos.x, pos.y,
                    fortressPos.x, fortressPos.y
                );
                if (distToFortress <= unit.getRange()) {
                    const unitConfig = unit.getConfig();
                    if (this.isRangedUnit(unitConfig.unitType)) {
                        this.createProjectileAttackAgainstFortress(unit, unitConfig.unitType);
                        unit.setLastAttackTime(currentTime);
                    } else if (this.isMeleeUnit(unitConfig.unitType)) {
                        const fortressTargetStub = {
                            getPosition: () => fortressPos,
                            isDead: () => false,
                            takeDamage: (_amount: number) => { /* no-op: fortress damage handled separately */ }
                        };
                        unit.performMeleeAttack(fortressTargetStub as any, currentTime);
                        this.attackFortress(unit);
                        unit.setLastAttackTime(currentTime);
                    }
                }
            }
        });
    }

    private handleRangedAttack(attacker: any, target: any): void {
        const unitType = attacker.getConfig().unitType as UnitType;
        const damage = attacker.getDamage();
        this.combatSystem.dealDamage(attacker as any, target as any, damage);

        const skill: any = attacker.getPrimarySkill ? attacker.getPrimarySkill() : undefined;
        if (skill && skill.trigger === 'on_attack' && attacker.canUseSkill?.(skill, this.time.now)) {
            const enemies = this.unitManager.getUnitsByTeam(attacker.getTeam() === 1 ? 2 : 1);
            const center = target.getPosition();
            const targets = skill.aoeRadius
                ? enemies.filter((e: any) => !e.isDead() && Phaser.Math.Distance.Between(center.x, center.y, e.getPosition().x, e.getPosition().y) <= (skill.aoeRadius || 0))
                : [target];
            attacker.triggerSkill(skill, targets, this.time.now, this.combatSystem);
        } else {
            if (unitType === UnitType.FROST_PUTRID_ARCHER) {
                this.applySlowCloud(target.getPosition(), attacker.getTeam());
            } else if (unitType === UnitType.FROST_AGONY_SCREAMER) {
                const center = target.getPosition();
                const enemies = this.unitManager.getUnitsByTeam(attacker.getTeam() === 1 ? 2 : 1);
                enemies.forEach(enemy => {
                    if (enemy.isDead()) return;
                    const pos = enemy.getPosition();
                    const dist = Phaser.Math.Distance.Between(center.x, center.y, pos.x, pos.y);
                    if (dist <= 120) {
                        this.combatSystem.dealDamage(attacker as any, enemy as any, Math.round(damage * 0.6));
                    }
                });
            } else if (unitType === UnitType.JADE_CROSSBOW_GUNNERS) {
                const id = attacker.getId();
                const count = (this.jadeCrossbowHitCounter.get(id) ?? 0) + 1;
                if (count >= 5) {
                    this.jadeCrossbowHitCounter.set(id, 0);
                    this.combatSystem.applyStatusEffect(target as any, StatusEffect.SLOWED, 2);
                } else {
                    this.jadeCrossbowHitCounter.set(id, count);
                }
            } else if (unitType === UnitType.JADE_SHURIKEN_NINJAS) {
                if (Math.random() < 0.3) {
                    this.combatSystem.applyStatusEffect(target as any, StatusEffect.SLOWED, 1.5);
                }
            } else if (unitType === UnitType.JADE_SHIKIGAMI_FOX) {
                this.combatSystem.applyStatusEffect(target as any, StatusEffect.STUNNED, 0.2);
            }
        }

        // Visual projectile
        this.createProjectileAttack(attacker, target, unitType);
    }

    private applySlowCloud(center: { x: number; y: number }, attackerTeam: number): void {
        const enemies = this.unitManager.getUnitsByTeam(attackerTeam === 1 ? 2 : 1);
        enemies.forEach(enemy => {
            if (enemy.isDead()) return;
            const pos = enemy.getPosition();
            const dist = Phaser.Math.Distance.Between(center.x, center.y, pos.x, pos.y);
            if (dist <= 120) {
                this.combatSystem.applyStatusEffect(enemy as any, StatusEffect.SLOWED, 2);
            }
        });
    }

    private processPassiveSkills(): void {
        this.applyPassiveTick(this.time.now);
    }

    // Helper using the unit's stored lastPassiveTick map via public methods
    private applyPassiveTick(currentTime: number): void {
        const units = this.unitManager.getAllUnits();
        units.forEach(unit => {
            const u: any = unit;
            if (!u.getSkillTemplates) return;
            const skills = u.getSkillTemplates().filter((s: any) => s.trigger === 'passive_tick');
            skills.forEach((skill: any) => {
                const tickMs = skill.auraTickMs ?? skill.cooldownMs ?? 1000;
                const last = u.getLastPassiveTick ? u.getLastPassiveTick(skill.id) : 0;
                if (currentTime - last < tickMs) return;
                if (u.setLastPassiveTick) u.setLastPassiveTick(skill.id, currentTime);

                const targetType = skill.target || this.inferTarget(skill);
                const allies = this.unitManager.getUnitsByTeam(unit.getTeam());
                const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
                const origin = unit.getPosition();
                let targets: any[] = [];
                const radius = skill.auraRadius ?? skill.aoeRadius ?? 0;
                const inRadius = (list: any[]) => radius > 0 ? list.filter(u2 => !u2.isDead() && Phaser.Math.Distance.Between(origin.x, origin.y, u2.getPosition().x, u2.getPosition().y) <= radius) : list;

                if (targetType === 'ally') targets = inRadius(allies);
                else if (targetType === 'self') targets = [unit];
                else if (targetType === 'both') targets = inRadius(allies).concat(inRadius(enemies));
                else targets = inRadius(enemies);

                if (targets.length > 0 && unit.triggerSkill) {
                    // Visualize aura tick
                    if (skill.auraRadius && skill.target === 'ally') {
                        const g = this.add.graphics();
                        g.setDepth(origin.y + 3000);
                        g.setBlendMode(Phaser.BlendModes.ADD);
                        g.lineStyle(2, 0x66ffcc, 0.55);
                        g.strokeCircle(origin.x, origin.y, skill.auraRadius);
                        this.tweens.add({
                            targets: g,
                            alpha: 0,
                            duration: 300,
                            onComplete: () => g.destroy()
                        });
                    }
                    unit.triggerSkill(skill, targets, currentTime, this.combatSystem);
                }
            });
        });
    }

    private inferTarget(skill: any): 'ally' | 'enemy' {
        if (skill.hotAmount || (skill.statusEffects && skill.statusEffects.includes('hot')) || skill.damageBuffMultiplier) {
            return 'ally';
        }
        return 'enemy';
    }

    private updateJadeAuras(): void {
        const now = this.time.now;
        const units = this.unitManager.getAllUnits();
        units.forEach(unit => {
            const type = unit.getConfig().unitType as UnitType;
            const team = unit.getTeam();
            const pos = unit.getPosition();

            if (type === UnitType.JADE_SPIRIT_LANTERN) {
                const last = this.jadeSpiritLanternTick.get(unit.getId()) ?? 0;
                if (now - last > 1500) {
                    this.jadeSpiritLanternTick.set(unit.getId(), now);
                    const allies = this.unitManager.getUnitsByTeam(team);
                    allies.forEach(a => {
                        if (a.isDead()) return;
                        const dist = Phaser.Math.Distance.Between(pos.x, pos.y, a.getPosition().x, a.getPosition().y);
                        if (dist <= 200) {
                            (a as any).heal?.(6);
                        }
                    });
                    const enemies = this.unitManager.getUnitsByTeam(team === 1 ? 2 : 1);
                    enemies.forEach(e => {
                        if (e.isDead()) return;
                        const dist = Phaser.Math.Distance.Between(pos.x, pos.y, e.getPosition().x, e.getPosition().y);
                        if (dist <= 200) {
                            this.combatSystem.applyStatusEffect(e as any, StatusEffect.SLOWED, 1.5);
                        }
                    });
                }
            } else if (type === UnitType.JADE_SHRINE_ONI) {
                const last = this.jadeOniTauntTick.get(unit.getId()) ?? 0;
                if (now - last > 7000) {
                    this.jadeOniTauntTick.set(unit.getId(), now);
                    (unit as any).heal?.(30);
                }
            }
        });
    }

    private registerFrostAbilityEvents(): void {
        this.events.on('unit-spawned', this.onUnitSpawned, this);
        this.events.on('unit-death', this.onUnitDeath, this);
    }

    private onUnitSpawned(unit: any): void {
        const skills = unit.getSkillTemplates ? unit.getSkillTemplates().filter((s: any) => s.trigger === 'on_spawn') : [];
        skills.forEach((skill: any) => {
            const targetType = skill.target || this.inferTarget(skill);
            const allies = this.unitManager.getUnitsByTeam(unit.getTeam());
            const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
            const origin = unit.getPosition();
            const radius = skill.auraRadius ?? skill.aoeRadius ?? 0;
            const inRadius = (list: any[]) => radius > 0 ? list.filter(u2 => !u2.isDead() && Phaser.Math.Distance.Between(origin.x, origin.y, u2.getPosition().x, u2.getPosition().y) <= radius) : list;
            let targets: any[] = [];
            if (targetType === 'ally') targets = inRadius(allies);
            else if (targetType === 'self') targets = [unit];
            else if (targetType === 'both') targets = inRadius(allies).concat(inRadius(enemies));
            else targets = inRadius(enemies);
            if (targets.length > 0) {
                unit.triggerSkill(skill, targets, this.time.now, this.combatSystem);
            }
        });

        const type = unit.getConfig().unitType as UnitType;
        if (type === UnitType.FROST_ABOMINATION) {
            const allies = this.unitManager.getUnitsByTeam(unit.getTeam());
            const nearby = allies.filter(a => a.getId() !== unit.getId() && !a.isDead());
            const shareBase = Math.max(1, Math.floor(unit.getMaxHealth() * 0.2));
            const sharePerAlly = Math.max(3, Math.floor(shareBase / Math.max(1, nearby.length)));
            nearby.forEach(ally => {
                const posA = ally.getPosition();
                const dist = Phaser.Math.Distance.Between(posA.x, posA.y, unit.getPosition().x, unit.getPosition().y);
                if (dist <= 180) {
                    ally.heal(sharePerAlly);
                }
            });
        }
    }

    private onUnitDeath(unit: any): void {
        const type = unit.getConfig?.().unitType as UnitType | undefined;
        if (!type) return;

        const skills = unit.getSkillTemplates ? unit.getSkillTemplates().filter((s: any) => s.trigger === 'on_death') : [];
        skills.forEach((skill: any) => {
            const origin = unit.getPosition();
            const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
            const allies = this.unitManager.getUnitsByTeam(unit.getTeam());
            const radius = skill.aoeRadius ?? skill.auraRadius ?? 0;
            const targetType = skill.target || this.inferTarget(skill);
            const inRadius = (list: any[]) => radius > 0 ? list.filter(u2 => !u2.isDead() && Phaser.Math.Distance.Between(origin.x, origin.y, u2.getPosition().x, u2.getPosition().y) <= radius) : list;
            let targets: any[] = [];
            if (targetType === 'ally') targets = inRadius(allies);
            else if (targetType === 'self') targets = [unit];
            else if (targetType === 'both') targets = inRadius(allies).concat(inRadius(enemies));
            else targets = inRadius(enemies);
            if (targets.length > 0) {
                unit.triggerSkill(skill, targets, this.time.now, this.combatSystem);
            }
        });

        if (type === UnitType.FROST_FLESH_WEAVER) {
            const center = unit.getPosition();
            const all = this.unitManager.getAllUnits();
            all.forEach(other => {
                if (other.isDead()) return;
                const pos = other.getPosition();
                const dist = Phaser.Math.Distance.Between(center.x, center.y, pos.x, pos.y);
                if (dist <= 90) {
                    this.combatSystem.dealDamage(unit as any, other as any, 20);
                }
            });
        }

        // Eternal Watcher temp HP on nearby death (friendly only)
        const watchers = this.unitManager.getUnitsByTeam(unit.getTeam()).filter(u => u.getConfig().unitType === UnitType.FROST_ETERNAL_WATCHER);
        watchers.forEach(w => {
            if (w.isDead()) return;
            const dist = Phaser.Math.Distance.Between(unit.getPosition().x, unit.getPosition().y, w.getPosition().x, w.getPosition().y);
            if (dist <= 200) {
                w.heal(25);
            }
        });

        // Jade Paper Doll root on death
        if (type === UnitType.JADE_PAPER_DOLL) {
            const center = unit.getPosition();
            const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
            enemies.forEach(e => {
                if (e.isDead()) return;
                const dist = Phaser.Math.Distance.Between(center.x, center.y, e.getPosition().x, e.getPosition().y);
                if (dist <= 140) {
                    this.combatSystem.applyStatusEffect(e as any, StatusEffect.SNARED, 1.5);
                }
            });
        }
    }

    private updateFrostAuras(): void {
        const allUnits = this.unitManager.getAllUnits();
        allUnits.forEach(unit => {
            const type = unit.getConfig().unitType as UnitType;
            const team = unit.getTeam();
            const pos = unit.getPosition();

            if (type === UnitType.FROST_BOUND_SPECTRE) {
                const enemies = this.unitManager.getUnitsByTeam(team === 1 ? 2 : 1);
                enemies.forEach(enemy => {
                    if (enemy.isDead()) return;
                    const dist = Phaser.Math.Distance.Between(pos.x, pos.y, enemy.getPosition().x, enemy.getPosition().y);
                    if (dist <= 170) {
                        this.combatSystem.applyStatusEffect(enemy as any, StatusEffect.SUPPRESSED, 1.2);
                    }
                });
            } else if (type === UnitType.FROST_SCREAMING_COFFIN) {
                const enemies = this.unitManager.getUnitsByTeam(team === 1 ? 2 : 1);
                enemies.forEach(enemy => {
                    if (enemy.isDead()) return;
                    const dist = Phaser.Math.Distance.Between(pos.x, pos.y, enemy.getPosition().x, enemy.getPosition().y);
                    if (dist <= 200) {
                        this.combatSystem.applyStatusEffect(enemy as any, StatusEffect.DAZED, 1.5);
                    }
                });
            } else if (type === UnitType.FROST_CURSED_WALKER) {
                const allies = this.unitManager.getUnitsByTeam(team);
                allies.forEach(ally => {
                    if (ally.isDead()) return;
                    if (ally.getId && ally.getId() === unit.getId()) return;
                    const dist = Phaser.Math.Distance.Between(pos.x, pos.y, ally.getPosition().x, ally.getPosition().y);
                    if (dist <= 160) {
                        (ally as any).clearDebuffs?.();
                    }
                });
            } else if (type === UnitType.FROST_FORBIDDEN_SCIENTIST) {
                const last = this.frostScientistBuffTimers.get(unit.getId()) ?? 0;
                const now = this.time.now;
                if (now - last > 4000) {
                    const allies = this.unitManager.getUnitsByTeam(team)
                        .filter(a => a.getId() !== unit.getId() && !a.isDead());
                    let target: any = null;
                    let closest = Infinity;
                    allies.forEach(a => {
                        const d = Phaser.Math.Distance.Between(pos.x, pos.y, a.getPosition().x, a.getPosition().y);
                        if (d <= 140 && d < closest) {
                            closest = d;
                            target = a;
                        }
                    });
                    if (target) {
                        const hpLoss = Math.floor(target.getMaxHealth() * 0.05);
                        const safeLoss = Math.min(hpLoss, Math.max(0, target.getHealth() - 1));
                        if (safeLoss > 0) {
                            target.takeDamage(safeLoss);
                        }
                        target.addDamageBuff?.(1.2, 6000);
                        this.frostScientistBuffTimers.set(unit.getId(), now);
                    }
                }
            }
        });
    }

    private createProjectileAttackAgainstFortress(attackerUnit: any, unitType: UnitType) {
        const attackerPos = attackerUnit.getPosition();
        const targetPos = this.fortressCoreWorld;
        let speed = 320;
        switch (unitType) {
            case UnitType.SNIPER:
                speed = 600;
                break;
            case UnitType.COG_THUNDER_CANNON:
                speed = 220;
                break;
            case UnitType.DARK_MAGE:
                speed = 220;
                break;
            case UnitType.CHRONOTEMPORAL:
                speed = 250;
                break;
            case UnitType.COG_RAILGUNNER:
                speed = 420;
                break;
            case UnitType.RAIDER_ARCHER:
                speed = 420;
                break;
        }

        this.projectileSystem.createProjectile({
            startX: attackerPos.x,
            startY: attackerPos.y,
            targetX: targetPos.x,
            targetY: targetPos.y,
            unitType,
            damage: attackerUnit.getDamage(),
            speed,
            attackerTeam: attackerUnit.getTeam()
        });

        const distance = Phaser.Math.Distance.Between(attackerPos.x, attackerPos.y, targetPos.x, targetPos.y);
        const travelTime = (distance / speed) * 1000;

        this.time.delayedCall(travelTime, () => {
            const latestState = this.gameState.getState();
            if (latestState.fortressHp > 0) {
                this.attackFortress(attackerUnit);
            }
        });
    }

    private attackFortress(attacker: any): void {
        const damage = attacker.getDamage();
        this.gameState.takeFortressDamage(damage);

        const x = this.fortressCoreWorld.x;
        const y = this.fortressCoreWorld.y;
        const g = this.add.graphics();
        g.setDepth(y + 4500);
        g.setBlendMode(Phaser.BlendModes.ADD);
        g.lineStyle(3, 0xff5555, 0.9);
        g.strokeCircle(x, y, 80);
        this.tweens.add({
            targets: g,
            alpha: 0,
            duration: 220,
            onComplete: () => g.destroy()
        });
    }

    private updateMedicHealing(currentTime: number): void {
        const HEAL_COOLDOWN = 1500; // ms
        const HEAL_RADIUS = 220;
        const HEAL_AMOUNT = 6;

        const allies = this.unitManager.getUnitsByTeam(1);
        const medics = allies.filter(u => u.getConfig().unitType === UnitType.COG_MEDIC_DRONE);

        medics.forEach(medic => {
            const id = medic.getId();
            const last = this.medicLastHeal.get(id) ?? 0;
            if (currentTime - last < HEAL_COOLDOWN) {
                return;
            }
            this.medicLastHeal.set(id, currentTime);

            const center = medic.getPosition();
            allies.forEach(ally => {
                if (ally.isDead()) return;
                const pos = ally.getPosition();
                const dist = Phaser.Math.Distance.Between(center.x, center.y, pos.x, pos.y);
                if (dist <= HEAL_RADIUS) {
                    (ally as any).heal(HEAL_AMOUNT);
                }
            });

            const g = this.add.graphics();
            g.setDepth(4000);
            g.setBlendMode(Phaser.BlendModes.ADD);
            g.lineStyle(2, 0x66ffcc, 0.8);
            g.strokeCircle(center.x, center.y, HEAL_RADIUS);
            this.tweens.add({
                targets: g,
                alpha: 0,
                duration: 400,
                onComplete: () => g.destroy()
            });
        });
    }

    private isRangedUnit(unitType: UnitType): boolean {
        return [
            UnitType.SNIPER,
            UnitType.DARK_MAGE,
            UnitType.CHRONOTEMPORAL,
            UnitType.COG_RAILGUNNER,
            UnitType.COG_THUNDER_CANNON,
            UnitType.RAIDER_BOMBER,
            UnitType.RAIDER_ARCHER,
            UnitType.JADE_CROSSBOW_GUNNERS,
            UnitType.JADE_SHIKIGAMI_FOX,
            UnitType.FROST_PUTRID_ARCHER,
            UnitType.FROST_AGONY_SCREAMER
        ].includes(unitType);
    }

    private isMeleeUnit(unitType: UnitType): boolean {
        return [
            UnitType.WARRIOR,
            UnitType.NINJA,
            UnitType.SHOTGUNNER,
            UnitType.COG_SOLDIER,
            UnitType.COG_AEGIS_TANK,
            UnitType.RAIDER_GRUNT,
            UnitType.RAIDER_ROGUE,
            UnitType.JADE_AZURE_SPEAR,
            UnitType.JADE_STORM_MONKS,
            UnitType.JADE_HALBERD_GUARDIAN,
            UnitType.JADE_SHRINE_ONI,
            UnitType.JADE_CHI_DRAGOON,
            UnitType.JADE_BLUE_ONI,
            UnitType.JADE_PAPER_DOLL,
            UnitType.FROST_SHADE_SERVANT,
            UnitType.FROST_BLOODLINE_NOBLE,
            UnitType.FROST_ETERNAL_WATCHER,
            UnitType.FROST_CURSED_WALKER,
            UnitType.FROST_FLESH_WEAVER,
            UnitType.FROST_BOUND_SPECTRE,
            UnitType.FROST_ABOMINATION,
            UnitType.FROST_FORBIDDEN_SCIENTIST,
            UnitType.FROST_SCREAMING_COFFIN,
            UnitType.FROST_FLESH_CRAWLER,
            UnitType.FROST_FLESH_TITAN
        ].includes(unitType);
    }

    private performBossAreaAttack(boss: any): void {
        const center = boss.getPosition();
        const RADIUS = 80; // roughly size of a fortress grid diamond

        const enemies = this.unitManager.getUnitsByTeam(1);
        enemies.forEach(enemy => {
            if (enemy.isDead()) return;
            const pos = enemy.getPosition();
            const dist = Phaser.Math.Distance.Between(center.x, center.y, pos.x, pos.y);
            if (dist <= RADIUS) {
                this.combatSystem.dealDamage(boss as any, enemy as any, boss.getDamage());
            }
        });

        // Visual ground slam indicator
        const g = this.add.graphics();
        g.setDepth(6000);
        g.setBlendMode(Phaser.BlendModes.ADD);
        g.lineStyle(3, 0xffaa55, 0.9);
        g.strokeCircle(center.x, center.y, RADIUS);
        this.tweens.add({
            targets: g,
            alpha: 0,
            duration: 250,
            onComplete: () => g.destroy()
        });
    }

    private createProjectileAttack(attackerUnit: any, targetUnit: any, unitType: UnitType) {
        const attackerPos = attackerUnit.getPosition();
        const targetPos = targetUnit.getPosition();
        let speed = 320;
        switch (unitType) {
            case UnitType.SNIPER:
                speed = 600;
                break;
            case UnitType.COG_THUNDER_CANNON:
                speed = 220;
                break;
            case UnitType.DARK_MAGE:
                speed = 220;
                break;
            case UnitType.CHRONOTEMPORAL:
                speed = 250;
                break;
            case UnitType.COG_RAILGUNNER:
                speed = 420;
                break;
            case UnitType.RAIDER_ARCHER:
                speed = 420;
                break;
        }

        this.projectileSystem.createProjectile({
            startX: attackerPos.x,
            startY: attackerPos.y,
            targetX: targetPos.x,
            targetY: targetPos.y,
            unitType,
            damage: attackerUnit.getDamage(),
            speed,
            attackerTeam: attackerUnit.getTeam()
        });

        const distance = Phaser.Math.Distance.Between(attackerPos.x, attackerPos.y, targetPos.x, targetPos.y);
        const travelTime = (distance / speed) * 1000;

        this.time.delayedCall(travelTime, () => {
            if (unitType === UnitType.COG_THUNDER_CANNON) {
                // Thunder Cannon: area-of-effect blast at the landing point.
                const explosionCenter = targetPos;
                const explosionRadius = 110;
                const enemies = this.unitManager.getUnitsByTeam(attackerUnit.getTeam() === 1 ? 2 : 1);
                enemies.forEach(enemy => {
                    if (enemy.isDead()) return;
                    const pos = enemy.getPosition();
                    const dist = Phaser.Math.Distance.Between(
                        explosionCenter.x, explosionCenter.y,
                        pos.x, pos.y
                    );
                    if (dist <= explosionRadius) {
                        this.combatSystem.dealDamage(attackerUnit, enemy as any, attackerUnit.getDamage());
                    }
                });
            } else if (!targetUnit.isDead()) {
                this.combatSystem.dealDamage(attackerUnit, targetUnit, attackerUnit.getDamage());
            }
        });
    }

    private createEnvironmentalObjects() {
        const numTrees = 24;
        const numBushes = 32;
        const exclusionZones = [
            { x: 175, y: 340, width: 350, height: 400 },
            { x: 1395, y: 340, width: 350, height: 400 },
            { x: 760, y: 440, width: 400, height: 200 }
        ];

        for (let i = 0; i < numTrees; i++) {
            let x = 0, y = 0, attempts = 0;
            do {
                x = Phaser.Math.Between(150, 1770);
                y = Phaser.Math.Between(150, 930);
                attempts++;
            } while (attempts < 40 && this.isInExclusionZone(x, y, exclusionZones));
            if (attempts < 40) {
                this.createTree(x, y);
            }
        }

        for (let i = 0; i < numBushes; i++) {
            let x = 0, y = 0, attempts = 0;
            do {
                x = Phaser.Math.Between(150, 1770);
                y = Phaser.Math.Between(150, 930);
                attempts++;
            } while (attempts < 40 && this.isInExclusionZone(x, y, exclusionZones));
            if (attempts < 40) {
                this.createBush(x, y);
            }
        }
    }

    private isInExclusionZone(x: number, y: number, zones: Array<{ x: number; y: number; width: number; height: number }>): boolean {
        return zones.some(zone => x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height);
    }

    private createTree(x: number, y: number) {
        const tree = this.add.graphics();
        tree.fillStyle(0x8b4513, 1);
        tree.fillRect(x - 4, y - 8, 8, 16);
        tree.fillStyle(0x228b22, 0.8);
        tree.fillCircle(x, y - 20, 16);
        tree.fillStyle(0x32cd32, 0.7);
        tree.fillCircle(x - 8, y - 15, 12);
        tree.fillCircle(x + 8, y - 15, 12);
        tree.fillStyle(0x006400, 0.6);
        tree.fillCircle(x, y - 10, 10);
        this.isometricRenderer.addToRenderGroup(tree);
    }

    private createBush(x: number, y: number) {
        const bush = this.add.graphics();
        bush.fillStyle(0x228b22, 0.7);
        bush.fillCircle(x, y, 8);
        bush.fillStyle(0x32cd32, 0.6);
        bush.fillCircle(x - 6, y + 2, 6);
        bush.fillCircle(x + 6, y + 2, 6);
        bush.fillStyle(0x006400, 0.5);
        bush.fillCircle(x, y + 4, 5);
        this.isometricRenderer.addToRenderGroup(bush);
    }

    private resetAlliedUnitsToSpawnPositions(): void {
        const allies = this.unitManager.getUnitsByTeam(1);
        allies.forEach(unit => {
            const config = unit.getConfig();
            const spawnX = config.x;
            const spawnY = config.y;
            if (typeof spawnX === 'number' && typeof spawnY === 'number') {
                (unit as any).teleportTo(spawnX, spawnY);
            }
        });
    }
}
