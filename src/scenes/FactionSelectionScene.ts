import Phaser from 'phaser';
import { FactionRegistry } from '../systems/FactionRegistry';
import { CommanderManager } from '../systems/CommanderManager';
import { IFactionConfig, ICommanderFullConfig } from '../types/ironwars';

const CARD_WIDTH = 1920;
const CARD_SPACING = 50;

export class FactionSelectionScene extends Phaser.Scene {
    private readonly factionRegistry = FactionRegistry.getInstance();
    private readonly commanderManager = CommanderManager.getInstance();
    
    private factions: IFactionConfig[] = [];
    private currentIndex = 0;
    private carouselContainer!: Phaser.GameObjects.Container;
    private factionPanels: Phaser.GameObjects.Container[] = [];
    private leftArrow!: Phaser.GameObjects.Container;
    private rightArrow!: Phaser.GameObjects.Container;
    private selectButton!: Phaser.GameObjects.Container;
    private isAnimating = false;

    constructor() {
        super({ key: 'FactionSelectionScene' });
    }

    create(): void {
        const { width, height } = this.cameras.main;
        
        this.factions = this.factionRegistry.getAllFactions();
        if (this.factions.length === 0) {
            // Fallback if no factions loaded
            console.warn('[FactionSelectionScene] No factions loaded, using default');
            this.factions = [{
                id: 'cog_dominion',
                name: 'Cog Dominion',
                resourceType: 'profit' as any,
                fortressId: 'iron_citadel',
                startingCommanderId: 'commander_valen',
                emblemKey: 'emblem_cog',
                description: 'Masters of steam and steel'
            }];
        }
        
        this.createBackground(width, height);
        this.createTitle(width);
        this.createCarousel(width, height);
        this.createNavigationArrows(width, height);
        this.createSelectButton(width, height);
        this.createBackButton();
        
        this.cameras.main.fadeIn(400, 0, 0, 0);
        this.updateArrowStates();
    }

    private createBackground(width: number, height: number): void {
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0a0c12, 0x0a0c12, 0x1a1d2e, 0x1a1d2e, 1);
        bg.fillRect(0, 0, width, height);
        
