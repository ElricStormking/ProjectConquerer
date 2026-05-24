import Phaser from 'phaser';
import { FactionRegistry } from '../systems/FactionRegistry';
import { CommanderManager } from '../systems/CommanderManager';
import { RunProgressionManager } from '../systems/RunProgressionManager';
import { IFactionConfig, ICommanderFullConfig } from '../types/ironwars';

const CARD_WIDTH = 1920;
const CARD_SPACING = 50;
const INITIAL_FACTION_ID = 'triarch_dominion';
const ELF_CARD_PORTRAITS: Record<string, string> = {
    card_elf_glow_sprout_spirit: 'assets/cards/Elf_covenant/units/Glow_Sprout_Spirit.png',
    card_elf_seed_pod_artillery: 'assets/cards/Elf_covenant/units/Seed_Pod_Artillery.png',
    card_elf_pollen_burster: 'assets/cards/Elf_covenant/units/Pollen_Burster.png',
    card_elf_bloom_thrower: 'assets/cards/Elf_covenant/units/Bloom_Thrower.png',
    card_elf_emerald_justiciar: 'assets/cards/Elf_covenant/units/Emerald_Justiciar.png',
    card_elf_emerald_shadow_guards: 'assets/cards/Elf_covenant/units/Emerald_Shadow_Guards.png',
    card_elf_emerald_dragonling: 'assets/cards/Elf_covenant/units/Emerald_Dragonling.png',
    card_elf_champion_glade: 'assets/cards/Elf_covenant/units/Champion_of_the_Glade.png',
    card_elf_emerald_vanguard: 'assets/cards/Elf_covenant/units/Emerald_Vanguard.png',
    card_elf_hallow_tree_paladin: 'assets/cards/Elf_covenant/units/Hallow_Tree_Paladin.png',
    card_elf_guardian_world_tree: 'assets/cards/Elf_covenant/units/Guardian_of_the_World_Tree.png',
    card_elf_kaelas_squire: 'assets/cards/Elf_covenant/units/Kaelas_Squire.png',
    card_elf_grove_petitioner: 'assets/cards/Elf_covenant/units/Grove_Petitioner.png',
    card_elf_oracle: 'assets/cards/Elf_covenant/units/Oracle.png',
    card_elf_soul_seer_disciple: 'assets/cards/Elf_covenant/units/Soul_Seer_Disciple.png',
    card_elf_soul_light_butterfly: 'assets/cards/Elf_covenant/units/Soul_Light_Butterfly.png',
    card_elf_spirit_bound_hunter: 'assets/cards/Elf_covenant/units/Spirit_Bound_Hunter.png',
    card_elf_starlight_sky_skimmers: 'assets/cards/Elf_covenant/units/Starlight_Sky_Skimmers.png',
    card_elf_turmaline_weaver: 'assets/cards/Elf_covenant/units/Turmaline_Weaver.png',
    card_elf_verdant_legionary: 'assets/cards/Elf_covenant/units/Verdant_Legionary.png',
    card_elf_vitality_bonder: 'assets/cards/Elf_covenant/units/Vitality_Bonder.png',
    card_elf_altar_of_heroes: 'assets/cards/Elf_covenant/buildings/Altar_of_Heroes.png',
    card_elf_bloom_hatchery: 'assets/cards/Elf_covenant/buildings/Bloom_Hatchery.png',
    card_elf_emerald_shield_battery: 'assets/cards/Elf_covenant/buildings/Emerald_Shield_Battery.png',
    card_elf_fountain_of_life: 'assets/cards/Elf_covenant/buildings/Fountain_of_Life.png',
    card_elf_healing_grove: 'assets/cards/Elf_covenant/buildings/Healing_Grove.png',
    card_elf_living_vine_wall: 'assets/cards/Elf_covenant/buildings/Living_Vine_Wall.png',
    card_elf_soul_stone_monument: 'assets/cards/Elf_covenant/buildings/Soul-Stone_Monument.png',
    card_elf_spore_mist_pillar: 'assets/cards/Elf_covenant/buildings/Spore-Mist_Pillar.png',
    card_elf_sun_crystal_spire: 'assets/cards/Elf_covenant/buildings/Sun-Crystal_Spire.png'
};

export class FactionSelectionScene extends Phaser.Scene {
    private readonly factionRegistry = FactionRegistry.getInstance();
    private readonly commanderManager = CommanderManager.getInstance();
    private readonly runManager = RunProgressionManager.getInstance();
    
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
    private cardPortraitLoadInFlight: Set<string> = new Set();

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
        
