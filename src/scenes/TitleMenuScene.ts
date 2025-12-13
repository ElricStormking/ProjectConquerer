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
        
        // Music
        this.sound.stopAll();
        if (!this.sound.get('bgm_title')) {
            this.sound.play('bgm_title', { loop: true, volume: 0.7 });
        }
        
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
        const key = this.textures.exists('title_bg') ? 'title_bg' : undefined;
        if (key) {
            const bgImage = this.add.image(width / 2, height / 2, key);
            bgImage.setDisplaySize(width, height);
        } else {
            // Fallback gradient if image missing
            const bg = this.add.graphics();
            bg.fillGradientStyle(0x0a0c12, 0x0a0c12, 0x1a1d2e, 0x1a1d2e, 1);
            bg.fillRect(0, 0, width, height);
        }
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
        // Move the buttons down to avoid blocking center artwork
        this.menuContainer = this.add.container(width / 2, height / 2 + 230);
        
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

        // Button background using provided frame art
        const bg = this.add.image(0, 0, 'ui_button_off');
        bg.setDisplaySize(MENU_BUTTON_WIDTH, MENU_BUTTON_HEIGHT);
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
            bg.setInteractive({ useHandCursor: true });
            
            bg.on('pointerover', () => {
                bg.setTexture('ui_button_on');
                container.setScale(1.05);
            });
            
            bg.on('pointerout', () => {
                bg.setTexture('ui_button_off');
                container.setScale(1);
            });
            
            bg.on('pointerdown', () => {
                container.setScale(0.95);
            });
            
            bg.on('pointerup', () => {
                container.setScale(1.05);
                callback();
            });
        } else {
            container.setAlpha(0.6);
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