        // Subtle pattern
        const pattern = this.add.graphics();
        pattern.lineStyle(1, 0x3d4663, 0.15);
        for (let i = 0; i < 30; i++) {
            pattern.lineBetween(0, i * 40, width, i * 40);
        }
    }

    private createTitle(width: number): void {
        this.add.text(width / 2, 60, 'CHOOSE YOUR FACTION', {
            fontFamily: 'Georgia, serif',
            fontSize: '48px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        this.add.text(width / 2, 110, 'Select a faction to lead into battle', {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: '#8a9cc5',
            fontStyle: 'italic'
        }).setOrigin(0.5);
    }

    private createCarousel(width: number, height: number): void {
        this.carouselContainer = this.add.container(width / 2, height / 2 - 20);
        
        this.factions.forEach((faction, index) => {
            const panel = this.createFactionPanel(faction, index);
            panel.x = index * (CARD_WIDTH + CARD_SPACING);
            this.factionPanels.push(panel);
            this.carouselContainer.add(panel);
        });
        
        // Start centered on first faction
        this.updateCarouselPosition(false);
    }

    private createFactionPanel(faction: IFactionConfig, _index: number): Phaser.GameObjects.Container {
        const panel = this.add.container(0, 0);
        const panelWidth = 800;
        const panelHeight = 550;
        
        // Panel background
        const bg = this.add.graphics();
        const factionColor = this.factionRegistry.getFactionColor(faction.id);
        bg.fillStyle(0x1a1d2e, 0.95);
        bg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
        bg.lineStyle(3, factionColor, 1);
        bg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
        panel.add(bg);
        
        // Faction emblem placeholder (colored circle)
        const emblem = this.add.circle(-280, -180, 50, factionColor, 1);
        emblem.setStrokeStyle(3, 0xffffff, 0.3);
        panel.add(emblem);
        
        // Faction name
        const nameText = this.add.text(-200, -200, faction.name.toUpperCase(), {
            fontFamily: 'Georgia, serif',
            fontSize: '36px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0, 0);
        panel.add(nameText);
        
        // Description
        const descText = this.add.text(-200, -150, faction.description || 'No description available', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#c0c0c0',
            wordWrap: { width: 500 }
        }).setOrigin(0, 0);
        panel.add(descText);
        
        // Divider line
        const divider = this.add.graphics();
        divider.lineStyle(2, factionColor, 0.5);
        divider.lineBetween(-panelWidth / 2 + 40, -80, panelWidth / 2 - 40, -80);
        panel.add(divider);
        
        // Commander section
        const commander = this.commanderManager.getStarterCommander(faction.id);
        if (commander) {
            this.addCommanderSection(panel, commander, factionColor);
        }
        
        // Cards preview section
        this.addCardsPreview(panel, faction.id, factionColor);
        
        // Fortress preview
        this.addFortressPreview(panel, faction.id, factionColor);
        
        return panel;
    }

    private addCommanderSection(
        panel: Phaser.GameObjects.Container, 
        commander: ICommanderFullConfig,
        factionColor: number
    ): void {
        // Commander portrait placeholder
        const portrait = this.add.rectangle(-280, 20, 100, 120, factionColor, 0.3);
        portrait.setStrokeStyle(2, factionColor);
        panel.add(portrait);
        
        const portraitLabel = this.add.text(-280, 20, 'CMD', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        panel.add(portraitLabel);
        
        // Commander name
        const cmdNameText = this.add.text(-200, -40, 'Starting Commander:', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#8a9cc5'
        }).setOrigin(0, 0);
        panel.add(cmdNameText);
        
        const cmdName = this.add.text(-200, -15, commander.name, {
            fontFamily: 'Georgia, serif',
            fontSize: '24px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0, 0);
        panel.add(cmdName);
        
        // Active skill
        const skillLabel = this.add.text(-200, 25, 'Active Skill:', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#8a9cc5'
        }).setOrigin(0, 0);
        panel.add(skillLabel);
        
        const skillName = this.add.text(-200, 48, commander.activeSkillId.replace(/_/g, ' ').toUpperCase(), {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#c0c0c0'
        }).setOrigin(0, 0);
        panel.add(skillName);
    }

    private addCardsPreview(
        panel: Phaser.GameObjects.Container, 
        factionId: string,
        factionColor: number
    ): void {
        const starterCommander = this.commanderManager.getStarterCommander(factionId);
        const cards = starterCommander ? 
            this.commanderManager.getCardsForCommander(starterCommander.id).slice(0, 3) : [];
        
        const startX = 100;
        const cardWidth = 80;
        const cardHeight = 110;
        const gap = 20;
        
        // Section label
        const label = this.add.text(startX + 60, -40, 'Sample Cards:', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#8a9cc5'
        }).setOrigin(0, 0);
        panel.add(label);
        
        cards.forEach((card, i) => {
            const x = startX + i * (cardWidth + gap);
            const y = 40;
            
            // Card background
            const cardBg = this.add.graphics();
            cardBg.fillStyle(0x2a2d3a, 1);
            cardBg.fillRoundedRect(x, y - cardHeight / 2, cardWidth, cardHeight, 6);
            cardBg.lineStyle(2, factionColor, 0.8);
            cardBg.strokeRoundedRect(x, y - cardHeight / 2, cardWidth, cardHeight, 6);
            panel.add(cardBg);
            
            // Card cost
            const costCircle = this.add.circle(x + 15, y - cardHeight / 2 + 15, 12, 0x3d4663);
            costCircle.setStrokeStyle(1, factionColor);
            panel.add(costCircle);
            
            const costText = this.add.text(x + 15, y - cardHeight / 2 + 15, String(card.cost), {
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
                color: '#f0dba5',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            panel.add(costText);
            
            // Card name (truncated)
            const cardName = card.name.length > 10 ? card.name.slice(0, 9) + '...' : card.name;
            const nameText = this.add.text(x + cardWidth / 2, y + 30, cardName, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '11px',
                color: '#c0c0c0',
                align: 'center'
            }).setOrigin(0.5);
            panel.add(nameText);
        });
    }

    private addFortressPreview(
        panel: Phaser.GameObjects.Container, 
        factionId: string,
        factionColor: number
    ): void {
        const fortress = this.factionRegistry.getFortressForFaction(factionId);
        if (!fortress) return;
        
        const startX = -350;
        const startY = 160;
        const cellSize = 28;
        const isoRatio = 0.5;
        
        // Section label
        const label = this.add.text(startX, startY - 30, 'Mobile Fortress:', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#8a9cc5'
        }).setOrigin(0, 0);
        panel.add(label);
        
        // Draw isometric grid preview
        const gridGraphics = this.add.graphics();
        
        for (let y = 0; y < fortress.gridHeight; y++) {
            for (let x = 0; x < fortress.gridWidth; x++) {
                const cell = fortress.cells.find(c => c.x === x && c.y === y);
                const isoX = startX + 100 + (x - y) * (cellSize * 0.8);
                const isoY = startY + 40 + (x + y) * (cellSize * isoRatio);
                
                let fillColor = 0x3d4663;
                let alpha = 0.6;
                
                if (cell?.type === 'core') {
                    fillColor = factionColor;
                    alpha = 1;
                } else if (cell?.type === 'blocked') {
                    fillColor = 0x1a1a1a;
                    alpha = 0.3;
                }
                
                // Draw diamond
                gridGraphics.fillStyle(fillColor, alpha);
                gridGraphics.beginPath();
                gridGraphics.moveTo(isoX, isoY - cellSize * isoRatio);
                gridGraphics.lineTo(isoX + cellSize * 0.8, isoY);
                gridGraphics.lineTo(isoX, isoY + cellSize * isoRatio);
                gridGraphics.lineTo(isoX - cellSize * 0.8, isoY);
                gridGraphics.closePath();
                gridGraphics.fillPath();
                
                gridGraphics.lineStyle(1, 0xffffff, 0.3);
                gridGraphics.strokePath();
            }
        }
        panel.add(gridGraphics);
        
        // Fortress name and HP
        const fortressName = this.add.text(startX + 200, startY - 5, fortress.name, {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#f0dba5'
        }).setOrigin(0, 0);
        panel.add(fortressName);
        
        const fortressHp = this.add.text(startX + 200, startY + 20, `HP: ${fortress.maxHp}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#c0c0c0'
        }).setOrigin(0, 0);
        panel.add(fortressHp);
    }

    private createNavigationArrows(width: number, height: number): void {
        // Left arrow
        this.leftArrow = this.createArrow(150, height / 2, true);
        
        // Right arrow
        this.rightArrow = this.createArrow(width - 150, height / 2, false);
    }

    private createArrow(x: number, y: number, isLeft: boolean): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        
        const bg = this.add.circle(0, 0, 40, 0x3d4663, 0.9);
        bg.setStrokeStyle(2, 0xd4a017);
        container.add(bg);
        
        const arrow = this.add.text(0, 0, isLeft ? '◀' : '▶', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '28px',
            color: '#f0dba5'
        }).setOrigin(0.5);
        container.add(arrow);
        
        container.setSize(80, 80);
        container.setInteractive({ useHandCursor: true });
        
        container.on('pointerover', () => {
            bg.setFillStyle(0x4d5673, 1);
            container.setScale(1.1);
        });
        
        container.on('pointerout', () => {
            bg.setFillStyle(0x3d4663, 0.9);
            container.setScale(1);
        });
        
        container.on('pointerup', () => {
            if (this.isAnimating) return;
            if (isLeft) {
                this.navigateFaction(-1);
            } else {
                this.navigateFaction(1);
            }
        });
        
        return container;
    }

    private navigateFaction(direction: number): void {
        const newIndex = this.currentIndex + direction;
        if (newIndex < 0 || newIndex >= this.factions.length) return;
        
        this.currentIndex = newIndex;
        this.updateCarouselPosition(true);
        this.updateArrowStates();
    }

    private updateCarouselPosition(animate: boolean): void {
        const targetX = -this.currentIndex * (CARD_WIDTH + CARD_SPACING);
        
        if (animate) {
            this.isAnimating = true;
            this.tweens.add({
                targets: this.carouselContainer,
                x: this.cameras.main.width / 2 + targetX,
                duration: 400,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    this.isAnimating = false;
                }
            });
        } else {
            this.carouselContainer.x = this.cameras.main.width / 2 + targetX;
        }
        
        // Update panel scales for focus effect
        this.factionPanels.forEach((panel, index) => {
            const targetScale = index === this.currentIndex ? 1 : 0.85;
            const targetAlpha = index === this.currentIndex ? 1 : 0.5;
            
            if (animate) {
                this.tweens.add({
                    targets: panel,
                    scaleX: targetScale,
                    scaleY: targetScale,
                    alpha: targetAlpha,
                    duration: 300
                });
            } else {
                panel.setScale(targetScale);
                panel.setAlpha(targetAlpha);
            }
        });
    }

    private updateArrowStates(): void {
        this.leftArrow.setAlpha(this.currentIndex > 0 ? 1 : 0.3);
        this.leftArrow.setVisible(this.currentIndex > 0);
        
        this.rightArrow.setAlpha(this.currentIndex < this.factions.length - 1 ? 1 : 0.3);
        this.rightArrow.setVisible(this.currentIndex < this.factions.length - 1);
    }

    private createSelectButton(width: number, height: number): void {
        this.selectButton = this.add.container(width / 2, height - 80);
        
        const bg = this.add.graphics();
        bg.fillStyle(0xd4a017, 1);
        bg.fillRoundedRect(-120, -30, 240, 60, 10);
        this.selectButton.add(bg);
        
        const text = this.add.text(0, 0, 'SELECT FACTION', {
            fontFamily: 'Georgia, serif',
            fontSize: '24px',
            color: '#1a1a1a',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.selectButton.add(text);
        
        this.selectButton.setSize(240, 60);
        this.selectButton.setInteractive({ useHandCursor: true });
        
        this.selectButton.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0xf0dba5, 1);
            bg.fillRoundedRect(-120, -30, 240, 60, 10);
            this.selectButton.setScale(1.05);
        });
        
        this.selectButton.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0xd4a017, 1);
            bg.fillRoundedRect(-120, -30, 240, 60, 10);
            this.selectButton.setScale(1);
        });
        
        this.selectButton.on('pointerup', () => {
            this.selectFaction();
        });
    }

    private createBackButton(): void {
        const backBtn = this.add.container(100, 60);
        
        const bg = this.add.graphics();
        bg.fillStyle(0x3d4663, 0.8);
        bg.fillRoundedRect(-60, -20, 120, 40, 6);
        backBtn.add(bg);
        
        const text = this.add.text(0, 0, '← Back', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#c0c0c0'
        }).setOrigin(0.5);
        backBtn.add(text);
        
        backBtn.setSize(120, 40);
        backBtn.setInteractive({ useHandCursor: true });
        
        backBtn.on('pointerover', () => {
            text.setColor('#f0dba5');
            backBtn.setScale(1.05);
        });
        
        backBtn.on('pointerout', () => {
            text.setColor('#c0c0c0');
            backBtn.setScale(1);
        });
        
        backBtn.on('pointerup', () => {
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.time.delayedCall(300, () => {
                this.scene.start('TitleMenuScene');
            });
        });
    }

    private selectFaction(): void {
        const selectedFaction = this.factions[this.currentIndex];
        
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.time.delayedCall(400, () => {
            this.scene.start('DeckBuildingScene', { 
                factionId: selectedFaction.id,
                isNewRun: true
            });
        });
    }
}

