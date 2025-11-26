import Phaser from 'phaser';

const SLIDER_WIDTH = 300;
const SLIDER_HEIGHT = 20;

export class OptionsScene extends Phaser.Scene {
    private bgmVolume = 0.7;
    private sfxVolume = 0.8;
    private overlay!: Phaser.GameObjects.Rectangle;
    private panel!: Phaser.GameObjects.Container;

    constructor() {
        super({ key: 'OptionsScene' });
    }

    create(): void {
        const { width, height } = this.cameras.main;
        
        // Semi-transparent overlay
        this.overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
        this.overlay.setInteractive();
        
        // Options panel
        this.panel = this.add.container(width / 2, height / 2);
        
        // Panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x1a1d2e, 0.95);
        panelBg.fillRoundedRect(-250, -200, 500, 400, 16);
        panelBg.lineStyle(2, 0xd4a017, 1);
        panelBg.strokeRoundedRect(-250, -200, 500, 400, 16);
        this.panel.add(panelBg);
        
        // Title
        const title = this.add.text(0, -160, 'OPTIONS', {
            fontFamily: 'Georgia, serif',
            fontSize: '36px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.panel.add(title);
        
        // BGM Volume slider
        this.createVolumeSlider(-80, 'Music Volume', this.bgmVolume, (value) => {
            this.bgmVolume = value;
            this.sound.setVolume(value);
        });
        
        // SFX Volume slider
        this.createVolumeSlider(20, 'Sound Effects', this.sfxVolume, (value) => {
            this.sfxVolume = value;
            // In a real implementation, you'd set SFX volume separately
        });
        
        // Back button
        this.createBackButton();
        
        // Animate in
        this.panel.setScale(0.8);
        this.panel.setAlpha(0);
        this.tweens.add({
            targets: this.panel,
            scale: 1,
            alpha: 1,
            duration: 200,
            ease: 'Back.easeOut'
        });
    }

    private createVolumeSlider(
        y: number, 
        label: string, 
        initialValue: number,
        onChange: (value: number) => void
    ): void {
        // Label
        const labelText = this.add.text(-120, y - 25, label, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#c0c0c0'
        }).setOrigin(0, 0.5);
        this.panel.add(labelText);
        
        // Value display
        const valueText = this.add.text(140, y - 25, `${Math.round(initialValue * 100)}%`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#f0dba5'
        }).setOrigin(1, 0.5);
        this.panel.add(valueText);
        
        // Slider track
        const track = this.add.graphics();
        track.fillStyle(0x2a2d3a, 1);
        track.fillRoundedRect(-SLIDER_WIDTH / 2, y - SLIDER_HEIGHT / 2, SLIDER_WIDTH, SLIDER_HEIGHT, 4);
        this.panel.add(track);
        
        // Slider fill
        const fill = this.add.graphics();
        const fillWidth = initialValue * SLIDER_WIDTH;
        fill.fillStyle(0xd4a017, 1);
        fill.fillRoundedRect(-SLIDER_WIDTH / 2, y - SLIDER_HEIGHT / 2, fillWidth, SLIDER_HEIGHT, 4);
        this.panel.add(fill);
        
        // Slider knob
        const knobX = -SLIDER_WIDTH / 2 + initialValue * SLIDER_WIDTH;
        const knob = this.add.circle(knobX, y, 14, 0xf0dba5);
        knob.setStrokeStyle(2, 0x1a1d2e);
        this.panel.add(knob);
        
        // Make track interactive for clicking
        const hitArea = this.add.rectangle(0, y, SLIDER_WIDTH + 40, SLIDER_HEIGHT + 20, 0x000000, 0);
        hitArea.setInteractive({ useHandCursor: true, draggable: true });
        this.panel.add(hitArea);
        
        const updateSlider = (pointerX: number) => {
            const panelWorldX = this.cameras.main.width / 2;
            const localX = pointerX - panelWorldX;
            const normalized = Phaser.Math.Clamp((localX + SLIDER_WIDTH / 2) / SLIDER_WIDTH, 0, 1);
            
            // Update fill
            fill.clear();
            fill.fillStyle(0xd4a017, 1);
            fill.fillRoundedRect(-SLIDER_WIDTH / 2, y - SLIDER_HEIGHT / 2, normalized * SLIDER_WIDTH, SLIDER_HEIGHT, 4);
            
            // Update knob position
            knob.x = -SLIDER_WIDTH / 2 + normalized * SLIDER_WIDTH;
            
            // Update value text
            valueText.setText(`${Math.round(normalized * 100)}%`);
            
            onChange(normalized);
        };
        
        hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            updateSlider(pointer.x);
        });
        
        hitArea.on('drag', (pointer: Phaser.Input.Pointer, _dragX: number) => {
            updateSlider(pointer.x);
        });
    }

    private createBackButton(): void {
        const backBtn = this.add.container(0, 140);
        
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x3d4663, 0.9);
        btnBg.fillRoundedRect(-80, -25, 160, 50, 8);
        btnBg.lineStyle(2, 0xd4a017, 1);
        btnBg.strokeRoundedRect(-80, -25, 160, 50, 8);
        backBtn.add(btnBg);
        
        const btnText = this.add.text(0, 0, 'Back', {
            fontFamily: 'Georgia, serif',
            fontSize: '24px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        backBtn.add(btnText);
        
        backBtn.setSize(160, 50);
        backBtn.setInteractive({ useHandCursor: true });
        
        backBtn.on('pointerover', () => {
            btnBg.clear();
            btnBg.fillStyle(0x4d5673, 0.95);
            btnBg.fillRoundedRect(-80, -25, 160, 50, 8);
            btnBg.lineStyle(3, 0xf0dba5, 1);
            btnBg.strokeRoundedRect(-80, -25, 160, 50, 8);
        });
        
        backBtn.on('pointerout', () => {
            btnBg.clear();
            btnBg.fillStyle(0x3d4663, 0.9);
            btnBg.fillRoundedRect(-80, -25, 160, 50, 8);
            btnBg.lineStyle(2, 0xd4a017, 1);
            btnBg.strokeRoundedRect(-80, -25, 160, 50, 8);
        });
        
        backBtn.on('pointerup', () => {
            this.closeOptions();
        });
        
        this.panel.add(backBtn);
    }

    private closeOptions(): void {
        this.tweens.add({
            targets: this.panel,
            scale: 0.8,
            alpha: 0,
            duration: 150,
            ease: 'Back.easeIn',
            onComplete: () => {
                this.scene.resume('TitleMenuScene');
                this.scene.stop();
            }
        });
    }
}