        // New campaigns begin in Triarch Dominion. Other factions are unlocked later.
        this.factions = this.factionRegistry.getAllFactions().filter(f => f.id === INITIAL_FACTION_ID);
        if (this.factions.length === 0) {
            // Fallback if no factions loaded
            console.warn('[FactionSelectionScene] No factions loaded, using default');
            this.factions = [{
                id: INITIAL_FACTION_ID,
                name: 'Triarch Dominion',
                resourceType: 'gold' as any,
                fortressId: 'fortress_triarch_dominion_01',
                startingCommanderId: 'commander_valerius',
                emblemKey: 'emblem_triarch',
                description: 'Combined-arms holy, tactical, and arcane coalition.'
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
        this.add.text(width / 2, 60, 'CHOOSE YOUR COMMANDER', {
            fontFamily: 'Georgia, serif',
            fontSize: '48px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        this.add.text(width / 2, 110, 'Triarch Dominion begins the campaign. Select your first commander.', {
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
        const panelWidth = 1320;
        const panelHeight = 660;
        
        // Panel background
        const bg = this.add.graphics();
        const factionColor = this.factionRegistry.getFactionColor(faction.id);
        bg.fillStyle(0x111522, 0.96);
        bg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 10);
        bg.fillStyle(0x24304a, 0.32);
        bg.fillRoundedRect(-panelWidth / 2 + 18, -panelHeight / 2 + 18, panelWidth - 36, panelHeight - 36, 6);
        bg.lineStyle(4, factionColor, 0.95);
        bg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 10);
        bg.lineStyle(1, 0xf0dba5, 0.46);
        bg.strokeRoundedRect(-panelWidth / 2 + 20, -panelHeight / 2 + 20, panelWidth - 40, panelHeight - 40, 6);
        panel.add(bg);
        
        // Faction emblem (use logo art if available)
        const logoKeyMap: Record<string, string> = {
            jade_dynasty: 'logo_jade_dynasty',
            frost_clan: 'logo_frost_clan',
            triarch_dominion: 'logo_triarch_dominion'
        };
        const logoKey = logoKeyMap[faction.id];
        if (logoKey && this.textures.exists(logoKey)) {
            const logo = this.add.image(-565, -245, logoKey);
            logo.setDisplaySize(110, 110);
            panel.add(logo);
        } else {
            const emblem = this.add.circle(-565, -245, 52, factionColor, 1);
            emblem.setStrokeStyle(3, 0xffffff, 0.3);
            panel.add(emblem);
        }
        
        // Faction name
        const nameText = this.add.text(-480, -280, faction.name.toUpperCase(), {
            fontFamily: 'Georgia, serif',
            fontSize: '42px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0, 0);
        panel.add(nameText);
        
        // Description
        const descText = this.add.text(-480, -228, faction.description || 'No description available', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#c0c0c0',
            wordWrap: { width: 660 }
        }).setOrigin(0, 0);
        panel.add(descText);
        
        // Divider line
        const divider = this.add.graphics();
        divider.lineStyle(2, factionColor, 0.55);
        divider.lineBetween(-panelWidth / 2 + 42, -170, panelWidth / 2 - 42, -170);
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
        const selectorY = -128;
        const startX = -488;
        const btnW = 225;
        const btnH = 52;
        const gap = 14;
        let tabs = panel.getByName('commanderTabs') as Phaser.GameObjects.Container | undefined;
        if (!tabs) {
            tabs = this.add.container(0, 0);
            tabs.setName('commanderTabs');
            panel.add(tabs);
        }
        tabs.removeAll(true);

        commanders.forEach((cmd, i) => {
            const btn = this.add.container(startX + i * (btnW + gap), selectorY);
            const bg = this.add.graphics();
            const isSelected = this.selectedCommanderByFaction[cmd.factionId] === cmd.id;
            bg.fillStyle(isSelected ? 0x574213 : 0x20283f, 0.94);
            bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
            bg.lineStyle(isSelected ? 4 : 2, isSelected ? 0xffd35a : factionColor, isSelected ? 1 : 0.72);
            bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 6);
            btn.add(bg);

            if (isSelected) {
                const highlight = this.add.graphics();
                highlight.fillStyle(0xffd35a, 0.18);
                highlight.fillRoundedRect(-btnW / 2 + 6, -btnH / 2 + 6, btnW - 12, btnH - 12, 4);
                highlight.lineStyle(1, 0xfff0b5, 0.8);
                highlight.strokeRoundedRect(-btnW / 2 + 8, -btnH / 2 + 8, btnW - 16, btnH - 16, 3);
                btn.add(highlight);

                const underline = this.add.rectangle(0, btnH / 2 - 5, btnW - 30, 5, 0xffd35a, 1);
                underline.setOrigin(0.5);
                btn.add(underline);

                const marker = this.add.triangle(0, btnH / 2 + 11, -9, 0, 9, 0, 0, 8, 0xffd35a, 1);
                marker.setStrokeStyle(1, 0x3a2f19, 0.8);
                btn.add(marker);
            }

            const txt = this.add.text(0, 0, cmd.name, {
                fontFamily: 'Georgia, serif',
                fontSize: '18px',
                color: isSelected ? '#fff7cf' : '#d9d0ad',
                fontStyle: 'bold',
                align: 'center',
                wordWrap: { width: btnW - 24 }
            }).setOrigin(0.5);
            if (isSelected) {
                txt.setStroke('#1c1405', 3);
            }
            btn.add(txt);

            bg.setInteractive(
                new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
                Phaser.Geom.Rectangle.Contains
            );

            bg.on('pointerover', () => btn.setScale(1.05));
            bg.on('pointerout', () => btn.setScale(1));
            bg.on('pointerup', () => {
                this.selectedCommanderByFaction[cmd.factionId] = cmd.id;
                this.addCommanderSelector(panel, commanders, factionColor);
                this.renderCommanderSection(panel, cmd.factionId, factionColor);
                this.renderCardsPreview(panel, cmd.factionId, factionColor);
            });

            tabs.add(btn);
        });
    }

    private renderCommanderSection(panel: Phaser.GameObjects.Container, factionId: string, factionColor: number): void {
        const container = panel.getByName('commanderSection') as Phaser.GameObjects.Container;
        container.removeAll(true);
        const selectedId = this.selectedCommanderByFaction[factionId];
        if (!selectedId) {
            container.add(this.add.text(-540, -20, 'No commander available', { fontSize: '18px', color: '#c0c0c0' }));
            return;
        }
        const commander = this.commanderManager.getCommander(selectedId);
        if (!commander) return;

        const portraitFrame = this.add.graphics();
        portraitFrame.fillStyle(0x080b12, 0.68);
        portraitFrame.fillRoundedRect(-596, -62, 270, 330, 6);
        portraitFrame.lineStyle(3, factionColor, 0.92);
        portraitFrame.strokeRoundedRect(-596, -62, 270, 330, 6);
        portraitFrame.lineStyle(1, 0xf0dba5, 0.48);
        portraitFrame.strokeRoundedRect(-584, -50, 246, 306, 4);
        container.add(portraitFrame);

        if (this.textures.exists(commander.portraitKey)) {
            const portrait = this.add.image(-461, 103, commander.portraitKey);
            const scale = Math.min(238 / portrait.width, 292 / portrait.height);
            portrait.setScale(scale);
            container.add(portrait);
        } else {
            const portrait = this.add.rectangle(-461, 103, 238, 292, factionColor, 0.28);
            portrait.setStrokeStyle(2, factionColor);
            container.add(portrait);
        }

        const infoPlate = this.add.graphics();
        infoPlate.fillStyle(0x121826, 0.78);
        infoPlate.fillRoundedRect(-292, -62, 420, 174, 6);
        infoPlate.lineStyle(1, factionColor, 0.45);
        infoPlate.strokeRoundedRect(-292, -62, 420, 174, 6);
        container.add(infoPlate);

        const cmdLabel = this.add.text(-268, -38, 'COMMANDER', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '15px',
            color: '#8a9cc5'
        }).setOrigin(0, 0);
        container.add(cmdLabel);

        const cmdName = this.add.text(-268, -8, commander.name, {
            fontFamily: 'Georgia, serif',
            fontSize: '31px',
            color: '#f0dba5',
            fontStyle: 'bold',
            wordWrap: { width: 370 }
        }).setOrigin(0, 0);
        container.add(cmdName);

        const skillLabel = this.add.text(-268, 66, 'ACTIVE SKILL', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '15px',
            color: '#8a9cc5'
        }).setOrigin(0, 0);
        container.add(skillLabel);

        const activeSkill = commander.activeSkillId
            ? commander.activeSkillId.replace(/_/g, ' ').toUpperCase()
            : 'COMMAND PROTOCOL';
        const skillName = this.add.text(-268, 90, activeSkill, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            color: '#d7d2c0',
            wordWrap: { width: 360 }
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
        this.queueMissingElfCardPortraits(cards, panel, factionId, factionColor);

        const startX = 178;
        const startY = -58;
        const cardWidth = 132;
        const cardHeight = 184;
        const gap = 22;
        const cols = 3;
        const cardOffsetX = -5;
        const cardOffsetY = 20;
        const shelfX = startX - 26;
        const shelfY = startY - 90;
        const shelfWidth = 496;
        const shelfHeight = 454;

        const shelf = this.add.graphics();
        shelf.fillStyle(0x080b12, 0.55);
        shelf.fillRoundedRect(shelfX, shelfY, shelfWidth, shelfHeight, 6);
        shelf.lineStyle(2, factionColor, 0.55);
        shelf.strokeRoundedRect(shelfX, shelfY, shelfWidth, shelfHeight, 6);
        container.add(shelf);

        const label = this.add.text(startX - 4, startY - 68, 'STARTING CARDS', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            color: '#8a9cc5'
        }).setOrigin(0, 0);
        container.add(label);

        if (cards.length === 0) {
            const placeholder = this.add.text(startX, startY + 40, 'Coming soon', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '18px',
                color: '#c0c0c0'
            }).setOrigin(0, 0);
            container.add(placeholder);
            return;
        }

