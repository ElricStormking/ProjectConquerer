import Phaser from 'phaser';
import { ICard, IGameState } from '../types/ironwars';
import { HandManager } from '../ui/HandManager';
import { GameStateManager } from '../systems/GameStateManager';

export class UIScene extends Phaser.Scene {
    private handManager!: HandManager;
    private battleScene!: Phaser.Scene;
    private profitText!: Phaser.GameObjects.Text;
    private goldText!: Phaser.GameObjects.Text;
    private fortressText!: Phaser.GameObjects.Text;
    private waveText!: Phaser.GameObjects.Text;
    private phaseText!: Phaser.GameObjects.Text;
    private commanderText!: Phaser.GameObjects.Text;
    private fpsText!: Phaser.GameObjects.Text;
    private startButton!: Phaser.GameObjects.Rectangle;
    private startButtonLabel!: Phaser.GameObjects.Text;
    private commanderCooldown = 0;
    private lastCommanderCast = 0;

    constructor() {
        super({ key: 'UIScene' });
    }

    public create() {
        this.battleScene = this.scene.get('BattleScene');
        this.handManager = new HandManager(this, this.battleScene.events);
        this.createTopHud();
        this.createStartButton();
        this.registerBattleEvents();
        const state = GameStateManager.getInstance().getState();
        this.handManager.setCards(state.hand);
        this.updateStateTexts(state);
    }

    public update() {
        const fps = Math.round(this.game.loop.actualFps);
        this.fpsText.setText(`FPS ${fps}`);
        this.updateCommanderCooldown();
    }

    private createTopHud() {
        const leftPanel = this.add.rectangle(170, 60, 320, 90, 0x0f111a, 0.7)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0xffffff, 0.2);
        this.profitText = this.add.text(40, 30, 'PROFIT 0', {
            fontSize: '20px',
            color: '#ffffff'
        });
        this.goldText = this.add.text(40, 60, 'GOLD 0', {
            fontSize: '18px',
            color: '#b8c2d3'
        });
        this.fortressText = this.add.text(40, 90, 'FORTRESS 0 / 0', {
            fontSize: '18px',
            color: '#ffdd88'
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

    private registerBattleEvents() {
        this.battleScene.events.on('hand-updated', (payload: { hand: ICard[] }) => {
            this.handManager.setCards(payload.hand);
        });

        this.battleScene.events.on('state-updated', (state: IGameState) => {
            this.updateStateTexts(state);
        });

        this.battleScene.events.on('phase-changed', (phase: string) => {
            this.phaseText.setText(phase);
            // Only show Start button when in a building/transition phase
            const visible = phase === 'PREPARATION' || phase === 'WAVE_COMPLETE';
            this.startButton.setVisible(visible);
            this.startButtonLabel.setVisible(visible);
        });

        this.battleScene.events.on('commander-cast', (payload: { cooldown: number; lastCast: number }) => {
            this.commanderCooldown = payload.cooldown;
            this.lastCommanderCast = payload.lastCast;
            this.tweens.add({
                targets: this.commanderText,
                alpha: { from: 1, to: 0.2 },
                yoyo: true,
                repeat: 1,
                duration: 80
            });
        });

        this.battleScene.events.on('battle-victory', () => {
            this.phaseText.setText('Victory');
            this.commanderText.setText('Playtest ready');
        });

        this.battleScene.events.on('battle-defeat', () => {
            this.phaseText.setText('Defeat');
            this.commanderText.setText('Fortress destroyed');
        });
    }

    private updateStateTexts(state: IGameState) {
        this.profitText.setText(`PROFIT ${state.factionResource}`);
        this.goldText.setText(`GOLD ${state.gold}`);
        this.fortressText.setText(`FORTRESS ${state.fortressHp} / ${state.fortressMaxHp}`);
        this.waveText.setText(`Wave ${state.currentWave}`);
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
}
