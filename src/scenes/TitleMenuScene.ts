import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';

const MENU_BUTTON_WIDTH = 320;
const MENU_BUTTON_HEIGHT = 60;
const MENU_BUTTON_GAP = 20;

export class TitleMenuScene extends Phaser.Scene {
    private readonly saveManager = SaveManager.getInstance();
    private menuContainer!: Phaser.GameObjects.Container;
    private titleText!: Phaser.GameObjects.Text;
    private subtitleText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'TitleMenuScene' });
    }

    create(): void {
        const { width, height } = this.cameras.main;
        
        // Background gradient
        this.createBackground(width, height);
        
        // Title
        this.createTitle(width);
        
        // Menu buttons
        this.createMenu(width, height);
        
        // Fade in
        this.cameras.main.fadeIn(500, 0, 0, 0);
        
        // Animate title entrance
        this.animateTitleEntrance();
    }

    private createBackground(width: number, height: number): void {
        // Dark gradient background
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0a0c12, 0x0a0c12, 0x1a1d2e, 0x1a1d2e, 1);
        bg.fillRect(0, 0, width, height);
        
        // Decorative lines
        const lines = this.add.graphics();
        lines.lineStyle(1, 0x3d4663, 0.3);
        for (let i = 0; i < 20; i++) {
            const y = 50 + i * 60;
            lines.lineBetween(0, y, width, y);
        }
        
        // Corner embellishments
        const cornerSize = 150;
        const corners = this.add.graphics();
        corners.lineStyle(2, 0xd4a017, 0.6);
        
        // Top left
        corners.lineBetween(0, cornerSize, 0, 0);
        corners.lineBetween(0, 0, cornerSize, 0);
        
        // Top right
        corners.lineBetween(width - cornerSize, 0, width, 0);
        corners.lineBetween(width, 0, width, cornerSize);
        
        // Bottom left
        corners.lineBetween(0, height - cornerSize, 0, height);
        corners.lineBetween(0, height, cornerSize, height);
        
        // Bottom right
        corners.lineBetween(width - cornerSize, height, width, height);
        corners.lineBetween(width, height - cornerSize, width, height);
    }

    private createTitle(width: number): void {
        // Main title
        this.titleText = this.add.text(width / 2, 180, 'PROJECT IRONWARS', {
            fontFamily: 'Georgia, serif',
            fontSize: '72px',
            color: '#f0dba5',
            fontStyle: 'bold',
            stroke: '#1a1a1a',
            strokeThickness: 4,
            shadow: {
                offsetX: 4,
                offsetY: 4,
                color: '#000000',
                blur: 8,
                fill: true
            }
        }).setOrigin(0.5).setAlpha(0);
        
        // Subtitle
        this.subtitleText = this.add.text(width / 2, 260, 'Nine Commanders - Alpha Build', {
            fontFamily: 'Georgia, serif',
            fontSize: '24px',
            color: '#8a9cc5',
            fontStyle: 'italic'
        }).setOrigin(0.5).setAlpha(0);
    }

    private createMenu(width: number, height: number): void {
        this.menuContainer = this.add.container(width / 2, height / 2 + 80);
        
        const buttonConfigs = [
            { label: 'New Game', callback: () => this.onNewGame() },
            { label: 'Continue', callback: () => this.onContinue(), disabled: !this.saveManager.hasSavedRun() },
            { label: 'Options', callback: () => this.onOptions() },
            { label: 'Exit', callback: () => this.onExit() }
        ];
        
        buttonConfigs.forEach((config, index) => {
            const y = index * (MENU_BUTTON_HEIGHT + MENU_BUTTON_GAP) - 
                      ((buttonConfigs.length - 1) * (MENU_BUTTON_HEIGHT + MENU_BUTTON_GAP)) / 2;
            
            const button = this.createMenuButton(0, y, config.label, config.callback, config.disabled);
            this.menuContainer.add(button);
        });
        
        this.menuContainer.setAlpha(0);
    }

    private createMenuButton(
        x: number, 
        y: number, 
        label: string, 
        callback: () => void,
        disabled = false
    ): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        
        // Button background
        const bg = this.add.graphics();
        const bgColor = disabled ? 0x2a2d3a : 0x3d4663;
        const borderColor = disabled ? 0x4a4d5a : 0xd4a017;
        
        bg.fillStyle(bgColor, 0.9);
        bg.fillRoundedRect(-MENU_BUTTON_WIDTH / 2, -MENU_BUTTON_HEIGHT / 2, 
                           MENU_BUTTON_WIDTH, MENU_BUTTON_HEIGHT, 8);
        bg.lineStyle(2, borderColor, 1);
        bg.strokeRoundedRect(-MENU_BUTTON_WIDTH / 2, -MENU_BUTTON_HEIGHT / 2, 
                             MENU_BUTTON_WIDTH, MENU_BUTTON_HEIGHT, 8);
        container.add(bg);
        
        // Button text
        const text = this.add.text(0, 0, label, {
            fontFamily: 'Georgia, serif',
            fontSize: '28px',
            color: disabled ? '#666666' : '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(text);
        
        // Make interactive if not disabled
        if (!disabled) {
            // Interactive on the background graphics instead of the container
            bg.setInteractive(
                new Phaser.Geom.Rectangle(-MENU_BUTTON_WIDTH / 2, -MENU_BUTTON_HEIGHT / 2, MENU_BUTTON_WIDTH, MENU_BUTTON_HEIGHT),
                Phaser.Geom.Rectangle.Contains
            );
            
            bg.on('pointerover', () => {
                bg.clear();
                bg.fillStyle(0x4d5673, 0.95);
                bg.fillRoundedRect(-MENU_BUTTON_WIDTH / 2, -MENU_BUTTON_HEIGHT / 2, 
                                   MENU_BUTTON_WIDTH, MENU_BUTTON_HEIGHT, 8);
                bg.lineStyle(3, 0xf0dba5, 1);
                bg.strokeRoundedRect(-MENU_BUTTON_WIDTH / 2, -MENU_BUTTON_HEIGHT / 2, 
                                     MENU_BUTTON_WIDTH, MENU_BUTTON_HEIGHT, 8);
                container.setScale(1.05);
            });
            
            bg.on('pointerout', () => {
                bg.clear();
                bg.fillStyle(bgColor, 0.9);
                bg.fillRoundedRect(-MENU_BUTTON_WIDTH / 2, -MENU_BUTTON_HEIGHT / 2, 
                                   MENU_BUTTON_WIDTH, MENU_BUTTON_HEIGHT, 8);
                bg.lineStyle(2, borderColor, 1);
                bg.strokeRoundedRect(-MENU_BUTTON_WIDTH / 2, -MENU_BUTTON_HEIGHT / 2, 
                                     MENU_BUTTON_WIDTH, MENU_BUTTON_HEIGHT, 8);
                container.setScale(1);
            });
            
            bg.on('pointerdown', () => {
                container.setScale(0.95);
            });
            
            bg.on('pointerup', () => {
                container.setScale(1.05);
                callback();
            });
        }
        
        return container;
    }

    private animateTitleEntrance(): void {
        // Title fade in and slide down
        this.tweens.add({
            targets: this.titleText,
            alpha: 1,
            y: 180,
            duration: 800,
            ease: 'Back.easeOut',
            delay: 200
        });
        
        // Subtitle fade in
        this.tweens.add({
            targets: this.subtitleText,
            alpha: 1,
            duration: 600,
            delay: 600
        });
        
        // Menu fade in
        this.tweens.add({
            targets: this.menuContainer,
            alpha: 1,
            duration: 500,
            delay: 900
        });
    }

    private onNewGame(): void {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.time.delayedCall(400, () => {
            this.scene.start('FactionSelectionScene');
        });
    }

    private onContinue(): void {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.time.delayedCall(400, () => {
            this.scene.start('StageMapScene', { loadSavedRun: true });
        });
    }

    private onOptions(): void {
        this.scene.launch('OptionsScene');
        this.scene.pause();
    }

    private onExit(): void {
        // Show exit confirmation or thank you message
        const { width, height } = this.cameras.main;
        
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
        overlay.setDepth(100);
        
        const exitText = this.add.text(width / 2, height / 2, 'Thanks for playing!\n\nClose the browser tab to exit.', {
            fontFamily: 'Georgia, serif',
            fontSize: '32px',
            color: '#f0dba5',
            align: 'center'
        }).setOrigin(0.5).setDepth(101);
        
        // Allow clicking to go back
        overlay.setInteractive();
        overlay.on('pointerdown', () => {
            overlay.destroy();
            exitText.destroy();
        });
    }
}

