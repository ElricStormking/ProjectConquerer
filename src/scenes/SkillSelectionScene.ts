import Phaser from 'phaser';
import { Skill } from '../data/Skills';

export class SkillSelectionScene extends Phaser.Scene {
    private skillChoices: Skill[] = [];
    private container!: Phaser.GameObjects.Container;
    private background!: Phaser.GameObjects.Graphics;
    
    constructor() {
        super({ key: 'SkillSelectionScene' });
    }
    
    create() {
        // Create semi-transparent background
        this.background = this.add.graphics();
        this.background.fillStyle(0x000000, 0.8);
        this.background.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        
        // Create container for skill selection UI
        this.container = this.add.container(this.cameras.main.centerX, this.cameras.main.centerY);
        
        // Initially hidden
        this.setVisible(false);
    }
    
    public showSkillSelection(choices: Skill[], playerLevel: number): void {
        this.skillChoices = choices;
        this.setVisible(true);
        
        // Clear previous UI
        this.container.removeAll(true);
        
        // Title
        const title = this.add.text(0, -200, `LEVEL ${playerLevel}!`, {
            font: 'bold 48px sans-serif',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        const subtitle = this.add.text(0, -150, 'Choose your upgrade:', {
            font: 'bold 24px sans-serif',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        this.container.add([title, subtitle]);
        
        // Create skill choice cards
        const cardWidth = 300;
        const cardHeight = 400;
        const cardSpacing = 50;
        const totalWidth = (cardWidth * choices.length) + (cardSpacing * (choices.length - 1));
        const startX = -totalWidth / 2 + cardWidth / 2;
        
        choices.forEach((skill, index) => {
            const cardX = startX + index * (cardWidth + cardSpacing);
            this.createSkillCard(skill, cardX, 0, cardWidth, cardHeight, index);
        });
        
        // Add timer
        let timeLeft = 10;
        const timerText = this.add.text(0, 250, `Auto-select in: ${timeLeft}s`, {
            font: 'bold 20px sans-serif',
            color: '#ff8888'
        }).setOrigin(0.5);
        
        this.container.add(timerText);
        
        // Countdown timer
        const timer = this.time.addEvent({
            delay: 1000,
            repeat: timeLeft - 1,
            callback: () => {
                timeLeft--;
                timerText.setText(`Auto-select in: ${timeLeft}s`);
                
                if (timeLeft <= 0) {
                    // Auto-select first skill
                    this.selectSkill(0);
                }
            }
        });
        
        // Store timer reference to clear it if skill is selected manually
        (this.container as any).timer = timer;
    }
    
    private createSkillCard(skill: Skill, x: number, y: number, width: number, height: number, index: number): void {
        // Card background
        const cardBg = this.add.graphics();
        const rarityColors = {
            common: 0x888888,
            rare: 0x0088ff,
            epic: 0x8800ff,
            legendary: 0xff8800
        };
        
        cardBg.fillStyle(rarityColors[skill.rarity], 0.9);
        cardBg.fillRoundedRect(-width/2, -height/2, width, height, 10);
        cardBg.lineStyle(3, rarityColors[skill.rarity], 1);
        cardBg.strokeRoundedRect(-width/2, -height/2, width, height, 10);
        cardBg.x = x;
        cardBg.y = y;
        
        // Make interactive
        cardBg.setInteractive(
            new Phaser.Geom.Rectangle(-width/2, -height/2, width, height),
            Phaser.Geom.Rectangle.Contains
        );
        
        // Hover effects
        cardBg.on('pointerover', () => {
            cardBg.setScale(1.05);
            this.tweens.add({
                targets: cardBg,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100
            });
        });
        
        cardBg.on('pointerout', () => {
            this.tweens.add({
                targets: cardBg,
                scaleX: 1,
                scaleY: 1,
                duration: 100
            });
        });
        
        cardBg.on('pointerdown', () => {
            this.selectSkill(index);
        });
        
        // Skill icon
        const icon = this.add.text(x, y - 120, skill.icon, {
            font: 'bold 64px sans-serif'
        }).setOrigin(0.5);
        
        // Skill name
        const name = this.add.text(x, y - 60, skill.name, {
            font: 'bold 24px sans-serif',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: width - 20 }
        }).setOrigin(0.5);
        
        // Rank indicator
        const rankText = skill.currentRank > 1 ? 
            `Rank ${skill.currentRank - 1} → ${skill.currentRank}` : 
            `NEW!`;
            
        const rank = this.add.text(x, y - 20, rankText, {
            font: 'bold 18px sans-serif',
            color: skill.currentRank > 1 ? '#88ff88' : '#ffff88'
        }).setOrigin(0.5);
        
        // Skill description
        const description = this.add.text(x, y + 40, skill.description, {
            font: '16px sans-serif',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: width - 40 }
        }).setOrigin(0.5);
        
        // Effects description
        let effectsText = '';
        skill.effects.forEach(effect => {
            const value = effect.baseValue + (effect.perRank * (skill.currentRank - 1));
            const suffix = effect.isMultiplier ? '%' : '';
            effectsText += `+${value}${suffix} ${effect.stat}\n`;
        });
        
        const effects = this.add.text(x, y + 120, effectsText.trim(), {
            font: 'bold 14px sans-serif',
            color: '#88ff88',
            align: 'center'
        }).setOrigin(0.5);
        
        // Hotkey indicator
        const hotkey = this.add.text(x, y + 160, `Press ${index + 1}`, {
            font: '12px sans-serif',
            color: '#cccccc'
        }).setOrigin(0.5);
        
        this.container.add([cardBg, icon, name, rank, description, effects, hotkey]);
        
        // Add keyboard input
        this.input.keyboard?.on(`keydown-${index + 1}`, () => {
            this.selectSkill(index);
        });
    }
    
    private selectSkill(index: number): void {
        if (index >= 0 && index < this.skillChoices.length) {
            const selectedSkill = this.skillChoices[index];
            
            // Clear timer
            const timer = (this.container as any).timer;
            if (timer) {
                timer.destroy();
            }
            
            // Visual feedback
            this.cameras.main.flash(200, 255, 255, 0);
            
            // Emit skill selection event
            this.events.emit('skill-selected', selectedSkill);
            
            // Hide UI
            this.setVisible(false);
        }
    }
}