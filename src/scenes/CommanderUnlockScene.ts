import Phaser from 'phaser';
import { FactionRegistry } from '../systems/FactionRegistry';
import { ICommanderFullConfig } from '../types/ironwars';

interface CommanderUnlockSceneData {
    commander: ICommanderFullConfig;
    onComplete: () => void;
}

export class CommanderUnlockScene extends Phaser.Scene {
    private readonly factionRegistry = FactionRegistry.getInstance();
    private commander!: ICommanderFullConfig;
    private onComplete!: () => void;

    constructor() {
        super({ key: 'CommanderUnlockScene' });
    }

    init(data: CommanderUnlockSceneData): void {
        this.commander = data.commander;
        this.onComplete = data.onComplete;
    }

    create(): void {
        const { width, height } = this.cameras.main;
        
        // Dark overlay
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);
        
        // Main container
        const container = this.add.container(width / 2, height / 2);
        
        // Glowing background panel
        const panelWidth = 760;
        const panelHeight = 520;
        
        // Glow effect
        const glow = this.add.graphics();
        const factionColor = this.factionRegistry.getFactionColor(this.commander.factionId);
        glow.fillStyle(factionColor, 0.3);
        glow.fillRoundedRect(-panelWidth / 2 - 20, -panelHeight / 2 - 20, panelWidth + 40, panelHeight + 40, 24);
        container.add(glow);
        
        // Main panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1a1d2e, 0.98);
        panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
        panel.lineStyle(3, factionColor, 1);
        panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
        container.add(panel);
        
        // "NEW COMMANDER" title with animation
        const title = this.add.text(0, -210, 'NEW COMMANDER UNLOCKED!', {
            fontFamily: 'Georgia, serif',
            fontSize: '36px',
            color: '#f0dba5',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        container.add(title);
        
        // Pulsing animation on title
        this.tweens.add({
            targets: title,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        const portraitFrame = this.add.graphics();
        portraitFrame.fillStyle(0x0f1220, 0.92);
        portraitFrame.fillRoundedRect(-315, -160, 250, 330, 12);
        portraitFrame.lineStyle(3, factionColor, 0.95);
        portraitFrame.strokeRoundedRect(-315, -160, 250, 330, 12);
        portraitFrame.lineStyle(1, 0xf0dba5, 0.55);
        portraitFrame.strokeRoundedRect(-303, -148, 226, 306, 8);
        container.add(portraitFrame);

        this.addCommanderPortrait(container, -190, 5, 218, 298, factionColor);

        const divider = this.add.graphics();
        divider.lineStyle(2, factionColor, 0.38);
        divider.lineBetween(-30, -150, -30, 165);
        divider.lineStyle(1, 0xf0dba5, 0.18);
        divider.lineBetween(-20, -140, -20, 155);
        container.add(divider);
        
        // Commander name
        const commanderName = this.add.text(160, -105, this.commander.name, {
            fontFamily: 'Georgia, serif',
            fontSize: '30px',
            color: '#ffffff',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: 390 }
        }).setOrigin(0.5);
        container.add(commanderName);
        
        // Faction name
        const faction = this.factionRegistry.getFaction(this.commander.factionId);
        const factionName = this.add.text(160, -55, faction?.name ?? this.commander.factionId, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#8a9cc5',
            fontStyle: 'italic'
        }).setOrigin(0.5);
        container.add(factionName);
        
        // Skill info
        const skillPanel = this.add.graphics();
        skillPanel.fillStyle(0x101625, 0.75);
        skillPanel.fillRoundedRect(0, -12, 320, 104, 8);
        skillPanel.lineStyle(1, factionColor, 0.45);
        skillPanel.strokeRoundedRect(0, -12, 320, 104, 8);
        container.add(skillPanel);

        const skillLabel = this.add.text(160, 10, 'ACTIVE SKILL', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#8a9cc5',
            letterSpacing: 1
        }).setOrigin(0.5);
        container.add(skillLabel);
        
        const skillName = this.add.text(160, 40, this.formatSkillName(this.commander.activeSkillId), {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: '#f0dba5',
            align: 'center',
            wordWrap: { width: 290 }
        }).setOrigin(0.5);
        container.add(skillName);
        
        // Cards unlocked info
        const cardsLabel = this.add.text(160, 118, `+${this.commander.cardIds.length} new cards now available!`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            color: '#2ecc71'
        }).setOrigin(0.5);
        container.add(cardsLabel);
        
