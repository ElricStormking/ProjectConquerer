import Phaser from 'phaser';
import { ICard, IGameState } from '../types/ironwars';
import { HandManager } from '../ui/HandManager';
import { RelicInventoryUI } from '../ui/RelicInventoryUI';
import { GameStateManager } from '../systems/GameStateManager';
import { RunProgressionManager } from '../systems/RunProgressionManager';

export class UIScene extends Phaser.Scene {
    private readonly runManager = RunProgressionManager.getInstance();
    private handManager!: HandManager;
    private relicInventoryUI: RelicInventoryUI | null = null;
    private battleScene!: Phaser.Scene;
    private profitText!: Phaser.GameObjects.Text;
    private goldText!: Phaser.GameObjects.Text;
    private fortressText!: Phaser.GameObjects.Text;
    private livesText!: Phaser.GameObjects.Text;
    private waveText!: Phaser.GameObjects.Text;
    private phaseText!: Phaser.GameObjects.Text;
    private commanderText!: Phaser.GameObjects.Text;
    private fpsText!: Phaser.GameObjects.Text;
    private startButton!: Phaser.GameObjects.Rectangle;
    private startButtonLabel!: Phaser.GameObjects.Text;
    private junkTraderZone?: Phaser.GameObjects.Rectangle;
    private junkTraderLabel?: Phaser.GameObjects.Text;
    private junkTraderHint?: Phaser.GameObjects.Text;
    private junkTraderTag?: Phaser.GameObjects.Text;
    private junkTraderBounds?: Phaser.Geom.Rectangle;
    private junkTraderEnabled = true;
    private junkTraderHighlighted = false;
    private commanderCooldown = 0;
    private lastCommanderCast = 0;
    private startButtonLocked = false;
    private lastPhase = 'PREPARATION';
    private readonly junkTraderValue = 20;
    private battleEventsBound = false;

    private readonly handleHandUpdated = (payload: { hand: ICard[] }) => {
        this.handManager.setCards(payload.hand);
    };

    private readonly handleStateUpdated = (state: IGameState) => {
        this.updateStateTexts(state);
    };

    private readonly handlePhaseChanged = (phase: string) => {
        this.phaseText.setText(phase);
        this.updateStartButtonVisibility(phase);
        this.setJunkTraderEnabled(phase === 'PREPARATION');
    };

    private readonly handleWaveIntermissionLock = (locked: boolean) => {
        this.startButtonLocked = locked;
        this.updateStartButtonVisibility();
    };

    private readonly handleCardDrag = (payload: { screenX: number; screenY: number }) => {
        if (!this.junkTraderEnabled) {
            return;
        }
        this.setJunkTraderHighlight(this.isPointerOverJunkTrader(payload.screenX, payload.screenY));
    };

    private readonly handleCardDragEnd = () => {
        this.setJunkTraderHighlight(false);
    };

    private readonly handleCardDrop = (payload: { card: ICard; screenX: number; screenY: number }) => {
        const shouldSell = this.junkTraderEnabled && this.isPointerOverJunkTrader(payload.screenX, payload.screenY);
        this.setJunkTraderHighlight(false);
        if (shouldSell) {
            this.battleScene.events.emit('ui:card-sell', payload);
            this.flashJunkTrader();
            return;
        }
        this.battleScene.events.emit('ui:card-play', payload);
    };

    private readonly handleCommanderCast = (payload: { cooldown: number; lastCast: number }) => {
        this.commanderCooldown = payload.cooldown;
        this.lastCommanderCast = payload.lastCast;
        this.tweens.add({
            targets: this.commanderText,
            alpha: { from: 1, to: 0.2 },
            yoyo: true,
            repeat: 1,
            duration: 80
        });
    };

    private readonly handleBattleVictory = () => {
        this.phaseText.setText('Victory');
        this.commanderText.setText('Playtest ready');
    };

    private readonly handleBattleDefeat = () => {
        this.phaseText.setText('Defeat');
        this.commanderText.setText('Fortress destroyed');
    };

    constructor() {
        super({ key: 'UIScene' });
    }

    public create() {
        this.battleScene = this.scene.get('BattleScene');
        this.handManager = new HandManager(this, this.battleScene.events);
        this.relicInventoryUI = new RelicInventoryUI(this, 1870, 160);
        this.createTopHud();
        this.createStartButton();
        this.createJunkTrader();
        this.registerBattleEvents();
        this.registerRunEvents();
        const state = GameStateManager.getInstance().getState();
        this.handManager.setCards(state.hand);
        this.updateStateTexts(state);
        this.updateLivesText();
        this.updateStartButtonVisibility(state.phase);
        this.setJunkTraderEnabled(state.phase === 'PREPARATION');
    }

