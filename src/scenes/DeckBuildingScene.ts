import Phaser from 'phaser';
import { RunProgressionManager } from '../systems/RunProgressionManager';
import { CommanderManager } from '../systems/CommanderManager';
import { FactionRegistry } from '../systems/FactionRegistry';
import { DataManager } from '../systems/DataManager';
import { ICard } from '../types/ironwars';

const MAX_DECK_SIZE = 40;
const CARD_WIDTH = 140;
const CARD_HEIGHT = 200;
const CARD_GAP = 14;
// Enlarged hover panel for card details (roughly 2x previous height)
const HOVER_PANEL_HEIGHT = 420;

interface DeckBuildingSceneData {
    factionId?: string;
    isNewRun?: boolean;
    commanderId?: string;
}

export class DeckBuildingScene extends Phaser.Scene {
    private readonly runManager = RunProgressionManager.getInstance();
    private readonly commanderManager = CommanderManager.getInstance();
    private readonly factionRegistry = FactionRegistry.getInstance();
    private readonly dataManager = DataManager.getInstance();
    
    private factionId = 'cog_dominion';
    private isNewRun = false;
    private startingCommanderId: string | undefined;
    private commanderRoster: string[] = [];
    private currentDeck: ICard[] = [];
    private availableCards: ICard[] = [];
    private selectedCommander: string | null = null;

    // Per-card limits for how many copies can be added to the deck from the available pool
    // Keyed by a stable card key (e.g. base id without copy suffix)
    private availableCardLimits: Map<string, { card: ICard; max: number }> = new Map();

    // UI containers
    private commanderPanel!: Phaser.GameObjects.Container;
    private cardGridPanel!: Phaser.GameObjects.Container;
    private deckPanel!: Phaser.GameObjects.Container;
    private cardGridContainer!: Phaser.GameObjects.Container;
    private deckListContainer!: Phaser.GameObjects.Container;
    private deckCountText!: Phaser.GameObjects.Text;
    // Layout bounds
    private commanderBounds = { x: 0, y: 90, width: 280, height: 0 };
    private cardPanelBounds = { x: 0, y: 90, width: 0, height: 0 };
    private deckBounds = { x: 0, y: 90, width: 340, height: 0 };
    
    private cardGridScrollY = 0;
    private deckScrollY = 0;

    // Hover card detail panel (lower-left)
    private hoverCardPanel!: Phaser.GameObjects.Container;
    private hoverCardNameText!: Phaser.GameObjects.Text;
    private hoverCardTypeText!: Phaser.GameObjects.Text;
    private hoverCardCostText!: Phaser.GameObjects.Text;
    private hoverCardDescText!: Phaser.GameObjects.Text;
    private hoverCardArt?: Phaser.GameObjects.GameObject;

    constructor() {
        super({ key: 'DeckBuildingScene' });
    }

    init(data: DeckBuildingSceneData): void {
        this.factionId = data.factionId ?? 'cog_dominion';
        this.isNewRun = data.isNewRun ?? false;
        this.startingCommanderId = data.commanderId;
    }

    create(): void {
        const { width, height } = this.cameras.main;
        
        this.computeLayout(width, height);
        
        // Initialize data
        this.initializeData();
        
        // Create UI
        this.createBackground(width, height);
        this.createHeader(width);
        this.createCommanderPanel();
        this.createCardGridPanel();
        this.createDeckPanel();
        this.createBottomButtons(width, height);
        this.createHoverCardPanel(width, height);
        
        // Initial render
        this.renderCommanders();
        this.renderAvailableCards();
        this.renderDeck();
        
        this.cameras.main.fadeIn(400, 0, 0, 0);
    }

    private computeLayout(width: number, height: number): void {
        const padding = 30;
        const verticalMargin = 140;
        this.commanderBounds.width = 0.18 * width;
        this.commanderBounds.width = Math.min(Math.max(this.commanderBounds.width, 260), 340);
        this.commanderBounds.height = height - verticalMargin;
        this.commanderBounds.x = padding;
        this.commanderBounds.y = 90;
        
        this.deckBounds.width = 0.22 * width;
        this.deckBounds.width = Math.min(Math.max(this.deckBounds.width, 320), 400);
        this.deckBounds.height = height - verticalMargin;
        this.deckBounds.x = width - padding - this.deckBounds.width;
        this.deckBounds.y = 90;
        
        this.cardPanelBounds.x = this.commanderBounds.x + this.commanderBounds.width + 20;
        this.cardPanelBounds.y = 90;
        this.cardPanelBounds.width = this.deckBounds.x - this.cardPanelBounds.x - 20;
        this.cardPanelBounds.height = height - verticalMargin;
    }