        cards.forEach((card, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cardWidth + gap) + cardOffsetX;
            const y = startY + row * (cardHeight + 28) + cardOffsetY;

            const cardBg = this.add.graphics();
            cardBg.fillStyle(0x20283f, 1);
            cardBg.fillRoundedRect(x, y - cardHeight / 2, cardWidth, cardHeight, 6);
            cardBg.lineStyle(2, factionColor, 0.8);
            cardBg.strokeRoundedRect(x, y - cardHeight / 2, cardWidth, cardHeight, 6);
            container.add(cardBg);

            const costCircle = this.add.circle(x + 20, y - cardHeight / 2 + 20, 17, 0x3d4663);
            costCircle.setStrokeStyle(1, factionColor);
            container.add(costCircle);

            const costText = this.add.text(x + 20, y - cardHeight / 2 + 20, String(card.cost), {
                fontFamily: 'Arial, sans-serif',
                fontSize: '17px',
                color: '#f0dba5',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            container.add(costText);

            // Portrait
            const artW = cardWidth - 16;
            const artH = 112;
            if (card.portraitKey && this.textures.exists(card.portraitKey)) {
                const img = this.add.image(x + cardWidth / 2, y - 18, card.portraitKey).setOrigin(0.5);
                const texW = img.width || artW;
                const texH = img.height || artH;
                const scale = Math.min(artW / texW, artH / texH);
                img.setScale(scale);
                container.add(img);
            } else {
                const placeholder = this.add.rectangle(x + cardWidth / 2, y - 18, artW, artH, 0x111522);
                container.add(placeholder);
            }

            const cardName = card.name.length > 18 ? card.name.slice(0, 17) + '...' : card.name;
            const nameText = this.add.text(x + cardWidth / 2, y + 65, cardName, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '13px',
                color: '#d7d2c0',
                align: 'center',
                wordWrap: { width: cardWidth - 16 }
            }).setOrigin(0.5);
            container.add(nameText);
        });
    }

    private queueMissingElfCardPortraits(
        cards: { portraitKey: string }[],
        panel: Phaser.GameObjects.Container,
        factionId: string,
        factionColor: number
    ): void {
        if (factionId !== 'elf_covenant') return;

        let queued = false;
        cards.forEach(card => {
            const portraitKey = card.portraitKey;
            const portraitPath = ELF_CARD_PORTRAITS[portraitKey];
            if (!portraitPath || this.textures.exists(portraitKey) || this.cardPortraitLoadInFlight.has(portraitKey)) {
                return;
            }

            this.cardPortraitLoadInFlight.add(portraitKey);
            this.load.image(portraitKey, portraitPath);
            queued = true;

            const onLoadError = (file: Phaser.Loader.File) => {
                if (file.key !== portraitKey) return;
                this.cardPortraitLoadInFlight.delete(portraitKey);
                this.load.off('loaderror', onLoadError);
            };

            this.load.once(`filecomplete-image-${portraitKey}`, () => {
                this.cardPortraitLoadInFlight.delete(portraitKey);
                this.load.off('loaderror', onLoadError);
                if (this.sys && this.sys.isActive() && this.factions[this.currentIndex]?.id === factionId) {
                    this.renderCardsPreview(panel, factionId, factionColor);
                }
            });

            this.load.on('loaderror', onLoadError);
        });

        if (queued && this.load.isReady()) {
            this.load.start();
        }
    }

    private addFortressPreview(
        panel: Phaser.GameObjects.Container, 
        factionId: string,
        factionColor: number
    ): void {
        const fortress = this.factionRegistry.getFortressForFaction(factionId);
        if (!fortress) return;
        
        const startX = -292;
        const startY = 124;
        const bayWidth = 440;
        const bayHeight = 196;
        const cellSize = 21;
        const isoRatio = 0.5;

        const bay = this.add.graphics();
        bay.fillStyle(0x080b12, 0.62);
        bay.fillRoundedRect(startX, startY, bayWidth, bayHeight, 6);
        bay.lineStyle(2, factionColor, 0.5);
        bay.strokeRoundedRect(startX, startY, bayWidth, bayHeight, 6);
        bay.lineStyle(1, 0xf0dba5, 0.32);
        bay.strokeRoundedRect(startX + 10, startY + 10, bayWidth - 20, bayHeight - 20, 4);
        panel.add(bay);
        
        // Section label
        const label = this.add.text(startX + 18, startY + 14, 'MOBILE BASE', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '15px',
            color: '#8a9cc5'
        }).setOrigin(0, 0);
        panel.add(label);

        // Fortress art preview
        const fortressKeyMap: Record<string, string> = {
            jade_dynasty: 'fortress_jade_dynasty_01',
            frost_clan: 'fortress_frost_clan_01',
            triarch_dominion: 'fortress_triarch_dominion_01',
            elf_covenant: 'fortress_elf_covenant_02',
            abyss_legion: 'fortress_abyss_legion_01'
        };
        const fortressKey = fortressKeyMap[factionId];
        if (fortressKey && this.textures.exists(fortressKey)) {
            const art = this.add.image(startX + 105, startY + 126, fortressKey);
            art.setOrigin(0.5, 0.68);
            const scale = Math.min(240 / art.width, 122 / art.height);
            art.setScale(scale);
            art.setAlpha(0.98);
            panel.add(art);
        }
        
        // Draw isometric grid preview
        const gridGraphics = this.add.graphics();
        
        for (let y = 0; y < fortress.gridHeight; y++) {
            for (let x = 0; x < fortress.gridWidth; x++) {
                const cell = fortress.cells.find(c => c.x === x && c.y === y);
                const isoX = startX + 300 + (x - y) * (cellSize * 0.8);
                const isoY = startY + 46 + (x + y) * (cellSize * isoRatio);
                
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
        const fortressName = this.add.text(startX + 242, startY + 98, fortress.name, {
            fontFamily: 'Georgia, serif',
            fontSize: '18px',
            color: '#f0dba5',
            wordWrap: { width: 170 }
        }).setOrigin(0, 0);
        panel.add(fortressName);
        
        const fortressHp = this.add.text(startX + 242, startY + 124, `HP: ${fortress.maxHp}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '15px',
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
            triarch_dominion: 'faction_bg_triarch_dominion',
            elf_covenant: 'faction_bg_elf_covenant',
            abyss_legion: 'faction_bg_abyss_legion'
        };
        const bgKey = keyMap[factionId];

        // On-demand load if missing
        const fileMap: Record<string, string> = {
            faction_bg_jade_dynasty: 'assets/faction_selection/faction_selection_jade_dynasty.png',
            faction_bg_frost_clan: 'assets/faction_selection/faction_selection_eternal_frost_clan.png',
            faction_bg_triarch_dominion: 'assets/faction_selection/faction_selection_triarch_dominion.png',
            faction_bg_elf_covenant: 'assets/faction_selection/faction_selection_elf_covenant_01.png',
            faction_bg_abyss_legion: 'assets/faction_selection/faction_selection_abyss_legion.png'
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
        bg.fillRoundedRect(-150, -30, 300, 60, 10);
        this.selectButton.add(bg);
        
        const text = this.add.text(0, 0, 'SELECT COMMANDER', {
            fontFamily: 'Georgia, serif',
            fontSize: '24px',
            color: '#1a1a1a',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.selectButton.add(text);
        
        // Interactive on the button background
        bg.setInteractive(
            new Phaser.Geom.Rectangle(-150, -30, 300, 60),
            Phaser.Geom.Rectangle.Contains
        );
        
        bg.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0xf0dba5, 1);
            bg.fillRoundedRect(-150, -30, 300, 60, 10);
            this.selectButton.setScale(1.05);
        });
        
        bg.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0xd4a017, 1);
            bg.fillRoundedRect(-150, -30, 300, 60, 10);
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
        this.runManager.abandonRun();
        
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