        // Continue button
        const continueBtn = this.add.container(160, 210);
        
        const btnBg = this.add.graphics();
        btnBg.fillStyle(factionColor, 1);
        btnBg.fillRoundedRect(-100, -25, 200, 50, 10);
        continueBtn.add(btnBg);
        
        const btnText = this.add.text(0, 0, 'CONTINUE', {
            fontFamily: 'Georgia, serif',
            fontSize: '22px',
            color: '#1a1a1a',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        continueBtn.add(btnText);
        
        // Interactive on the button background instead of the container
        btnBg.setInteractive(
            new Phaser.Geom.Rectangle(-100, -25, 200, 50),
            Phaser.Geom.Rectangle.Contains
        );
        
        btnBg.on('pointerover', () => {
            continueBtn.setScale(1.08);
            btnBg.clear();
            btnBg.fillStyle(0xf0dba5, 1);
            btnBg.fillRoundedRect(-100, -25, 200, 50, 10);
        });
        
        btnBg.on('pointerout', () => {
            continueBtn.setScale(1);
            btnBg.clear();
            btnBg.fillStyle(factionColor, 1);
            btnBg.fillRoundedRect(-100, -25, 200, 50, 10);
        });
        
        btnBg.on('pointerup', () => {
            this.scene.stop();
            this.onComplete();
        });
        
        container.add(continueBtn);
        
        // Entrance animation
        container.setScale(0.5);
        container.setAlpha(0);
        this.tweens.add({
            targets: container,
            scale: 1,
            alpha: 1,
            duration: 500,
            ease: 'Back.easeOut'
        });
        
        // Particle effects
        this.createParticleEffects(factionColor);
    }

    private addCommanderPortrait(
        container: Phaser.GameObjects.Container,
        x: number,
        y: number,
        maxWidth: number,
        maxHeight: number,
        factionColor: number
    ): void {
        const portraitKey = this.commander.portraitKey;
        if (portraitKey && this.textures.exists(portraitKey)) {
            const portrait = this.add.image(x, y, portraitKey).setOrigin(0.5);
            const scale = Math.min(maxWidth / portrait.width, maxHeight / portrait.height);
            portrait.setScale(scale);
            container.add(portrait);
            return;
        }

        const fallback = this.add.rectangle(x, y, maxWidth, maxHeight, factionColor, 0.35);
        fallback.setStrokeStyle(3, factionColor);
        container.add(fallback);

        const fallbackText = this.add.text(x, y, 'CMD', {
            fontFamily: 'Georgia, serif',
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(fallbackText);
    }

    private formatSkillName(skillId?: string): string {
        if (!skillId) {
            return 'Command Protocol';
        }

        return skillId
            .split('_')
            .filter(Boolean)
            .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
            .join(' ');
    }

    private createParticleEffects(color: number): void {
        const { width, height } = this.cameras.main;
        
        // Simple particle simulation using graphics
        for (let i = 0; i < 20; i++) {
            const startX = Phaser.Math.Between(0, width);
            const startY = height + 50;
            
            const particle = this.add.circle(startX, startY, Phaser.Math.Between(3, 8), color, 0.7);
            
            this.tweens.add({
                targets: particle,
                y: Phaser.Math.Between(-50, height / 2),
                x: startX + Phaser.Math.Between(-100, 100),
                alpha: 0,
                scale: 0,
                duration: Phaser.Math.Between(2000, 4000),
                delay: Phaser.Math.Between(0, 1000),
                ease: 'Cubic.easeOut',
                onComplete: () => particle.destroy()
            });
        }
    }
}