    public update() {
        const fps = Math.round(this.game.loop.actualFps);
        this.fpsText.setText(`FPS ${fps}`);
        this.updateCommanderCooldown();
    }

    private createTopHud() {
        const leftPanel = this.add.rectangle(170, 70, 320, 140, 0x0f111a, 0.7)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0xffffff, 0.2);
        this.profitText = this.add.text(40, 25, 'PROFIT 0', {
            fontSize: '20px',
            color: '#ffffff'
        });
        this.goldText = this.add.text(40, 55, 'GOLD 0', {
            fontSize: '18px',
            color: '#b8c2d3'
        });
        this.fortressText = this.add.text(40, 85, 'FORTRESS 0 / 0', {
            fontSize: '18px',
            color: '#ffdd88'
        });
        this.livesText = this.add.text(40, 115, 'LIVES 3', {
            fontSize: '18px',
            color: '#ff9e9e'
        });

        const rightPanel = this.add.rectangle(1750, 60, 340, 90, 0x0f111a, 0.7)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0xffffff, 0.2);
        this.waveText = this.add.text(1600, 30, 'Wave 0', {
            fontSize: '20px',
            color: '#ffffff'
        });
        this.phaseText = this.add.text(1600, 60, 'Preparation', {
            fontSize: '18px',
            color: '#b8c2d3'
        });
        this.commanderText = this.add.text(1600, 90, 'Commander Ready', {
            fontSize: '18px',
            color: '#ffb347'
        });

        this.fpsText = this.add.text(20, 110, 'FPS 0', {
            fontSize: '16px',
            color: '#7f8ea3'
        });

        this.add.existing(leftPanel);
        this.add.existing(rightPanel);
    }

    private createStartButton() {
        const cx = this.cameras.main.width / 2;
        // Move to middle-top area of the screen so it doesn't overlap the hand.
        const cy = 140;

        const button = this.add.rectangle(cx, cy, 320, 70, 0x2563eb, 0.96)
            .setStrokeStyle(3, 0xffffff, 0.9)
            .setOrigin(0.5);
        const label = this.add.text(cx, cy, 'Start Battle', {
            fontSize: '26px',
            color: '#ffffff',
            fontStyle: 'bold'
        })
            .setOrigin(0.5)
            .setShadow(0, 3, '#000000', 6, true, true);

        // Ensure the button sits above other HUD elements.
        button.setDepth(8000);
        label.setDepth(8001);

        button.setInteractive({ useHandCursor: true });
        button.on('pointerover', () => button.setFillStyle(0x1d4ed8, 0.98));
        button.on('pointerout', () => button.setFillStyle(0x2563eb, 0.96));
        button.on('pointerdown', () => {
            this.battleScene.events.emit('ui:start-wave');
        });

        this.startButton = button;
        this.startButtonLabel = label;
    }

    private createJunkTrader() {
        const size = 100;
        const x = 80;
        const y = 860;

        const zone = this.add.rectangle(x, y, size, size, 0x10141f, 0.85)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0x6b7280, 0.9);
        const tag = this.add.text(x, y - 14, 'JUNK', {
            fontSize: '18px',
            color: '#e2e8f0',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        const label = this.add.text(x, y + 6, 'TRADER', {
            fontSize: '14px',
            color: '#9aa6b2'
        }).setOrigin(0.5);
        const hint = this.add.text(x, y + 28, `+${this.junkTraderValue}g`, {
            fontSize: '16px',
            color: '#ffd27d',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        zone.setScrollFactor(0);
        tag.setScrollFactor(0);
        label.setScrollFactor(0);
        hint.setScrollFactor(0);

        zone.setDepth(6500);
        tag.setDepth(6501);
        label.setDepth(6501);
        hint.setDepth(6501);

        this.junkTraderZone = zone;
        this.junkTraderTag = tag;
        this.junkTraderLabel = label;
        this.junkTraderHint = hint;
        this.junkTraderBounds = new Phaser.Geom.Rectangle(x - size / 2, y - size / 2, size, size);
    }

    private updateStartButtonVisibility(phase?: string) {
        if (phase) {
            this.lastPhase = phase;
        }
        const visible = this.lastPhase === 'PREPARATION' && !this.startButtonLocked;
        this.startButton.setVisible(visible);
        this.startButtonLabel.setVisible(visible);
    }

    private registerBattleEvents() {
        if (this.battleEventsBound) {
            return;
        }
        this.battleEventsBound = true;

        this.battleScene.events.on('hand-updated', this.handleHandUpdated);
        this.battleScene.events.on('state-updated', this.handleStateUpdated);
        this.battleScene.events.on('phase-changed', this.handlePhaseChanged);
        this.battleScene.events.on('wave-intermission-lock', this.handleWaveIntermissionLock);
        this.battleScene.events.on('ui:card-drag', this.handleCardDrag);
        this.battleScene.events.on('ui:card-drag-end', this.handleCardDragEnd);
        this.battleScene.events.on('ui:card-drop', this.handleCardDrop);
        this.battleScene.events.on('commander-cast', this.handleCommanderCast);
        this.battleScene.events.on('battle-victory', this.handleBattleVictory);
        this.battleScene.events.on('battle-defeat', this.handleBattleDefeat);
    }

    private isPointerOverJunkTrader(x: number, y: number): boolean {
        if (!this.junkTraderBounds) {
            return false;
        }
        return this.junkTraderBounds.contains(x, y);
    }

    private setJunkTraderHighlight(active: boolean): void {
        if (!this.junkTraderZone || this.junkTraderHighlighted === active) {
            return;
        }
        this.junkTraderHighlighted = active;
        const fill = active ? 0x1f2a3a : 0x10141f;
        const stroke = active ? 0x4fc3f7 : 0x6b7280;
        const alpha = active ? 0.95 : 0.85;
        this.junkTraderZone.setFillStyle(fill, alpha);
        this.junkTraderZone.setStrokeStyle(2, stroke, active ? 1 : 0.9);
    }

    private setJunkTraderEnabled(enabled: boolean): void {
        this.junkTraderEnabled = enabled;
        const alpha = enabled ? 1 : 0.4;
        this.junkTraderZone?.setAlpha(alpha);
        this.junkTraderLabel?.setAlpha(alpha);
        this.junkTraderHint?.setAlpha(alpha);
        this.junkTraderTag?.setAlpha(alpha);
        if (!enabled) {
            this.setJunkTraderHighlight(false);
        }
    }

    private flashJunkTrader(): void {
        if (!this.junkTraderZone) {
            return;
        }
        this.tweens.add({
            targets: this.junkTraderZone,
            alpha: { from: 1, to: 0.35 },
            yoyo: true,
            repeat: 1,
            duration: 80
        });
    }

    private registerRunEvents() {
        this.runManager.on('lives-updated', this.updateLivesText, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.runManager.off('lives-updated', this.updateLivesText, this);
        });
    }

    private updateStateTexts(state: IGameState) {
        if (!this.goldText || !this.goldText.active) {
            return;
        }
        this.profitText.setText(`PROFIT ${state.factionResource}`);
        this.goldText.setText(`GOLD ${state.gold}`);
        this.fortressText.setText(`FORTRESS ${state.fortressHp} / ${state.fortressMaxHp}`);
        this.waveText.setText(`Wave ${state.currentWave}`);
        this.updateLivesText();
    }

    private updateLivesText() {
        const lives = this.runManager.getLives();
        if (this.livesText) {
            this.livesText.setText(`LIVES ${lives}`);
        }
    }

    private updateCommanderCooldown() {
        if (this.commanderCooldown <= 0) {
            this.commanderText.setText('Commander Ready');
            return;
        }
        const remaining = Math.max(0, this.commanderCooldown - (this.time.now - this.lastCommanderCast));
        if (remaining === 0) {
            this.commanderText.setText('Commander Ready');
        } else {
            this.commanderText.setText(`Commander ${Math.ceil(remaining / 1000)}s`);
        }
    }

    public shutdown(): void {
        if (this.relicInventoryUI) {
            this.relicInventoryUI.destroy();
            this.relicInventoryUI = null;
        }
        if (this.battleEventsBound) {
            this.battleScene?.events.off('hand-updated', this.handleHandUpdated);
            this.battleScene?.events.off('state-updated', this.handleStateUpdated);
            this.battleScene?.events.off('phase-changed', this.handlePhaseChanged);
            this.battleScene?.events.off('wave-intermission-lock', this.handleWaveIntermissionLock);
            this.battleScene?.events.off('ui:card-drag', this.handleCardDrag);
            this.battleScene?.events.off('ui:card-drag-end', this.handleCardDragEnd);
            this.battleScene?.events.off('ui:card-drop', this.handleCardDrop);
            this.battleScene?.events.off('commander-cast', this.handleCommanderCast);
            this.battleScene?.events.off('battle-victory', this.handleBattleVictory);
            this.battleScene?.events.off('battle-defeat', this.handleBattleDefeat);
            this.battleEventsBound = false;
        }
        this.junkTraderZone?.destroy();
        this.junkTraderLabel?.destroy();
        this.junkTraderHint?.destroy();
        this.junkTraderTag?.destroy();
        this.junkTraderZone = undefined;
        this.junkTraderLabel = undefined;
        this.junkTraderHint = undefined;
        this.junkTraderTag = undefined;
    }
}
