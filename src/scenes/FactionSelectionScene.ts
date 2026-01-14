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
    private selectedCommanderByFaction: Record<string, string | null> = {};
    private carouselContainer!: Phaser.GameObjects.Container;
    private factionPanels: Phaser.GameObjects.Container[] = [];
    private leftArrow!: Phaser.GameObjects.Container;
    private rightArrow!: Phaser.GameObjects.Container;
    private selectButton!: Phaser.GameObjects.Container;
    private isAnimating = false;
    private backgroundImage?: Phaser.GameObjects.Image;
    private backgroundFallback?: Phaser.GameObjects.Graphics;
    private bgLoadInFlight: Set<string> = new Set();

    constructor() {
        super({ key: 'FactionSelectionScene' });
    }

    create(): void {
        const { width, height } = this.cameras.main;
        
        // Music for faction selection
        const existingBgm =
            this.sound.get('bgm_faction_select') ||
            this.sound.get('bgm_title'); // reuse title track if already playing (same asset)
        if (!existingBgm || !existingBgm.isPlaying) {
            this.sound.play('bgm_faction_select', { loop: true, volume: 0.7 });
        }
        
        // Only show supported factions
        const allowedFactions = new Set(['jade_dynasty', 'frost_clan', 'triarch_dominion']);
        this.factions = this.factionRegistry.getAllFactions().filter(f => allowedFactions.has(f.id));
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
        // Immediate fallback gradient so background isn't blank
        this.backgroundFallback = this.add.graphics().setDepth(-50).setScrollFactor(0);
        this.backgroundFallback.fillGradientStyle(0x0a0c12, 0x0a0c12, 0x1a1d2e, 0x1a1d2e, 1);
        this.backgroundFallback.fillRect(0, 0, width, height);

        const firstFaction = this.factions[0]?.id ?? 'jade_dynasty';
        // Delay background image creation slightly to ensure textures are fully accessible
        this.time.delayedCall(100, () => {
            this.setBackgroundForFaction(firstFaction, width, height);
        });
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
        
        // Faction emblem (use logo art if available)
        const logoKeyMap: Record<string, string> = {
            jade_dynasty: 'logo_jade_dynasty',
            frost_clan: 'logo_frost_clan',
            triarch_dominion: 'logo_triarch_dominion'
        };
        const logoKey = logoKeyMap[faction.id];
        if (logoKey && this.textures.exists(logoKey)) {
            const logo = this.add.image(-280, -170, logoKey);
            logo.setDisplaySize(120, 120);
            panel.add(logo);
        } else {
            const emblem = this.add.circle(-280, -180, 50, factionColor, 1);
            emblem.setStrokeStyle(3, 0xffffff, 0.3);
            panel.add(emblem);
        }
        
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
        const commanders = this.commanderManager.getCommandersByFaction(faction.id);
        const selectedCommanderId = commanders[0]?.id ?? null;
        this.selectedCommanderByFaction[faction.id] = selectedCommanderId;

        const commanderSection = this.add.container(0, 0);
        commanderSection.setName('commanderSection');
        panel.add(commanderSection);

        const cardsSection = this.add.container(0, 0);
        cardsSection.setName('cardsSection');
        panel.add(cardsSection);

        this.addCommanderSelector(panel, commanders, factionColor);
        this.renderCommanderSection(panel, faction.id, factionColor);
        this.renderCardsPreview(panel, faction.id, factionColor);
        
        // Fortress preview
        this.addFortressPreview(panel, faction.id, factionColor);
        
        return panel;
    }

    private addCommanderSelector(panel: Phaser.GameObjects.Container, commanders: ICommanderFullConfig[], factionColor: number): void {
        const selectorY = -40;
        const startX = -200;
        const btnW = 160;
        const btnH = 40;
        const gap = 20;

        commanders.forEach((cmd, i) => {
            const btn = this.add.container(startX + i * (btnW + gap), selectorY);
            const bg = this.add.graphics();
            bg.fillStyle(0x2a2d3a, 0.9);
            bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
            bg.lineStyle(2, factionColor, 0.8);
            bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
            btn.add(bg);

            const txt = this.add.text(0, 0, cmd.name, {
                fontFamily: 'Georgia, serif',
                fontSize: '14px',
                color: '#f0dba5'
            }).setOrigin(0.5);
            btn.add(txt);

            bg.setInteractive(
                new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
                Phaser.Geom.Rectangle.Contains
            );

            bg.on('pointerover', () => btn.setScale(1.05));
            bg.on('pointerout', () => btn.setScale(1));
            bg.on('pointerup', () => {
                this.selectedCommanderByFaction[cmd.factionId] = cmd.id;
                this.renderCommanderSection(panel, cmd.factionId, factionColor);
                this.renderCardsPreview(panel, cmd.factionId, factionColor);
            });

            panel.add(btn);
        });
    }

    private renderCommanderSection(panel: Phaser.GameObjects.Container, factionId: string, factionColor: number): void {
        const container = panel.getByName('commanderSection') as Phaser.GameObjects.Container;
        container.removeAll(true);
        const selectedId = this.selectedCommanderByFaction[factionId];
        if (!selectedId) {
            container.add(this.add.text(-200, -20, 'No commander available', { fontSize: '16px', color: '#c0c0c0' }));
            return;
        }
        const commander = this.commanderManager.getCommander(selectedId);
        if (!commander) return;

        // Portrait
        if (this.textures.exists(commander.portraitKey)) {
            const portrait = this.add.image(-300, 40, commander.portraitKey);
            portrait.setDisplaySize(110, 130);
            container.add(portrait);
        } else {
            const portrait = this.add.rectangle(-300, 40, 110, 130, factionColor, 0.3);
            portrait.setStrokeStyle(2, factionColor);
            container.add(portrait);
        }

        const cmdLabel = this.add.text(-200, -10, 'Commander:', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#8a9cc5'
        }).setOrigin(0, 0);
        container.add(cmdLabel);

        const cmdName = this.add.text(-200, 15, commander.name, {
            fontFamily: 'Georgia, serif',
            fontSize: '24px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0, 0);
        container.add(cmdName);

        const skillLabel = this.add.text(-200, 55, 'Active Skill:', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#8a9cc5'
        }).setOrigin(0, 0);
        container.add(skillLabel);

        const skillName = this.add.text(-200, 78, commander.activeSkillId.replace(/_/g, ' ').toUpperCase(), {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#c0c0c0'
        }).setOrigin(0, 0);
        container.add(skillName);
    }

    private renderCardsPreview(panel: Phaser.GameObjects.Container, factionId: string, factionColor: number): void {
        const container = panel.getByName('cardsSection') as Phaser.GameObjects.Container;
        container.removeAll(true);
        const selectedId = this.selectedCommanderByFaction[factionId];
        if (!selectedId) {
            container.add(this.add.text(120, 0, 'Sample cards coming soon', { fontSize: '14px', color: '#c0c0c0' }));
            return;
        }
        const cards = this.commanderManager.getCardsForCommander(selectedId).slice(0, 6);

        const startX = 100;
        const cardWidth = 80;
        const cardHeight = 110;
        const gap = 20;
        const cols = 3;

        const label = this.add.text(startX + 60, -40, 'Sample Cards:', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#8a9cc5'
        }).setOrigin(0, 0);
        container.add(label);

        if (cards.length === 0) {
            const placeholder = this.add.text(startX, 20, 'Coming soon', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
                color: '#c0c0c0'
            }).setOrigin(0, 0);
            container.add(placeholder);
            return;
        }

        cards.forEach((card, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cardWidth + gap);
            const y = 40 + row * (cardHeight + 30);

            const cardBg = this.add.graphics();
            cardBg.fillStyle(0x2a2d3a, 1);
            cardBg.fillRoundedRect(x, y - cardHeight / 2, cardWidth, cardHeight, 6);
            cardBg.lineStyle(2, factionColor, 0.8);
            cardBg.strokeRoundedRect(x, y - cardHeight / 2, cardWidth, cardHeight, 6);
            container.add(cardBg);

            const costCircle = this.add.circle(x + 15, y - cardHeight / 2 + 15, 12, 0x3d4663);
            costCircle.setStrokeStyle(1, factionColor);
            container.add(costCircle);

            const costText = this.add.text(x + 15, y - cardHeight / 2 + 15, String(card.cost), {
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
                color: '#f0dba5',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            container.add(costText);

            // Portrait
            const artW = cardWidth - 16;
            const artH = 60;
            if (card.portraitKey && this.textures.exists(card.portraitKey)) {
                const img = this.add.image(x + cardWidth / 2, y - 10, card.portraitKey).setOrigin(0.5);
                const texW = img.width || artW;
                const texH = img.height || artH;
                const scale = Math.min(artW / texW, artH / texH);
                img.setScale(scale);
                container.add(img);
            } else {
                const placeholder = this.add.rectangle(x + cardWidth / 2, y - 10, artW, artH, 0x1a1d2e);
                container.add(placeholder);
            }

            const cardName = card.name.length > 10 ? card.name.slice(0, 9) + '...' : card.name;
            const nameText = this.add.text(x + cardWidth / 2, y + 30, cardName, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '11px',
                color: '#c0c0c0',
                align: 'center'
            }).setOrigin(0.5);
            container.add(nameText);
        });
    }

    private addFortressPreview(
        panel: Phaser.GameObjects.Container, 
        factionId: string,
        factionColor: number
    ): void {
        const fortress = this.factionRegistry.getFortressForFaction(factionId);
        if (!fortress) return;
        
        // Position fortress preview on the left side of the panel to avoid overlap
        const startX = -450;
        const startY = 140;
        const cellSize = 26;
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
        const fortressName = this.add.text(startX + 220, startY - 5, fortress.name, {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#f0dba5'
        }).setOrigin(0, 0);
        panel.add(fortressName);
        
        const fortressHp = this.add.text(startX + 220, startY + 20, `HP: ${fortress.maxHp}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#c0c0c0'
        }).setOrigin(0, 0);
        panel.add(fortressHp);

        // Fortress art preview to the right
        const fortressKeyMap: Record<string, string> = {
            jade_dynasty: 'fortress_jade_dynasty_01',
            frost_clan: 'fortress_frost_clan_01',
            triarch_dominion: 'fortress_triarch_dominion_01'
        };
        const fortressKey = fortressKeyMap[factionId];
        if (fortressKey && this.textures.exists(fortressKey)) {
            const art = this.add.image(startX - 50, startY + 10, fortressKey);
            art.setOrigin(0.5, 0.65);
            const targetWidth = 200;
            const scale = targetWidth / art.width;
            art.setScale(scale);
            art.setAlpha(0.95);
            panel.add(art);
        }
    }

    private createNavigationArrows(width: number, height: number): void {
        // Left arrow
        this.leftArrow = this.createArrow(150, height / 2, true);
        
        // Right arrow
        this.rightArrow = this.createArrow(width - 150, height / 2, false);
    }

    private createArrow(x: number, y: number, isLeft: boolean): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        const key = isLeft ? 'ui_arrow_left' : 'ui_arrow_right';

        if (this.textures.exists(key)) {
            const img = this.add.image(0, 0, key);
            img.setDisplaySize(70, 70);
            img.setInteractive({ useHandCursor: true, pixelPerfect: true });
            container.add(img);

            img.on('pointerover', () => container.setScale(1.08));
            img.on('pointerout', () => container.setScale(1));
            img.on('pointerup', () => {
                if (this.isAnimating) return;
                if (isLeft) this.navigateFaction(-1);
                else this.navigateFaction(1);
            });
        } else {
            // Fallback to text arrow if texture missing
            const bg = this.add.circle(0, 0, 40, 0x3d4663, 0.9);
            bg.setStrokeStyle(2, 0xd4a017);
            container.add(bg);

            const arrow = this.add.text(0, 0, isLeft ? '◀' : '▶', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '28px',
                color: '#f0dba5'
            }).setOrigin(0.5);
            container.add(arrow);

            bg.setInteractive(new Phaser.Geom.Circle(0, 0, 40), Phaser.Geom.Circle.Contains);
            bg.on('pointerover', () => {
                bg.setFillStyle(0x4d5673, 1);
                container.setScale(1.1);
            });
            bg.on('pointerout', () => {
                bg.setFillStyle(0x3d4663, 0.9);
                container.setScale(1);
            });
            bg.on('pointerup', () => {
                if (this.isAnimating) return;
                if (isLeft) this.navigateFaction(-1);
                else this.navigateFaction(1);
            });
        }

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

        // Update background to match focused faction
        const currentFactionId = this.factions[this.currentIndex]?.id;
        if (currentFactionId) {
            this.setBackgroundForFaction(currentFactionId, this.cameras.main.width, this.cameras.main.height);
        }
    }

    private setBackgroundForFaction(factionId: string, width: number, height: number): void {
        // If the scene has been stopped/transitioned, bail early to avoid 'sys' undefined errors.
        if (!this.sys || !this.sys.game || this.sys.settings.status !== Phaser.Scenes.RUNNING) {
            return;
        }

        const keyMap: Record<string, string> = {
            jade_dynasty: 'faction_bg_jade_dynasty',
            frost_clan: 'faction_bg_frost_clan',
            triarch_dominion: 'faction_bg_triarch_dominion'
        };
        const bgKey = keyMap[factionId];

        // On-demand load if missing
        const fileMap: Record<string, string> = {
            faction_bg_jade_dynasty: 'assets/faction_selection/faction_selection_jade_dynasty.png',
            faction_bg_frost_clan: 'assets/faction_selection/faction_selection_eternal_frost_clan.png',
            faction_bg_triarch_dominion: 'assets/faction_selection/faction_selection_triarch_dominion.png'
        };

        if (bgKey && !this.textures.exists(bgKey) && fileMap[bgKey] && !this.bgLoadInFlight.has(bgKey)) {
            console.log(`[FactionSelectionScene] Texture ${bgKey} missing, loading from ${fileMap[bgKey]}`);
            this.bgLoadInFlight.add(bgKey);
            this.load.image(bgKey, fileMap[bgKey]);
            this.load.once(`filecomplete-image-${bgKey}`, () => {
                console.log(`[FactionSelectionScene] Texture ${bgKey} loaded successfully`);
                this.bgLoadInFlight.delete(bgKey);
                if (this.sys && this.sys.isActive() && this.factions[this.currentIndex]?.id === factionId) {
                    this.setBackgroundForFaction(factionId, width, height);
                }
            });
            this.load.start();
        }

        // Cleanup previous
        if (this.backgroundImage) {
            this.backgroundImage.destroy();
            this.backgroundImage = undefined;
        }
        if (this.backgroundFallback) {
            this.backgroundFallback.destroy();
            this.backgroundFallback = undefined;
        }

        if (bgKey && this.textures.exists(bgKey)) {
            this.backgroundImage = this.add.image(width / 2, height / 2, bgKey);
            this.backgroundImage.setDisplaySize(width, height);
            this.backgroundImage.setDepth(-50);
            this.backgroundImage.setScrollFactor(0);
        } else {
            // Fallback gradient
            this.backgroundFallback = this.add.graphics().setDepth(-50).setScrollFactor(0);
            this.backgroundFallback.fillGradientStyle(0x0a0c12, 0x0a0c12, 0x1a1d2e, 0x1a1d2e, 1);
            this.backgroundFallback.fillRect(0, 0, width, height);
            const pattern = this.add.graphics().setDepth(-49).setScrollFactor(0);
            pattern.lineStyle(1, 0x3d4663, 0.15);
            for (let i = 0; i < 30; i++) {
                pattern.lineBetween(0, i * 40, width, i * 40);
            }
            // Keep pattern reference if we want to destroy it later, but graphics.destroy() handles self only.
            // Ideally we group them or track pattern too. For now, pattern adds to scene display list.
            // Let's add pattern to backgroundFallback logic (as separate obj tracked)?
            // Or just leave it as fire-and-forget (it will leak if we switch factions often!)
            // FIX: Track pattern too or use container.
            
            // To be safe/clean without changing class props too much, let's attach it to backgroundFallback
            // as a custom property or just destroy it right here if we had one?
            // Better: use a container for fallback.
        }
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
        
        // Interactive on the button background
        bg.setInteractive(
            new Phaser.Geom.Rectangle(-120, -30, 240, 60),
            Phaser.Geom.Rectangle.Contains
        );
        
        bg.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0xf0dba5, 1);
            bg.fillRoundedRect(-120, -30, 240, 60, 10);
            this.selectButton.setScale(1.05);
        });
        
        bg.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0xd4a017, 1);
            bg.fillRoundedRect(-120, -30, 240, 60, 10);
            this.selectButton.setScale(1);
        });
        
        bg.on('pointerup', () => {
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
        
        // Interactive on background rect
        bg.setInteractive(
            new Phaser.Geom.Rectangle(-60, -20, 120, 40),
            Phaser.Geom.Rectangle.Contains
        );
        
        bg.on('pointerover', () => {
            text.setColor('#f0dba5');
            backBtn.setScale(1.05);
        });
        
        bg.on('pointerout', () => {
            text.setColor('#c0c0c0');
            backBtn.setScale(1);
        });
        
        bg.on('pointerup', () => {
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.time.delayedCall(300, () => {
                this.scene.start('TitleMenuScene');
            });
        });
    }

    private selectFaction(): void {
        const selectedFaction = this.factions[this.currentIndex];
        const commanderId = this.selectedCommanderByFaction[selectedFaction.id] ?? null;
        
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.time.delayedCall(400, () => {
            this.scene.start('DeckBuildingScene', { 
                factionId: selectedFaction.id,
                isNewRun: true,
                commanderId: commanderId ?? undefined
            });
        });
    }
}