    private createHoverCardPanel(width: number, height: number): void {
        const panelWidth = this.commanderBounds.width;
        const panelX = this.commanderBounds.x;
        const panelY = height - HOVER_PANEL_HEIGHT - 90;

        this.hoverCardPanel = this.add.container(panelX, panelY);
        this.hoverCardPanel.setDepth(9000);

        const bg = this.add.graphics();
        bg.fillStyle(0x0f111a, 0.96);
        bg.fillRoundedRect(0, 0, panelWidth, HOVER_PANEL_HEIGHT, 10);
        bg.lineStyle(2, 0x3d4663, 0.9);
        bg.strokeRoundedRect(0, 0, panelWidth, HOVER_PANEL_HEIGHT, 10);
        this.hoverCardPanel.add(bg);

        this.hoverCardNameText = this.add.text(16, 14, '', {
            fontFamily: 'Georgia, serif',
            fontSize: '22px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0, 0);
        this.hoverCardPanel.add(this.hoverCardNameText);

        this.hoverCardTypeText = this.add.text(16, 44, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '15px',
            color: '#8a9cc5'
        }).setOrigin(0, 0);
        this.hoverCardPanel.add(this.hoverCardTypeText);

        this.hoverCardCostText = this.add.text(16, 66, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '15px',
            color: '#c0c0c0'
        }).setOrigin(0, 0);
        this.hoverCardPanel.add(this.hoverCardCostText);

        this.hoverCardDescText = this.add.text(190, 96, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#d0d4e1',
            wordWrap: { width: panelWidth - 210 }
        }).setOrigin(0, 0);
        this.hoverCardPanel.add(this.hoverCardDescText);

