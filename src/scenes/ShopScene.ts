import Phaser from 'phaser';
import { ICard, IRelicConfig } from '../types/ironwars';

interface ShopSceneData {
    inventory: {
        cards: Array<{ card: ICard; cost: number }>;
        relic?: { relic: IRelicConfig; cost: number };
    };
    currentGold: number;
    curses?: IRelicConfig[];
    curseRemovalCost?: number;
    onComplete?: (result: { purchasedCards: ICard[]; purchasedRelic?: IRelicConfig; removedCurses: string[]; goldSpent: number }) => void;
}

export class ShopScene extends Phaser.Scene {
    private payload!: ShopSceneData;
    private goldText?: Phaser.GameObjects.Text;
    private remainingGold = 0;
    private purchasedCards: ICard[] = [];
    private purchasedRelic?: IRelicConfig;
    private removedCurses: string[] = [];

    constructor() {
        super({ key: 'ShopScene' });
    }

    init(data: ShopSceneData): void {
        this.payload = data;
        this.remainingGold = data.currentGold;
        this.purchasedCards = [];
        this.purchasedRelic = undefined;
        this.removedCurses = [];
    }

    create(): void {
        this.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.82).setOrigin(0);
        this.add.text(960, 120, 'Skyway Emporium', {
            fontSize: '52px',
            color: '#ffd19a',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.goldText = this.add.text(960, 190, `Gold: ${this.remainingGold}`, {
            fontSize: '32px',
            color: '#fff4cf'
        }).setOrigin(0.5);

        const spacing = 260;
        const startX = 960 - ((this.payload.inventory.cards.length - 1) * spacing) / 2;
        this.payload.inventory.cards.forEach((entry, index) => {
            const x = startX + index * spacing;
            this.createCardListing(x, 420, entry.card, entry.cost);
        });

        if (this.payload.inventory.relic) {
            this.createRelicListing(960, 650, this.payload.inventory.relic.relic, this.payload.inventory.relic.cost);
        }

        const curses = this.payload.curses || [];
        if (curses.length > 0) {
            this.createCurseRemovalSection(960, 850, curses, this.payload.curseRemovalCost || 100);
        }

        this.createButton(1720, 960, 'Leave Shop', () => this.finish());
    }

    private createCardListing(x: number, y: number, card: ICard, cost: number): void {
        const container = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 220, 200, 0x1f2b3a, 0.9)
            .setStrokeStyle(3, 0x6cd3ff)
            .setOrigin(0.5);
        const title = this.add.text(0, -40, card.name, {
            fontSize: '22px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 180 }
        }).setOrigin(0.5);
        const rarity = this.add.text(0, 10, `${card.rarity ?? 'common'}`.toUpperCase(), {
            fontSize: '18px',
            color: '#f4c95d'
        }).setOrigin(0.5);
        const costText = this.add.text(0, 60, `${cost} gold`, {
            fontSize: '20px',
            color: '#ffefad'
        }).setOrigin(0.5);
        container.add([bg, title, rarity, costText]);

        // Interactive on the background rect instead of the container
        bg.setInteractive(
            new Phaser.Geom.Rectangle(-110, -100, 220, 200),
            Phaser.Geom.Rectangle.Contains
        );
        bg.on('pointerover', () => container.setScale(1.05));
        bg.on('pointerout', () => container.setScale(1));
        bg.on('pointerdown', () => {
            if (this.remainingGold < cost) return;
            this.remainingGold -= cost;
            this.purchasedCards.push(card);
            this.goldText?.setText(`Gold: ${this.remainingGold}`);
            container.disableInteractive();
            container.setAlpha(0.4);
        });
    }

    private createRelicListing(x: number, y: number, relic: IRelicConfig, cost: number): void {
        const container = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 420, 180, 0x2a1e2f, 0.92)
            .setStrokeStyle(3, 0xffa5d8)
            .setOrigin(0.5);
        const title = this.add.text(0, -40, relic.name, {
            fontSize: '26px',
            color: '#ffe5ff'
        }).setOrigin(0.5);
        const description = this.add.text(0, 10, relic.description, {
            fontSize: '20px',
            color: '#fbe5ff',
            align: 'center',
            wordWrap: { width: 360 }
        }).setOrigin(0.5);
        const costText = this.add.text(0, 60, `${cost} gold`, {
            fontSize: '22px',
            color: '#ffefad'
        }).setOrigin(0.5);
        container.add([bg, title, description, costText]);

        // Interactive on relic background
        bg.setInteractive(
            new Phaser.Geom.Rectangle(-210, -90, 420, 180),
            Phaser.Geom.Rectangle.Contains
        );
        bg.on('pointerdown', () => {
            if (this.remainingGold < cost || this.purchasedRelic) return;
            this.remainingGold -= cost;
            this.purchasedRelic = relic;
            this.goldText?.setText(`Gold: ${this.remainingGold}`);
            container.disableInteractive();
            container.setAlpha(0.4);
        });
    }

    private createCurseRemovalSection(x: number, y: number, curses: IRelicConfig[], cost: number): void {
        this.add.text(x, y - 50, 'Remove a Curse', {
            fontSize: '24px',
            color: '#ff8888',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const spacing = 200;
        const startX = x - ((curses.length - 1) * spacing) / 2;

        curses.forEach((curse, index) => {
            const cx = startX + index * spacing;
            this.createCurseRemovalListing(cx, y + 30, curse, cost);
        });
    }

    private createCurseRemovalListing(x: number, y: number, curse: IRelicConfig, cost: number): void {
        const container = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 180, 120, 0x3a1e1e, 0.92)
            .setStrokeStyle(2, 0xff6666)
            .setOrigin(0.5);
        const title = this.add.text(0, -30, curse.name, {
            fontSize: '16px',
            color: '#ff8888',
            align: 'center',
            wordWrap: { width: 160 }
        }).setOrigin(0.5);
        const costText = this.add.text(0, 10, `Remove: ${cost}g`, {
            fontSize: '16px',
            color: '#ffcccc'
        }).setOrigin(0.5);
        const removeLabel = this.add.text(0, 40, '[REMOVE]', {
            fontSize: '14px',
            color: '#66ff66'
        }).setOrigin(0.5);
        container.add([bg, title, costText, removeLabel]);

        // Interactive on curse background
        bg.setInteractive(
            new Phaser.Geom.Rectangle(-90, -60, 180, 120),
            Phaser.Geom.Rectangle.Contains
        );
        bg.on('pointerover', () => container.setScale(1.05));
        bg.on('pointerout', () => container.setScale(1));
        bg.on('pointerdown', () => {
            if (this.remainingGold < cost) return;
            if (this.removedCurses.includes(curse.id)) return;
            this.remainingGold -= cost;
            this.removedCurses.push(curse.id);
            this.goldText?.setText(`Gold: ${this.remainingGold}`);
            container.disableInteractive();
            container.setAlpha(0.4);
            removeLabel.setText('[REMOVED]');
            removeLabel.setColor('#888888');
        });
    }

    private createButton(x: number, y: number, label: string, onClick: () => void): void {
        const bg = this.add.rectangle(x, y, 220, 72, 0x233040, 0.95)
            .setStrokeStyle(3, 0xf6d75c)
            .setOrigin(0.5);
        this.add.text(x, y, label, {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => onClick());
    }

    private finish(): void {
        const spent = (this.payload.currentGold - this.remainingGold);
        this.payload.onComplete?.({
            purchasedCards: this.purchasedCards,
            purchasedRelic: this.purchasedRelic,
            removedCurses: this.removedCurses,
            goldSpent: Math.max(0, spent)
        });
    }
}
