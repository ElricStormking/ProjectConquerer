import Phaser from 'phaser';
import { IsometricRenderer } from '../systems/IsometricRenderer';
import { PhysicsManager } from '../systems/PhysicsManager';
import { UnitManager } from '../systems/UnitManager';
import { CombatSystem, DamageEvent, StatusEffect } from '../systems/CombatSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { DeckSystem } from '../systems/DeckSystem';
import { CardSystem } from '../systems/CardSystem';
import { GameStateManager } from '../systems/GameStateManager';
import { FortressSystem } from '../systems/FortressSystem';
import { WaveManager } from '../systems/WaveManager';
import { CommanderSystem } from '../systems/CommanderSystem';
import { COG_DOMINION_STARTER } from '../data/ironwars/cog_dominion_starter';
import { BattlePhase, ICard, IDeckState, IHandUpdatePayload, IGameState, IFortressGridConfig, ICommanderFullConfig, IFortressConfig } from '../types/ironwars';

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
    private elfPoisonFields: Array<{
        x: number;
        y: number;
        radius: number;
        expiresAt: number;
        lastTickTime: number;
        tickMs: number;
        damagePerTick: number;
        visual?: Phaser.GameObjects.Graphics;
        team: number;
    }> = [];
    private elfLastPoisonBloomTime: Map<string, number> = new Map();
    private elfButterflyLifesteal: Map<string, number> = new Map();
    private elfSquireLastGuard: Map<string, number> = new Map();
    private elfGrovePetitionerLastHeal: Map<string, number> = new Map();
    private etherealSlowStacks: Map<string, { stacks: number; expiresAt: number }> = new Map();
    
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
        this.registerElfAbilityEvents();

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
            this.updateElfAuras(deltaSeconds);
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
        } else if (stageIndex === 3 && this.textures.exists('battle_bg_stage_4')) {
            bgKey = 'battle_bg_stage_4';
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
        const fallbackFortressId = `fortress_${factionIdForFortress}_01`;
        const preferredFortressId = factionRegistry.getFaction(factionIdForFortress)?.fortressId;
        const fortressId = factionRegistry.getFortressConfig(fallbackFortressId)
            ? fallbackFortressId
            : (preferredFortressId ?? fallbackFortressId);
        let fortressConfig = factionRegistry.getFortressConfig(fortressId);
        
        // Fallback to starterData if no CSV fortress found
        if (!fortressConfig) {
            console.warn(`[BattleScene] Fortress ${fortressId} not found, using starterData fallback`);
            fortressConfig = this.starterData.fortress;
        } else {
            console.log(`[BattleScene] Using fortress from CSV: ${fortressConfig.name} (${fortressConfig.gridWidth}x${fortressConfig.gridHeight})`);
        }

        // Get cell size from grid config if available
        const gridConfig = factionRegistry.getFortressGridConfig(fortressId);
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
        const runManager = RunProgressionManager.getInstance();
        const runStateForUnlocks = runManager.getRunState();
        const savedUnlocks = runStateForUnlocks?.fortressUnlockedCells?.[fortressConfig.id];
        const initialUnlocked = savedUnlocks ?? this.computeInitialUnlockedCells(fortressConfig);
        this.fortressSystem.setUnlockedCells(initialUnlocked);
        this.fortressSystem.initialize();
        
        // Calculate fortress core world position BEFORE creating the image
        const coreX = Math.floor(fortressConfig.gridWidth / 2);
        const coreY = Math.floor(fortressConfig.gridHeight / 2);
        this.fortressCoreWorld = this.fortressSystem.gridToWorld(coreX, coreY);
        
        // Create fortress image behind the grid (needs fortressCoreWorld to be set)
        this.createFortressImage(gridConfig?.imageKey ?? fortressId, fortressConfig.gridWidth, gridConfig);
        
        this.createFortressCorePlaceholder();

        this.deckSystem = new DeckSystem(7);
        
        // Prefer the player's run deck from RunProgressionManager.
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

    private computeInitialUnlockedCells(fortress: IFortressGridConfig | IFortressConfig): string[] {
        const centerX = Math.floor(fortress.gridWidth / 2);
        const centerY = Math.floor(fortress.gridHeight / 2);
        const cells = (fortress as any).cells as { x: number; y: number; type: string }[];
        const cellByKey = new Map<string, { x: number; y: number; type: string }>(cells.map(c => [`${c.x},${c.y}`, c]));

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

        const target = 9;
        if (initialSet.size < target) {
            const sorted = cells
                .filter(c => c.type !== 'blocked')
                .map(c => ({ key: `${c.x},${c.y}`, dist: Math.abs(c.x - centerX) + Math.abs(c.y - centerY) }))
                .sort((a, b) => a.dist - b.dist);
            for (const c of sorted) {
                if (initialSet.size >= target) break;
                initialSet.add(c.key);
            }
        }
        return Array.from(initialSet);
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

            let dxToTarget = targetPos.x - currentPos.x;
            let dyToTarget = targetPos.y - currentPos.y;
            const distanceToTarget = Math.sqrt(dxToTarget * dxToTarget + dyToTarget * dyToTarget);

            const unitConfig = unit.getConfig();
            const isSupportBackline =
                unitConfig.type === 'support' ||
                unitConfig.type === 'summoner' ||
                this.isSupportUnit(unitConfig.unitType);

            // Healers/supporters: stay in a safe band and kite away if enemies get too close.
            if (isSupportBackline) {
                const preferred = Math.max(unit.getRange(), 200); // desired standoff distance
                const retreatThreshold = Math.max(140, preferred * 0.65);
                const advanceThreshold = Math.max(180, preferred * 0.9);

                if (distanceToTarget < retreatThreshold) {
                    // Too close: move away from the nearest threat
                    dxToTarget *= -1;
                    dyToTarget *= -1;
                } else if (distanceToTarget <= advanceThreshold) {
                    // In the safe band: hold position
                    return;
                }
            } else {
                if (this.isRangedUnit(unitConfig.unitType) && distanceToTarget <= unit.getRange()) {
                    return;
                }

                if (unitConfig.unitType === UnitType.NINJA && targetPos !== this.fortressCoreWorld) {
                    const jumped = (unit as any).attemptNinjaJump(targetPos, this.time.now);
                    if (jumped) {
                        return;
                    }
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
        const now = this.time.now;

        if (unitType === UnitType.ELF_SOUL_LIGHT_BUTTERFLY) {
            attacker.setLastAttackTime(now);
            return;
        }

        if (unitType === UnitType.ELF_ETHEREAL_WEAVER) {
            this.applyEtherealSlow(attacker, target);
            this.createProjectileAttack(attacker, target, unitType);
            attacker.setLastAttackTime(now);
            return;
        }

        // Lightning Sorcerer: always fire chain lightning as the attack
        if (unitType === UnitType.TRIARCH_LIGHTNING_SORCERER) {
            const rawSkill: any = attacker.getPrimarySkill ? attacker.getPrimarySkill() : undefined;
            // Force cooldown-less usage so every attack is chain lightning
            const skill = rawSkill ? { ...rawSkill, cooldownMs: 0 } : undefined;
            const enemies = this.unitManager.getUnitsByTeam(attacker.getTeam() === 1 ? 2 : 1).filter((e: any) => !e.isDead());

            const buildChain = (): any[] => {
                const chain: any[] = [target];
                const maxCount = Math.max(1, (skill?.chainCount ?? 3));
                const radius = skill?.chainRadius ?? skill?.range ?? 220;
                while (chain.length < maxCount) {
                    const last = chain[chain.length - 1];
                    let best: any = null;
                    let bestDist = radius + 1;
                    enemies.forEach(e => {
                        if (chain.includes(e)) return;
                        const pos = e.getPosition();
                        const dist = Phaser.Math.Distance.Between(pos.x, pos.y, last.getPosition().x, last.getPosition().y);
                        if (dist <= radius && dist < bestDist) {
                            best = e;
                            bestDist = dist;
                        }
                    });
                    if (!best) break;
                    chain.push(best);
                }
                return chain;
            };

            const chainTargets = buildChain();
            if (chainTargets.length > 0) {
                this.drawChainLightning(attacker.getPosition(), chainTargets.map((t: any) => t.getPosition()));
                if (skill) {
                    attacker.triggerSkill(skill, chainTargets, now, this.combatSystem);
                } else {
                    // Fallback: apply base damage if skill missing
                    chainTargets.forEach((t: any) => this.combatSystem.dealDamage(attacker as any, t as any, attacker.getDamage()));
                }
            }
            attacker.setLastAttackTime(now);
            return;
        }

        if (unitType === UnitType.TRIARCH_AETHER_ARCHER) {
            this.handleAetherPiercingAttack(attacker, target);
            return;
        }

        const damage = attacker.getDamage();
        if (damage > 0) {
            this.combatSystem.dealDamage(attacker as any, target as any, damage);
        }

        const skill: any = attacker.getPrimarySkill ? attacker.getPrimarySkill() : undefined;
        if (skill && skill.trigger === 'on_attack' && attacker.canUseSkill?.(skill, this.time.now)) {
            const enemies = this.unitManager.getUnitsByTeam(attacker.getTeam() === 1 ? 2 : 1).filter((e: any) => !e.isDead());
            const center = target.getPosition();

            const buildChain = (): any[] => {
                const chain: any[] = [target];
                const maxCount = Math.max(1, skill.chainCount || 1);
                const radius = skill.chainRadius || skill.range || 220;
                while (chain.length < maxCount) {
                    const last = chain[chain.length - 1];
                    let best: any = null;
                    let bestDist = radius + 1;
                    enemies.forEach(e => {
                        if (chain.includes(e)) return;
                        const pos = e.getPosition();
                        const dist = Phaser.Math.Distance.Between(pos.x, pos.y, last.getPosition().x, last.getPosition().y);
                        if (dist <= radius && dist < bestDist) {
                            best = e;
                            bestDist = dist;
                        }
                    });
                    if (!best) break;
                    chain.push(best);
                }
                return chain;
            };

            const targets = skill.chainCount && skill.chainCount > 1
                ? buildChain()
                : skill.aoeRadius
                    ? enemies.filter((e: any) => Phaser.Math.Distance.Between(center.x, center.y, e.getPosition().x, e.getPosition().y) <= (skill.aoeRadius || 0))
                    : [target];

            if (skill.chainCount && skill.chainCount > 1 && targets.length > 1) {
                this.drawChainLightning(attacker.getPosition(), targets.map((t: any) => t.getPosition()));
            }

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

    private handleAetherPiercingAttack(attacker: any, target: any): void {
        const skill: any = attacker.getPrimarySkill ? attacker.getPrimarySkill() : undefined;
        const canPierce = skill && skill.trigger === 'on_attack' && attacker.canUseSkill?.(skill, this.time.now);

        if (!canPierce) {
            const damage = attacker.getDamage();
            this.combatSystem.dealDamage(attacker as any, target as any, damage);
            this.createProjectileAttack(attacker, target, UnitType.TRIARCH_AETHER_ARCHER);
            return;
        }

        const origin = attacker.getPosition();
        const targetPos = target.getPosition();
        const dirX = targetPos.x - origin.x;
        const dirY = targetPos.y - origin.y;
        const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);

        if (dirLen < 1) {
            const damage = attacker.getDamage();
            this.combatSystem.dealDamage(attacker as any, target as any, damage);
            this.createProjectileAttack(attacker, target, UnitType.TRIARCH_AETHER_ARCHER);
            return;
        }

        const nx = dirX / dirLen;
        const ny = dirY / dirLen;
        const maxRange = Math.max(attacker.getRange?.() ?? dirLen, dirLen);
        const rawWidth = typeof skill.aoeRadius === 'number' ? skill.aoeRadius : Number(skill.aoeRadius);
        const pierceWidth = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 60;
        const rawMaxTargets = typeof skill.maxTargets === 'number' ? skill.maxTargets : Number(skill.maxTargets);
        const maxTargets = Number.isFinite(rawMaxTargets) && rawMaxTargets > 0 ? rawMaxTargets : 3;

        const enemies = this.unitManager.getUnitsByTeam(attacker.getTeam() === 1 ? 2 : 1).filter((e: any) => !e.isDead());

        // Pick targets along the shot line for piercing.
        const candidates: Array<{ unit: any; proj: number }> = [];
        enemies.forEach(enemy => {
            const pos = enemy.getPosition();
            const relX = pos.x - origin.x;
            const relY = pos.y - origin.y;
            const proj = relX * nx + relY * ny;
            if (proj < 0 || proj > maxRange) return;
            const perp = Math.abs(relX * ny - relY * nx);
            if (perp > pierceWidth) return;
            candidates.push({ unit: enemy, proj });
        });

        if (!candidates.some(c => c.unit === target)) {
            candidates.push({ unit: target, proj: dirLen });
        }

        candidates.sort((a, b) => a.proj - b.proj);
        const projById = new Map<string, number>();
        candidates.forEach(entry => {
            const id = entry.unit.getId?.();
            if (id) projById.set(id, entry.proj);
        });

        const targets: any[] = [];
        const seen = new Set<string>();
        for (const entry of candidates) {
            const id = entry.unit.getId?.() ?? '';
            if (id && seen.has(id)) continue;
            if (id) seen.add(id);
            targets.push(entry.unit);
            if (targets.length >= maxTargets) break;
        }

        if (targets.length === 0) {
            targets.push(target);
        } else {
            const targetId = target.getId?.() ?? '';
            const hasTarget = targetId
                ? targets.some(t => t.getId?.() === targetId)
                : targets.includes(target);
            if (!hasTarget) {
                if (targets.length >= maxTargets) {
                    targets[targets.length - 1] = target;
                } else {
                    targets.push(target);
                }
            }
        }
        targets.sort((a, b) => {
            const aId = a.getId?.() ?? '';
            const bId = b.getId?.() ?? '';
            return (projById.get(aId) ?? 0) - (projById.get(bId) ?? 0);
        });

        const baseDamage = attacker.getDamage();
        const rawPierceDamage = typeof skill.damage === 'number' && Number.isFinite(skill.damage) && skill.damage > 0
            ? skill.damage
            : baseDamage;
        const secondaryMultiplier = 0.9;
        targets.forEach((enemy, index) => {
            const damage = index === 0 ? baseDamage : Math.round(rawPierceDamage * secondaryMultiplier);
            this.combatSystem.dealDamage(attacker as any, enemy as any, damage);
        });

        attacker.markSkillUsed?.(skill, this.time.now);

        const impactPoints = targets.map((t: any) => t.getPosition());
        this.drawAetherPierceLine(origin, impactPoints);

        const end = impactPoints[impactPoints.length - 1];
        const rawSpeed = typeof skill.projectileSpeed === 'number' ? skill.projectileSpeed : Number(skill.projectileSpeed);
        const speed = Number.isFinite(rawSpeed) && rawSpeed > 0 ? rawSpeed : 520;
        this.projectileSystem.createProjectile({
            startX: origin.x,
            startY: origin.y,
            targetX: end.x,
            targetY: end.y,
            unitType: UnitType.TRIARCH_AETHER_ARCHER,
            damage: rawPierceDamage,
            speed,
            attackerTeam: attacker.getTeam()
        });
    }

    private drawAetherPierceLine(origin: { x: number; y: number }, points: { x: number; y: number }[]): void {
        if (points.length === 0) return;
        const end = points[points.length - 1];
        const g = this.add.graphics();
        g.setDepth(7000);
        g.setBlendMode(Phaser.BlendModes.ADD);

        g.lineStyle(3, 0x9fe8ff, 0.9);
        g.beginPath();
        g.moveTo(origin.x, origin.y);
        g.lineTo(end.x, end.y);
        g.strokePath();

        g.lineStyle(8, 0x5ac7ff, 0.25);
        g.beginPath();
        g.moveTo(origin.x, origin.y);
        g.lineTo(end.x, end.y);
        g.strokePath();

        points.forEach((p, index) => {
            const ring = index === points.length - 1 ? 12 : 9;
            g.fillStyle(0xd9f6ff, 0.85);
            g.fillCircle(p.x, p.y, ring * 0.45);
            g.lineStyle(2, 0x7bdcff, 0.8);
            g.strokeCircle(p.x, p.y, ring);
        });

        this.tweens.add({
            targets: g,
            alpha: 0,
            scaleX: 1.06,
            scaleY: 1.06,
            duration: 240,
            ease: 'Quad.easeOut',
            onComplete: () => g.destroy()
        });
    }

    private drawChainLightning(origin: { x: number; y: number }, points: { x: number; y: number }[]): void {
        const g = this.add.graphics();
        g.setDepth(7000);
        g.setBlendMode(Phaser.BlendModes.ADD);

        const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
            const segments = 8;
            const path: { x: number; y: number }[] = [];
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const x = Phaser.Math.Linear(from.x, to.x, t);
                const y = Phaser.Math.Linear(from.y, to.y, t);
                const jitter = 14;
                path.push({ x: x + Phaser.Math.Between(-jitter, jitter), y: y + Phaser.Math.Between(-jitter, jitter) });
            }
            g.lineStyle(4, 0x8cf5ff, 1);
            g.beginPath();
            g.moveTo(from.x, from.y);
            path.forEach(p => g.lineTo(p.x, p.y));
            g.lineTo(to.x, to.y);
            g.strokePath();

            // glow overlay
            g.lineStyle(8, 0xb9ffff, 0.35);
            g.beginPath();
            g.moveTo(from.x, from.y);
            path.forEach(p => g.lineTo(p.x, p.y));
            g.lineTo(to.x, to.y);
            g.strokePath();
        };

        let last = origin;
        points.forEach(p => {
            stroke(last, p);
            // impact spark
            g.fillStyle(0xd7fbff, 0.95);
            g.fillCircle(p.x, p.y, 10);
            last = p;
        });

        this.tweens.add({
            targets: g,
            alpha: 0,
            scaleX: 1.12,
            scaleY: 1.12,
            duration: 260,
            ease: 'Quad.easeOut',
            onComplete: () => g.destroy()
        });
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
                if (this.shouldSkipSkill(skill)) return;
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

    private shouldSkipSkill(skill: any): boolean {
        const notes = typeof skill?.notes === 'string' ? skill.notes.toLowerCase() : '';
        return notes.includes('handled in code');
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

    private updateElfAuras(deltaSeconds: number): void {
        const now = this.time.now;
        const allUnits = this.unitManager.getAllUnits();
        if (allUnits.length === 0) return;

        const team1 = this.unitManager.getUnitsByTeam(1);
        const team2 = this.unitManager.getUnitsByTeam(2);
        const getAllies = (team: number) => (team === 1 ? team1 : team2);
        const getEnemies = (team: number) => (team === 1 ? team2 : team1);

        const healMultByUnit = new Map<any, number>();
        allUnits.forEach(unit => {
            unit.setHealingMultiplier?.(1);
            unit.setAuraDamageMultiplier?.(1);
            healMultByUnit.set(unit, 1);
        });
        this.elfButterflyLifesteal.clear();

        this.etherealSlowStacks.forEach((entry, unitId) => {
            if (entry.expiresAt <= now) {
                this.etherealSlowStacks.delete(unitId);
            }
        });

        allUnits.forEach(unit => {
            if (unit.isDead?.()) return;
            const type = unit.getConfig().unitType as UnitType;
            const team = unit.getTeam();
            const allies = getAllies(team);
            const enemies = getEnemies(team);
            const pos = unit.getPosition();

            if (type === UnitType.ELF_SPORE_WING_SCOUT) {
                const hazeSkill = unit.getSecondarySkill?.();
                const swiftSkill = unit.getPassiveSkill?.();
                const hazeRadius = Number(hazeSkill?.auraRadius ?? 200);
                const hazeDuration = Math.max(0.1, Number(hazeSkill?.statusDurationMs ?? 1200) / 1000);
                enemies.forEach(enemy => {
                    if (enemy.isDead?.()) return;
                    const enemyType = enemy.getConfig().unitType as UnitType;
                    if (!this.isRangedUnit(enemyType)) return;
                    const ePos = enemy.getPosition();
                    const dist = Phaser.Math.Distance.Between(pos.x, pos.y, ePos.x, ePos.y);
                    if (dist <= hazeRadius) {
                        this.combatSystem.applyStatusEffect(enemy as any, StatusEffect.DAZED, hazeDuration);
                    }
                });

                const swiftRadius = Number(swiftSkill?.auraRadius ?? 200);
                const swiftMult = Number(swiftSkill?.statModAmount ?? 1.15);
                const swiftDuration = Number(swiftSkill?.statModDurationMs ?? 1200);
                if (!Number.isFinite(swiftMult) || swiftMult <= 0) return;
                allies.forEach(ally => {
                    if (ally.isDead?.()) return;
                    const aPos = ally.getPosition();
                    const dist = Phaser.Math.Distance.Between(pos.x, pos.y, aPos.x, aPos.y);
                    if (dist <= swiftRadius) {
                        ally.applyMoveSpeedModifier?.(swiftMult, swiftDuration);
                    }
                });
            } else if (type === UnitType.ELF_VERDANT_LEGIONARY) {
                const bondSkill = unit.getPassiveSkill?.();
                const radius = Number(bondSkill?.auraRadius ?? 150);
                const nearbyCount = allies.filter(a => {
                    if (a.isDead?.()) return false;
                    if (a.getId?.() === unit.getId?.()) return false;
                    if (a.getConfig().unitType !== UnitType.ELF_VERDANT_LEGIONARY) return false;
                    const aPos = a.getPosition();
                    return Phaser.Math.Distance.Between(pos.x, pos.y, aPos.x, aPos.y) <= radius;
                }).length;
                const bonus = Math.min(nearbyCount * 0.05, 0.5);
                unit.setAuraDamageMultiplier?.(1 + bonus);
            } else if (type === UnitType.ELF_EMERALD_JUSTICIAR) {
                const buffCount = this.countJusticiarBuffs(unit);
                const bonus = Math.min(buffCount * 0.05, 0.3);
                if (bonus > 0) {
                    unit.setAuraDamageMultiplier?.(1 + bonus);
                }
            } else if (type === UnitType.ELF_KAELAS_SQUIRE) {
                const guardSkill = unit.getPassiveSkill?.();
                const radius = Number(guardSkill?.auraRadius ?? 160);
                const last = this.elfSquireLastGuard.get(unit.getId()) ?? 0;
                if (now - last >= 1000) {
                    this.elfSquireLastGuard.set(unit.getId(), now);
                    let target: any = null;
                    let bestScore = -Infinity;
                    allies.forEach(ally => {
                        if (ally.isDead?.()) return;
                        if (ally.getId?.() === unit.getId?.()) return;
                        const aPos = ally.getPosition();
                        const dist = Phaser.Math.Distance.Between(pos.x, pos.y, aPos.x, aPos.y);
                        if (dist > radius) return;
                        const score = Number(ally.getMaxHp?.() ?? ally.getMaxHealth?.() ?? 0);
                        if (score > bestScore) {
                            bestScore = score;
                            target = ally;
                        }
                    });
                    if (target) {
                        target.applyDamageShare?.(0.2, [target, unit], 1200);
                    }
                }
            } else if (type === UnitType.ELF_ORACLE) {
                const oracleSkill = unit.getPassiveSkill?.();
                const radius = Number(oracleSkill?.auraRadius ?? 220);
                const healMult = 1.15;
                allies.forEach(ally => {
                    if (ally.isDead?.()) return;
                    const aPos = ally.getPosition();
                    const dist = Phaser.Math.Distance.Between(pos.x, pos.y, aPos.x, aPos.y);
                    if (dist > radius) return;
                    const current = healMultByUnit.get(ally) ?? 1;
                    healMultByUnit.set(ally, Math.max(current, healMult));
                });
            } else if (type === UnitType.ELF_SOUL_LIGHT_BUTTERFLY) {
                const auraSkill = unit.getPassiveSkill?.();
                const radius = Number(auraSkill?.auraRadius ?? 180);
                allies.forEach(ally => {
                    if (ally.isDead?.()) return;
                    const aPos = ally.getPosition();
                    const dist = Phaser.Math.Distance.Between(pos.x, pos.y, aPos.x, aPos.y);
                    if (dist > radius) return;
                    const current = this.elfButterflyLifesteal.get(ally.getId()) ?? 0;
                    this.elfButterflyLifesteal.set(ally.getId(), Math.max(current, 0.1));
                });
            } else if (type === UnitType.ELF_GROVE_PETITIONER) {
                const healSkill = unit.getPassiveSkill?.();
                const radius = Number(healSkill?.auraRadius ?? 160);
                const healAmount = Number(healSkill?.healAmount ?? 12);
                const tickMs = Number(healSkill?.auraTickMs ?? 2000);
                const last = this.elfGrovePetitionerLastHeal.get(unit.getId()) ?? 0;
                if (now - last >= tickMs) {
                    let target: any = null;
                    let closest = Infinity;
                    allies.forEach(ally => {
                        if (ally.isDead?.()) return;
                        const currentHp = Number(ally.getHealth?.() ?? ally.getCurrentHp?.() ?? 0);
                        const maxHp = Number(ally.getMaxHp?.() ?? ally.getMaxHealth?.() ?? 0);
                        if (currentHp >= maxHp) return;
                        const aPos = ally.getPosition();
                        const dist = Phaser.Math.Distance.Between(pos.x, pos.y, aPos.x, aPos.y);
                        if (dist > radius) return;
                        if (dist < closest) {
                            closest = dist;
                            target = ally;
                        }
                    });
                    if (target) {
                        target.heal?.(healAmount);
                        this.elfGrovePetitionerLastHeal.set(unit.getId(), now);
                    }
                }
            }
        });

        allUnits.forEach(unit => {
            const mult = healMultByUnit.get(unit) ?? 1;
            unit.setHealingMultiplier?.(mult);
        });

        this.updateElfPoisonFields(now, deltaSeconds);
    }

    private registerFrostAbilityEvents(): void {
        this.events.on('unit-spawned', this.onUnitSpawned, this);
        this.events.on('unit-death', this.onUnitDeath, this);
    }

    private registerElfAbilityEvents(): void {
        this.events.on('damage-dealt', this.onDamageDealt, this);
        this.events.on('unit-healed', this.onUnitHealed, this);
    }

    private onUnitSpawned(unit: any): void {
        const skills = unit.getSkillTemplates
            ? unit.getSkillTemplates().filter((s: any) => s.trigger === 'on_spawn' && !this.shouldSkipSkill(s))
            : [];
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

        const onHitSkills = unit.getSkillTemplates
            ? unit.getSkillTemplates().filter((s: any) => s.trigger === 'on_hit' && !this.shouldSkipSkill(s))
            : [];
        if (onHitSkills.length > 0 && unit.on) {
            const pollenBurst = unit.getConfig?.().unitType === UnitType.ELF_POLLEN_BURSTER;
            unit.on('damage-taken', () => {
                if (unit.isDead?.()) return;
                const now = this.time.now;
                onHitSkills.forEach((skill: any) => {
                    if (!unit.canUseSkill?.(skill, now)) return;
                    const targetType = skill.target || this.inferTarget(skill);
                    const allies = this.unitManager.getUnitsByTeam(unit.getTeam());
                    const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
                    const origin = unit.getPosition();
                    const radius = skill.auraRadius ?? skill.aoeRadius ?? 0;
                    const inRadius = (list: any[]) =>
                        radius > 0
                            ? list.filter(
                                  u2 =>
                                      !u2.isDead() &&
                                      Phaser.Math.Distance.Between(
                                          origin.x,
                                          origin.y,
                                          u2.getPosition().x,
                                          u2.getPosition().y
                                      ) <= radius
                              )
                            : list;
                    let targets: any[] = [];
                    if (targetType === 'ally') targets = inRadius(allies);
                    else if (targetType === 'self') targets = [unit];
                    else if (targetType === 'both') targets = inRadius(allies).concat(inRadius(enemies));
                    else targets = inRadius(enemies);
                    if (pollenBurst) {
                        targets = targets.filter(t => this.isMeleeUnit(t.getConfig().unitType as UnitType));
                    }
                    if (targets.length > 0) {
                        unit.triggerSkill(skill, targets, now, this.combatSystem);
                    }
                });
            });
        }

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
            if (this.shouldSkipSkill(skill)) return;
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

        if (type === UnitType.ELF_GLOW_SPROUT_SPIRIT) {
            const center = unit.getPosition();
            const offsets = [
                { x: -16, y: 0 },
                { x: 16, y: 0 }
            ];
            offsets.forEach(offset => {
                const config = this.unitManager.createUnitConfig(
                    UnitType.ELF_VINE_TENDRIL,
                    unit.getTeam(),
                    center.x + offset.x,
                    center.y + offset.y
                );
                const spawned = this.unitManager.spawnUnit(config);
                if (spawned) {
                    this.time.delayedCall(20000, () => {
                        if (!spawned.isDead?.()) {
                            this.unitManager.removeUnit(spawned.getId());
                        }
                    });
                }
            });
        }

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

    private onDamageDealt(payload: DamageEvent): void {
        const attacker = payload.attacker;
        const target = payload.target;
        if (!attacker || !target) return;
        const attackerType = attacker.getConfig?.().unitType as UnitType | undefined;
        if (!attackerType) return;

        let lifestealPercent = this.elfButterflyLifesteal.get(attacker.getId()) ?? 0;
        if (attackerType === UnitType.ELF_SPIRIT_BOUND_DEER) {
            lifestealPercent += 0.15;
        }
        if (lifestealPercent > 0 && payload.damage > 0) {
            attacker.heal?.(payload.damage * lifestealPercent);
        }

        if (attackerType === UnitType.ELF_VITALITY_BONDER && payload.damage > 0) {
            const healAmount = payload.damage * 0.5;
            this.healAlliesAlongLine(attacker.getPosition(), target.getPosition(), healAmount, attacker.getTeam());
        }

        if (
            attackerType === UnitType.ELF_SEED_POD_ARTILLERY ||
            attackerType === UnitType.ELF_BLOOM_THROWER
        ) {
            this.maybeSpawnPoisonBloom(attacker, target);
        }

        if (attackerType === UnitType.ELF_EMERALD_DRAGONLING && !target.isDead?.()) {
            const currentHp = Number(target.getHealth?.() ?? target.getCurrentHp?.() ?? 0);
            const maxHp = Number(target.getMaxHp?.() ?? target.getMaxHealth?.() ?? 0);
            if (maxHp > 0 && currentHp / maxHp < 0.5) {
                const bonus = Math.max(1, Math.round(payload.damage * 0.3));
                target.takeDamage?.(bonus);
            }
        }

        if (attackerType === UnitType.ELF_CHAMPION_GLADE && !target.isDead?.()) {
            const rarity = target.getConfig?.().unitTemplate?.rarity;
            if (rarity === 'epic' || rarity === 'legendary') {
                const skill = attacker.getPassiveSkill?.();
                const mult = Number(skill?.statModAmount ?? 1.4);
                const duration = Number(skill?.statModDurationMs ?? 2000);
                attacker.applyAttackSpeedModifier?.(mult, duration);
            }
        }
    }

    private onUnitHealed(payload: { unit: any; amount: number }): void {
        const unit = payload.unit;
        if (!unit || unit.isDead?.()) return;
        const type = unit.getConfig?.().unitType as UnitType | undefined;
        if (type !== UnitType.ELF_SOUL_SEER_DISCIPLE) return;

        const pulseSkill = unit.getPassiveSkill?.() || unit.getSecondarySkill?.();
        const radius = Number(pulseSkill?.auraRadius ?? 120);
        const damage = Number(payload.amount);
        if (!Number.isFinite(damage) || damage <= 0) return;

        const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
        enemies.forEach(enemy => {
            if (enemy.isDead?.()) return;
            const ePos = enemy.getPosition();
            const uPos = unit.getPosition();
            const dist = Phaser.Math.Distance.Between(uPos.x, uPos.y, ePos.x, ePos.y);
            if (dist <= radius) {
                enemy.takeDamage?.(damage);
            }
        });
    }

    private countJusticiarBuffs(unit: any): number {
        let buffs = 0;
        if (unit.getDamageMultiplier?.() > 1) buffs += 1;
        if (unit.getAuraDamageMultiplier?.() > 1) buffs += 1;
        if ((unit.getShieldAmount?.() ?? 0) > 0) buffs += 1;
        if (unit.hasBuildingBuff?.()) buffs += 1;
        const baseSpeed = Number(unit.getConfig?.().stats?.attackSpeed ?? 0);
        const currentSpeed = Number(unit.getAttackSpeed?.() ?? 0);
        if (baseSpeed > 0 && currentSpeed > baseSpeed * 1.05) buffs += 1;
        return buffs;
    }

    private maybeSpawnPoisonBloom(attacker: any, target: any): void {
        const now = this.time.now;
        const attackerId = attacker.getId?.();
        if (!attackerId) return;
        const last = this.elfLastPoisonBloomTime.get(attackerId) ?? 0;
        if (now - last < 300) return;
        if (Math.random() > 0.2) return;

        const skill = attacker.getPrimarySkill?.();
        const pos = target.getPosition?.();
        if (!pos) return;
        const radius = Number(skill?.aoeRadius ?? 90);
        const damagePerTick = Number(skill?.dotAmount ?? 4);
        const tickMs = Number(skill?.dotTickMs ?? 1000);
        const durationMs = 10000;
        this.spawnPoisonBloom(pos.x, pos.y, radius, damagePerTick, tickMs, durationMs, attacker.getTeam());
        this.elfLastPoisonBloomTime.set(attackerId, now);
    }

    private spawnPoisonBloom(
        x: number,
        y: number,
        radius: number,
        damagePerTick: number,
        tickMs: number,
        durationMs: number,
        team: number
    ): void {
        const bloom = this.add.graphics();
        bloom.setDepth(y + 3000);
        bloom.setBlendMode(Phaser.BlendModes.ADD);
        bloom.fillStyle(0x66ff99, 0.2);
        bloom.fillCircle(x, y, radius);
        bloom.lineStyle(2, 0x2ecc71, 0.6);
        bloom.strokeCircle(x, y, radius);

        this.elfPoisonFields.push({
            x,
            y,
            radius,
            expiresAt: this.time.now + durationMs,
            lastTickTime: 0,
            tickMs,
            damagePerTick,
            visual: bloom,
            team
        });

        this.tweens.add({
            targets: bloom,
            alpha: 0,
            duration: durationMs,
            onComplete: () => bloom.destroy()
        });
    }

    private updateElfPoisonFields(now: number, _deltaSeconds: number): void {
        if (this.elfPoisonFields.length === 0) return;

        this.elfPoisonFields = this.elfPoisonFields.filter(field => {
            if (now >= field.expiresAt) {
                (field as any).visual?.destroy?.();
                return false;
            }
            return true;
        });

        this.elfPoisonFields.forEach(field => {
            if (now - field.lastTickTime < field.tickMs) return;
            field.lastTickTime = now;
            const enemies = this.unitManager.getUnitsByTeam(field.team === 1 ? 2 : 1);
            if (enemies.length === 0) return;
            enemies.forEach(enemy => {
                if (enemy.isDead?.()) return;
                const ePos = enemy.getPosition();
                const dist = Phaser.Math.Distance.Between(field.x, field.y, ePos.x, ePos.y);
                if (dist <= field.radius) {
                    enemy.takeDamage?.(field.damagePerTick);
                }
            });
        });
    }

    private healAlliesAlongLine(
        start: { x: number; y: number },
        end: { x: number; y: number },
        amount: number,
        team: number
    ): void {
        if (!Number.isFinite(amount) || amount <= 0) return;
        const allies = this.unitManager.getUnitsByTeam(team);
        const width = 40;
        allies.forEach(ally => {
            if (ally.isDead?.()) return;
            const pos = ally.getPosition();
            const dist = this.distancePointToSegment(pos, start, end);
            if (dist <= width) {
                ally.heal?.(amount);
            }
        });
    }

    private distancePointToSegment(
        point: { x: number; y: number },
        start: { x: number; y: number },
        end: { x: number; y: number }
    ): number {
        const vx = end.x - start.x;
        const vy = end.y - start.y;
        const wx = point.x - start.x;
        const wy = point.y - start.y;
        const c1 = vx * wx + vy * wy;
        if (c1 <= 0) {
            return Phaser.Math.Distance.Between(point.x, point.y, start.x, start.y);
        }
        const c2 = vx * vx + vy * vy;
        if (c2 <= c1) {
            return Phaser.Math.Distance.Between(point.x, point.y, end.x, end.y);
        }
        const b = c1 / c2;
        const pbx = start.x + b * vx;
        const pby = start.y + b * vy;
        return Phaser.Math.Distance.Between(point.x, point.y, pbx, pby);
    }

    private applyEtherealSlow(attacker: any, target: any): void {
        if (!target || target.isDead?.()) return;
        const skill = attacker.getPrimarySkill?.();
        const baseAmount = Number(skill?.slowAmount ?? 0.12);
        const durationMs = Number(skill?.slowDurationMs ?? 2000);
        const maxStacks = 3;
        const targetId = target.getId?.();
        if (!targetId) return;

        const now = this.time.now;
        const entry = this.etherealSlowStacks.get(targetId);
        const stacks = entry && entry.expiresAt > now ? Math.min(maxStacks, entry.stacks + 1) : 1;
        this.etherealSlowStacks.set(targetId, { stacks, expiresAt: now + durationMs });

        const totalAmount = Math.min(0.6, baseAmount * stacks);
        target.applySlow?.(totalAmount, durationMs);
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
            case UnitType.TRIARCH_AETHER_ARCHER:
                speed = 520;
                break;
            case UnitType.TRIARCH_MANA_SIPHON_ADEPT:
                speed = 360;
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
            UnitType.FROST_AGONY_SCREAMER,
            UnitType.TRIARCH_LIGHTNING_SORCERER,
            UnitType.TRIARCH_AETHER_ARCHER,
            UnitType.TRIARCH_MANA_SIPHON_ADEPT,
            UnitType.TRIARCH_RIFLEMAN_SQUAD,
            UnitType.TRIARCH_SNIPER_ELITE,
            UnitType.TRIARCH_FIRETHROWER_UNIT,
            UnitType.TRIARCH_HEAVY_SIEGE_WALKER,
            UnitType.ELF_SPORE_WING_SCOUT,
            UnitType.ELF_SEED_POD_ARTILLERY,
            UnitType.ELF_BLOOM_THROWER,
            UnitType.ELF_EMERALD_DRAGONLING,
            UnitType.ELF_SOUL_SEER_DISCIPLE,
            UnitType.ELF_SPIRIT_BOUND_DEER,
            UnitType.ELF_ORACLE,
            UnitType.ELF_ETHEREAL_WEAVER,
            UnitType.ELF_GROVE_PETITIONER,
            UnitType.ELF_SOUL_LIGHT_BUTTERFLY,
            UnitType.ELF_VITALITY_BONDER
        ].includes(unitType);
    }

    private isSupportUnit(unitType: UnitType): boolean {
        return [
            UnitType.COG_MEDIC_DRONE,
            UnitType.JADE_SPIRIT_LANTERN,
            UnitType.JADE_SHIKIGAMI_FOX,
            UnitType.FROST_FORBIDDEN_SCIENTIST,
            UnitType.TRIARCH_ACOLYTE_HEALER,
            UnitType.TRIARCH_PRIESTESS_DAWN,
            UnitType.TRIARCH_MANA_SIPHON_ADEPT,
            UnitType.ELF_SOUL_SEER_DISCIPLE,
            UnitType.ELF_ORACLE,
            UnitType.ELF_ETHEREAL_WEAVER,
            UnitType.ELF_GROVE_PETITIONER,
            UnitType.ELF_SOUL_LIGHT_BUTTERFLY,
            UnitType.ELF_VITALITY_BONDER
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
            UnitType.FROST_FLESH_TITAN,
            UnitType.TRIARCH_ZEALOT_DUELIST,
            UnitType.TRIARCH_CRUSADER_SHIELDBEARER,
            UnitType.TRIARCH_SERAPH_GUARDIAN,
            UnitType.TRIARCH_AETHER_GOLEM,
            UnitType.ELF_GLOW_SPROUT_SPIRIT,
            UnitType.ELF_VINE_TENDRIL,
            UnitType.ELF_VERDANT_LEGIONARY,
            UnitType.ELF_ROOT_KIN_SWARM,
            UnitType.ELF_POLLEN_BURSTER,
            UnitType.ELF_EMERALD_JUSTICIAR,
            UnitType.ELF_KAELAS_SQUIRE,
            UnitType.ELF_GUARDIAN_WORLD_TREE,
            UnitType.ELF_CHAMPION_GLADE,
            UnitType.ELF_EMERALD_VANGUARD,
            UnitType.ELF_HALLOW_TREE_PALADIN
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
            const damage = attackerUnit.getDamage();
            if (damage <= 0) return;
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
                        this.combatSystem.dealDamage(attackerUnit, enemy as any, damage);
                    }
                });
            } else if (!targetUnit.isDead()) {
                this.combatSystem.dealDamage(attackerUnit, targetUnit, damage);
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