        this.hoverCardPanel.setVisible(false);
    }

    private initializeData(): void {
        if (this.isNewRun) {
            // Starting a new run - get selected starter commander (or faction default)
            const starterCommander = this.startingCommanderId
                ? this.commanderManager.getCommander(this.startingCommanderId)
                : this.commanderManager.getStarterCommander(this.factionId);
            if (starterCommander) {
                this.commanderRoster = [starterCommander.id];
                // Start with an empty deck; player builds up to the per-card limits
                this.currentDeck = [];
                this.selectedCommander = starterCommander.id;
            }
        } else {
            // Existing run - load from run state
            const runState = this.runManager.getRunState();
            if (runState) {
                this.factionId = runState.factionId;
                this.commanderRoster = [...runState.commanderRoster];
                this.currentDeck = [...runState.deck];
                this.selectedCommander = this.commanderRoster[0] || null;
            }
        }
        
        // Build available cards from commander roster
        this.availableCards = this.commanderManager.getAvailableCardsForRoster(this.commanderRoster);

        // Include any additional cards the player has acquired this run,
        // regardless of commander ownership. These show up in Available Cards
        // but may be locked if the player lacks the corresponding commander.
        const collectionIds = this.runManager.getCardCollection();
        collectionIds.forEach(id => {
            const card = this.dataManager.getCard(id);
            if (card) {
                this.availableCards.push(card);
            }
        });

        this.rebuildAvailableCardLimits();
    }

    private createBackground(width: number, height: number): void {
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0a0c12, 0x0a0c12, 0x151820, 0x151820, 1);
        bg.fillRect(0, 0, width, height);
    }

    private createHeader(width: number): void {
        const factionColor = this.factionRegistry.getFactionColor(this.factionId);
        const faction = this.factionRegistry.getFaction(this.factionId);
        
        // Header bar
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x1a1d2e, 0.95);
        headerBg.fillRect(0, 0, width, 70);
        headerBg.lineStyle(2, factionColor, 0.8);
        headerBg.lineBetween(0, 70, width, 70);
        
        // Title
        this.add.text(width / 2, 35, 'DECK BUILDING', {
            fontFamily: 'Georgia, serif',
            fontSize: '32px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Faction indicator
        this.add.text(100, 35, faction?.name ?? this.factionId, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#8a9cc5'
        }).setOrigin(0, 0.5);
    }

    private createCommanderPanel(): void {
        const { x: panelX, y: panelY, width: panelWidth, height: panelHeight } = this.commanderBounds;
        
        this.commanderPanel = this.add.container(panelX, panelY);
        
        // Panel background
        const bg = this.add.graphics();
        bg.fillStyle(0x1a1d2e, 0.9);
        bg.fillRoundedRect(0, 0, panelWidth, panelHeight, 10);
        bg.lineStyle(2, 0x3d4663, 1);
        bg.strokeRoundedRect(0, 0, panelWidth, panelHeight, 10);
        this.commanderPanel.add(bg);
        
        // Title
        const title = this.add.text(panelWidth / 2, 25, 'COMMANDERS', {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.commanderPanel.add(title);
        
        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(1, 0x3d4663, 0.5);
        divider.lineBetween(20, 50, panelWidth - 20, 50);
        this.commanderPanel.add(divider);
    }

    private createCardGridPanel(): void {
        const { x: panelX, y: panelY, width: panelWidth, height: panelHeight } = this.cardPanelBounds;
        
        this.cardGridPanel = this.add.container(panelX, panelY);
        
        // Panel background
        const bg = this.add.graphics();
        bg.fillStyle(0x1a1d2e, 0.9);
        bg.fillRoundedRect(0, 0, panelWidth, panelHeight, 10);
        bg.lineStyle(2, 0x3d4663, 1);
        bg.strokeRoundedRect(0, 0, panelWidth, panelHeight, 10);
        this.cardGridPanel.add(bg);
        
        // Title
        const title = this.add.text(panelWidth / 2, 25, 'AVAILABLE CARDS', {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.cardGridPanel.add(title);
        
        // Card count
        const countText = this.add.text(panelWidth - 30, 25, `${this.availableCards.length} cards`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#8a9cc5'
        }).setOrigin(1, 0.5);
        this.cardGridPanel.add(countText);
        
        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(1, 0x3d4663, 0.5);
        divider.lineBetween(20, 50, panelWidth - 20, 50);
        this.cardGridPanel.add(divider);
        
        // Scrollable card container
        this.cardGridContainer = this.add.container(20, 60);
        this.cardGridPanel.add(this.cardGridContainer);
        
        // Create mask for scrolling
        const maskShape = this.make.graphics({});
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(panelX + 10, panelY + 55, panelWidth - 20, panelHeight - 65);
        const mask = maskShape.createGeometryMask();
        this.cardGridContainer.setMask(mask);
        
        // Enable scrolling
        this.input.on('wheel', (pointer: Phaser.Input.Pointer, _gameObjects: any[], _deltaX: number, deltaY: number) => {
            if (pointer.x >= panelX && pointer.x <= panelX + panelWidth &&
                pointer.y >= panelY && pointer.y <= panelY + panelHeight) {
                this.scrollCardGrid(deltaY);
            }
        });
    }

    private createDeckPanel(): void {
        const { x: panelX, y: panelY, width: panelWidth, height: panelHeight } = this.deckBounds;
        
        this.deckPanel = this.add.container(panelX, panelY);
        
        // Panel background
        const bg = this.add.graphics();
        bg.fillStyle(0x1a1d2e, 0.9);
        bg.fillRoundedRect(0, 0, panelWidth, panelHeight, 10);
        bg.lineStyle(2, 0x3d4663, 1);
        bg.strokeRoundedRect(0, 0, panelWidth, panelHeight, 10);
        this.deckPanel.add(bg);
        
        // Title
        const title = this.add.text(panelWidth / 2, 25, 'YOUR DECK', {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.deckPanel.add(title);
        
        // Deck count
        this.deckCountText = this.add.text(panelWidth - 30, 25, `${this.currentDeck.length}/${MAX_DECK_SIZE}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: this.currentDeck.length <= MAX_DECK_SIZE ? '#8a9cc5' : '#e74c3c'
        }).setOrigin(1, 0.5);
        this.deckPanel.add(this.deckCountText);
        
        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(1, 0x3d4663, 0.5);
        divider.lineBetween(20, 50, panelWidth - 20, 50);
        this.deckPanel.add(divider);
        
        // Scrollable deck list container
        this.deckListContainer = this.add.container(10, 60);
        this.deckPanel.add(this.deckListContainer);
        
        // Create mask for scrolling
        const maskShape = this.make.graphics({});
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(panelX + 5, panelY + 55, panelWidth - 10, panelHeight - 120);
        const mask = maskShape.createGeometryMask();
        this.deckListContainer.setMask(mask);
        
        // Enable scrolling
        this.input.on('wheel', (pointer: Phaser.Input.Pointer, _gameObjects: any[], _deltaX: number, deltaY: number) => {
            if (pointer.x >= panelX && pointer.x <= panelX + panelWidth &&
                pointer.y >= panelY && pointer.y <= panelY + panelHeight) {
                this.scrollDeck(deltaY);
            }
        });
    }

    private createBottomButtons(width: number, height: number): void {
        const buttonY = height - 50;
        
        // Back button
        this.createButton(150, buttonY, '← Back', () => this.onBack());
        
        // Start/Continue button
        const startLabel = this.isNewRun ? 'START RUN' : 'SAVE & RETURN';
        this.createButton(width - 150, buttonY, startLabel, () => this.onStart(), true);
    }

    private createButton(x: number, y: number, label: string, callback: () => void, isPrimary = false): void {
        const container = this.add.container(x, y);
        const buttonWidth = 200;
        const buttonHeight = 56;
        
        const bg = this.add.graphics();
        const fillColor = isPrimary ? 0xd4a017 : 0x3d4663;
        const textColor = isPrimary ? '#1a1a1a' : '#f0dba5';
        
        bg.fillStyle(fillColor, 1);
        bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
        container.add(bg);
        
        const text = this.add.text(0, 0, label, {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: textColor,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(text);
        
        // Attach input to the button background instead of the container
        bg.setInteractive(
            new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight),
            Phaser.Geom.Rectangle.Contains
        );
        
        bg.on('pointerover', () => {
            container.setScale(1.05);
            bg.clear();
            bg.fillStyle(isPrimary ? 0xf0dba5 : 0x4d5673, 1);
            bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
        });
        
        bg.on('pointerout', () => {
            container.setScale(1);
            bg.clear();
            bg.fillStyle(fillColor, 1);
            bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
        });
        
        bg.on('pointerup', callback);
    }

    private renderCommanders(): void {
        // Clear existing
        this.commanderPanel.list.slice(3).forEach(obj => obj.destroy()); // Keep bg, title, divider
        
        const startY = 70;
        const itemHeight = 80;
        
        this.commanderRoster.forEach((commanderId, index) => {
            const commander = this.commanderManager.getCommander(commanderId);
            if (!commander) return;
            
            const y = startY + index * itemHeight;
            const isSelected = commanderId === this.selectedCommander;
            
            // Commander item container
            const itemContainer = this.add.container(10, y);
            
            // Background
            const itemBg = this.add.graphics();
            itemBg.fillStyle(isSelected ? 0x3d4663 : 0x252836, 0.9);
            itemBg.fillRoundedRect(0, 0, 230, 70, 6);
            if (isSelected) {
                const factionColor = this.factionRegistry.getFactionColor(this.factionId);
                itemBg.lineStyle(2, factionColor, 1);
                itemBg.strokeRoundedRect(0, 0, 230, 70, 6);
            }
            itemContainer.add(itemBg);
            
            // Portrait placeholder
            const portrait = this.add.rectangle(40, 35, 50, 60, 
                this.factionRegistry.getFactionColor(this.factionId), 0.4);
            portrait.setStrokeStyle(1, 0xffffff, 0.3);
            itemContainer.add(portrait);
            
            // Commander name
            const nameText = this.add.text(75, 20, commander.name, {
                fontFamily: 'Georgia, serif',
                fontSize: '16px',
                color: isSelected ? '#f0dba5' : '#c0c0c0',
                fontStyle: isSelected ? 'bold' : 'normal'
            }).setOrigin(0, 0);
            itemContainer.add(nameText);
            
            // Card count
            const cardCount = commander.cardIds.length;
            const cardText = this.add.text(75, 42, `${cardCount} cards`, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '12px',
                color: '#8a9cc5'
            }).setOrigin(0, 0);
            itemContainer.add(cardText);
            
            // Make interactive on the background graphics to avoid container quirks
            itemBg.setInteractive(
                new Phaser.Geom.Rectangle(0, 0, 230, 70),
                Phaser.Geom.Rectangle.Contains
            );
            
            itemBg.on('pointerup', () => {
                this.selectedCommander = commanderId;
                this.renderCommanders();
                this.filterCardsByCommander(commanderId);
            });
            
            this.commanderPanel.add(itemContainer);
        });
        
        // "Show All" button
        const showAllY = startY + this.commanderRoster.length * itemHeight + 10;
        const showAllBtn = this.add.container(10, showAllY);
        
        const showAllBg = this.add.graphics();
        showAllBg.fillStyle(0x2a2d3a, 0.8);
        showAllBg.fillRoundedRect(0, 0, 230, 40, 6);
        showAllBtn.add(showAllBg);
        
        const showAllText = this.add.text(115, 20, 'Show All Cards', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#8a9cc5'
        }).setOrigin(0.5);
        showAllBtn.add(showAllText);
        
        // Interactive on the background rect
        showAllBg.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, 230, 40),
            Phaser.Geom.Rectangle.Contains
        );
        
        showAllBg.on('pointerup', () => {
            this.selectedCommander = null;
            this.availableCards = this.commanderManager.getAvailableCardsForRoster(this.commanderRoster);
            this.rebuildAvailableCardLimits();
            this.renderCommanders();
            this.renderAvailableCards();
        });
        
        this.commanderPanel.add(showAllBtn);
    }

    private filterCardsByCommander(commanderId: string): void {
        this.availableCards = this.commanderManager.getCardsForCommander(commanderId);
        this.rebuildAvailableCardLimits();
        this.cardGridScrollY = 0;
        this.renderAvailableCards();
    }

    private renderAvailableCards(): void {
        // Clear existing
        this.cardGridContainer.removeAll(true);

        const startX = 10;
        const startY = 10;

        const availableWidth = this.cardPanelBounds.width - startX * 2;
        const cardsPerRow = Math.max(1, Math.floor((availableWidth + CARD_GAP) / (CARD_WIDTH + CARD_GAP)));

        // Count how many copies of each card type are currently in the deck
        const deckCounts = new Map<string, number>();
        this.currentDeck.forEach(card => {
            const key = this.getCardKey(card);
            deckCounts.set(key, (deckCounts.get(key) ?? 0) + 1);
        });

        const groupedCards = Array.from(this.availableCardLimits.values());

        groupedCards.forEach(({ card, max }, index) => {
            const col = index % cardsPerRow;
            const row = Math.floor(index / cardsPerRow);

            const x = startX + col * (CARD_WIDTH + CARD_GAP);
            const y = startY + row * (CARD_HEIGHT + CARD_GAP) + this.cardGridScrollY;

            const key = this.getCardKey(card);
            const usedInDeck = deckCounts.get(key) ?? 0;
            const remaining = Math.max(0, max - usedInDeck);

            // Determine if this card can be used with the current commander roster
            const isUsable = this.commanderManager.isCardUsableByRoster(card.id, this.commanderRoster);

            const canAdd = remaining > 0 && isUsable;

            const cardContainer = this.createCardDisplay(card, x, y, canAdd);

            // Quantity badge shows remaining copies that can still be added (e.g. \"x2\")
            const qtyText = this.add.text(CARD_WIDTH - 6, CARD_HEIGHT - 6, `x${remaining}`, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '12px',
                color: canAdd ? '#f0dba5' : '#666666',
                fontStyle: 'bold'
            }).setOrigin(1, 1);
            cardContainer.add(qtyText);

            // If no copies remain or card is unusable due to missing commander,
            // visually dim the card.
            if (!canAdd) {
                cardContainer.setAlpha(0.4);
            }

            this.cardGridContainer.add(cardContainer);
        });
    }

    private renderDeck(): void {
        // Clear existing
        this.deckListContainer.removeAll(true);

        const deckSize = this.currentDeck.length;

        // Update count text
        this.deckCountText.setText(`${deckSize}/${MAX_DECK_SIZE}`);
        this.deckCountText.setColor(deckSize <= MAX_DECK_SIZE ? '#8a9cc5' : '#e74c3c');

        // Group cards by name for stacking
        const cardGroups = new Map<string, { card: ICard; count: number }>();
        this.currentDeck.forEach(card => {
            const key = card.name;
            if (cardGroups.has(key)) {
                cardGroups.get(key)!.count++;
            } else {
                cardGroups.set(key, { card, count: 1 });
            }
        });

        const startY = 5;
        const itemHeight = 45;
        let index = 0;

        cardGroups.forEach(({ card, count }) => {
            const y = startY + index * itemHeight + this.deckScrollY;

            const itemContainer = this.add.container(5, y);

            // Background
            const itemBg = this.add.graphics();
            itemBg.fillStyle(0x252836, 0.9);
            itemBg.fillRoundedRect(0, 0, 290, 40, 4);
            itemContainer.add(itemBg);

            // Hover over deck row also shows card detail.
            itemBg.setInteractive(
                new Phaser.Geom.Rectangle(0, 0, 290, 40),
                Phaser.Geom.Rectangle.Contains
            );
            itemBg.on('pointerover', () => this.showHoverCard(card));
            itemBg.on('pointerout', () => this.hideHoverCard());

            // Cost circle
            const costCircle = this.add.circle(25, 20, 14, this.getRarityColor(card.rarity));
            itemContainer.add(costCircle);

            const costText = this.add.text(25, 20, String(card.cost), {
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            itemContainer.add(costText);

            // Card name
            const nameText = this.add.text(50, 12, card.name, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
                color: '#c0c0c0'
            }).setOrigin(0, 0);
            itemContainer.add(nameText);

            // Appearing percentage (chance to draw this card on a single draw)
            if (deckSize > 0) {
                const percent = (count / deckSize) * 100;
                const percentText =
                    percent % 1 === 0 ? `${percent.toFixed(0)}%` : `${percent.toFixed(1)}%`;

                const chanceText = this.add.text(240, 5, percentText, {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '12px',
                    color: '#8a9cc5'
                }).setOrigin(1, 0);
                itemContainer.add(chanceText);
            }

            // Count badge
            if (count > 1) {
                const countBadge = this.add.text(240, 24, `×${count}`, {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '16px',
                    color: '#f0dba5',
                    fontStyle: 'bold'
                }).setOrigin(1, 0.5);
                itemContainer.add(countBadge);
            }

            // Remove button
            const removeBtn = this.add.text(275, 20, '×', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '20px',
                color: '#e74c3c'
            }).setOrigin(0.5);
            removeBtn.setInteractive({ useHandCursor: true });
            
            // Use a stable card key so we always remove one copy of this
            // specific card type from the deck, regardless of runtime id.
            const cardKey = this.getCardKey(card);
            removeBtn.on('pointerup', () => this.removeCardFromDeck(cardKey));
            itemContainer.add(removeBtn);

            this.deckListContainer.add(itemContainer);
            index++;
        });
    }

    private createCardDisplay(card: ICard, x: number, y: number, isClickable: boolean): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        
        // Card background
        const bg = this.add.graphics();
        bg.fillStyle(0x2a2d3a, 1);
        bg.fillRoundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);
        bg.lineStyle(2, this.getRarityColor(card.rarity), 1);
        bg.strokeRoundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);
        container.add(bg);
        
        // Cost circle
        const costCircle = this.add.circle(18, 18, 14, 0x3d4663);
        costCircle.setStrokeStyle(2, this.getRarityColor(card.rarity));
        container.add(costCircle);
        
        const costText = this.add.text(18, 18, String(card.cost), {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#f0dba5',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(costText);
        
        // Card type indicator
        const typeColors: Record<string, number> = {
            unit: 0x3498db,
            spell: 0x9b59b6,
            structure: 0xe67e22,
            module: 0x2ecc71
        };
        const typeColor = typeColors[card.type] ?? 0x888888;
        const typeIndicator = this.add.rectangle(CARD_WIDTH - 15, 15, 20, 20, typeColor, 0.8);
        typeIndicator.setStrokeStyle(1, 0xffffff, 0.3);
        container.add(typeIndicator);
        
        // Card portrait area (scaled to fill ~70% height, keeping padding)
        const portraitAreaHeight = CARD_HEIGHT * 0.7;
        const portraitBg = this.add.rectangle(CARD_WIDTH / 2, 10 + portraitAreaHeight / 2, CARD_WIDTH - 16, portraitAreaHeight, 0x1a1d2e);
        container.add(portraitBg);
        const portraitBounds = { w: CARD_WIDTH - 20, h: portraitAreaHeight - 8 };
        if (card.portraitKey && this.textures.exists(card.portraitKey)) {
            const img = this.add.image(CARD_WIDTH / 2, portraitBg.y, card.portraitKey).setOrigin(0.5);
            const texW = img.width || portraitBounds.w;
            const texH = img.height || portraitBounds.h;
            const scale = Math.min(portraitBounds.w / texW, portraitBounds.h / texH);
            img.setScale(scale);
            container.add(img);
        } else {
            const placeholder = this.add.text(CARD_WIDTH / 2, 60, 'No Art', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '10px',
                color: '#555'
            }).setOrigin(0.5);
            container.add(placeholder);
        }
        
        // Card name (moved below larger portrait)
        const displayName = card.name.length > 16 ? card.name.slice(0, 15) + '...' : card.name;
        const nameText = this.add.text(CARD_WIDTH / 2, 10 + portraitAreaHeight + 4, displayName, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            color: '#c0c0c0',
            align: 'center'
        }).setOrigin(0.5, 0);
        container.add(nameText);
        
        // Card rarity indicator
        const rarityText = card.rarity?.charAt(0).toUpperCase() ?? 'C';
        const rarityLabel = this.add.text(CARD_WIDTH / 2, nameText.y + 16, rarityText, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '11px',
            color: '#8a9cc5'
        }).setOrigin(0.5, 0);
        container.add(rarityLabel);
        
        // Attach input to the card background graphics instead of the container.
        // This avoids any Container-origin quirks and uses a clear 0,0 -> CARD_WIDTH,CARD_HEIGHT rect.
        bg.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT),
            Phaser.Geom.Rectangle.Contains
        );

        bg.on('pointerover', () => {
            container.setScale(1.08);
            container.setDepth(10);
            this.showHoverCard(card);
        });
        
        bg.on('pointerout', () => {
            container.setScale(1);
            container.setDepth(0);
            this.hideHoverCard();
        });
        
        if (isClickable) {
            bg.on('pointerup', () => {
                this.addCardToDeck(card);
            });
        }
        
        return container;
    }
    
    private getRarityColor(rarity?: string): number {
        const colors: Record<string, number> = {
            common: 0x888888,
            rare: 0x3498db,
            epic: 0x9b59b6,
            legendary: 0xf1c40f
        };
        return colors[rarity ?? 'common'] ?? 0x888888;
    }

    private showHoverCard(card: ICard): void {
        if (!this.hoverCardPanel) {
            return;
        }

        // Basic labels
        this.hoverCardNameText.setText(card.name);

        const typeLabel = card.type ? String(card.type).toUpperCase() : '';
        const rarityLabel = card.rarity ? card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1) : 'Common';
        this.hoverCardTypeText.setText(`${typeLabel}  •  ${rarityLabel}`);

        const resourceRaw = card.resourceType ? String(card.resourceType) : '';
        const resourcePretty = resourceRaw
            .toLowerCase()
            .split('_')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
        this.hoverCardCostText.setText(
            resourcePretty ? `Cost: ${card.cost} ${resourcePretty}` : `Cost: ${card.cost}`
        );

        this.hoverCardDescText.setText(card.description || 'No description available yet.');

        // Replace portrait art
        if (this.hoverCardArt) {
            this.hoverCardArt.destroy();
            this.hoverCardArt = undefined;
        }

        const localX = 90;
        const localY = HOVER_PANEL_HEIGHT / 2 + 6;
        const boundsW = 160;
        const boundsH = 260;

        if (card.portraitKey && this.textures.exists(card.portraitKey)) {
            const img = this.add.image(0, 0, card.portraitKey).setOrigin(0.5);
            const texW = img.width || boundsW;
            const texH = img.height || boundsH;
            const scale = Math.min(boundsW / texW, boundsH / texH);
            img.setScale(scale);
            img.x = localX;
            img.y = localY;
            this.hoverCardPanel.add(img);
            this.hoverCardArt = img;
        } else {
            const placeholder = this.add.rectangle(localX, localY, boundsW, boundsH, 0x1a1d2e);
            placeholder.setStrokeStyle(2, this.getRarityColor(card.rarity), 0.9);
            this.hoverCardPanel.add(placeholder);
            this.hoverCardArt = placeholder;
        }

        this.hoverCardPanel.setVisible(true);
    }

    private hideHoverCard(): void {
        if (!this.hoverCardPanel) return;
        this.hoverCardPanel.setVisible(false);
    }
    
    private addCardToDeck(card: ICard): void {
        if (this.currentDeck.length >= MAX_DECK_SIZE) {
            this.showMessage('Deck is full!', '#e74c3c');
            return;
        }

        const key = this.getCardKey(card);
        const limit = this.availableCardLimits.get(key);
        if (limit) {
            const currentCount = this.currentDeck.reduce(
                (acc, c) => (this.getCardKey(c) === key ? acc + 1 : acc),
                0
            );
            if (currentCount >= limit.max) {
                this.showMessage('No more copies of this card are available.', '#e74c3c');
                return;
            }
        }
        
        // Find and add the card (need to add a unique instance)
        const cardCopy = { ...card, id: `${card.id}_${Date.now()}` };
        this.currentDeck.push(cardCopy);
        this.renderDeck();
        this.renderAvailableCards();
        this.showMessage(`Added ${card.name}`, '#2ecc71');
    }

    private removeCardFromDeck(cardKey: string): void {
        // Find the first deck entry whose normalized key matches the row
        // we clicked in the deck list. This avoids accidentally matching
        // other cards that merely share the "card_" prefix.
        const index = this.currentDeck.findIndex(c => this.getCardKey(c) === cardKey);
        if (index !== -1) {
            const removed = this.currentDeck.splice(index, 1)[0];
            this.renderDeck();
            this.renderAvailableCards();
            this.showMessage(`Removed ${removed.name}`, '#e74c3c');
        }
    }

    private showMessage(text: string, color: string): void {
        const { width } = this.cameras.main;
        const msg = this.add.text(width / 2, 820, text, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: color,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100);
        
        this.tweens.add({
            targets: msg,
            alpha: 0,
            y: 800,
            duration: 1000,
            delay: 500,
            onComplete: () => msg.destroy()
        });
    }

    private scrollCardGrid(deltaY: number): void {
        const maxScroll = Math.max(0, Math.ceil(this.availableCards.length / CARDS_PER_ROW) * (CARD_HEIGHT + CARD_GAP) - 600);
        this.cardGridScrollY = Phaser.Math.Clamp(this.cardGridScrollY - deltaY * 0.5, -maxScroll, 0);
        this.renderAvailableCards();
    }

    private scrollDeck(deltaY: number): void {
        const cardGroups = new Map<string, number>();
        this.currentDeck.forEach(card => {
            cardGroups.set(card.name, (cardGroups.get(card.name) ?? 0) + 1);
        });
        const maxScroll = Math.max(0, cardGroups.size * 45 - 550);
        this.deckScrollY = Phaser.Math.Clamp(this.deckScrollY - deltaY * 0.5, -maxScroll, 0);
        this.renderDeck();
    }

    private rebuildAvailableCardLimits(): void {
        this.availableCardLimits.clear();

        this.availableCards.forEach(card => {
            const key = this.getCardKey(card);
            const existing = this.availableCardLimits.get(key);
            if (existing) {
                existing.max += 1;
            } else {
                this.availableCardLimits.set(key, { card, max: 1 });
            }
        });
    }

    private getCardKey(card: ICard): string {
        // Use a stable \"card type\" key:
        // 1) Strip trailing runtime timestamp suffix: _123456789
        // 2) Strip trailing deck index: _1, _2, _3 (so Feral Warrior variants collapse)
        let base = card.id.replace(/_\d+$/, '');
        base = base.replace(/_\d+$/, '');
        return base;
    }

    private onBack(): void {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.time.delayedCall(300, () => {
            if (this.isNewRun) {
                this.scene.start('FactionSelectionScene');
            } else {
                this.scene.start('StageMapScene');
            }
        });
    }

    private onStart(): void {
        // Validate deck
        const validation = this.commanderManager.validateDeck(
            this.currentDeck, 
            this.commanderRoster, 
            MAX_DECK_SIZE
        );
        
        if (!validation.valid) {
            this.showMessage(validation.errors[0], '#e74c3c');
            return;
        }
        
        if (this.isNewRun) {
            // Start new run with selected faction and deck
            this.runManager.startNewRun(this.factionId, 0, this.selectedCommander ?? undefined);
            // Override deck with player's customized deck
            this.runManager.setRunDeck(this.currentDeck);
        } else {
            // Save deck changes
            this.runManager.setRunDeck(this.currentDeck);
        }
        
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.time.delayedCall(400, () => {
            this.scene.start('StageMapScene');
        });
    }
}

