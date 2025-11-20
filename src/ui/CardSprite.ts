import Phaser from 'phaser';
import { ICard } from '../types/ironwars';

export class CardSprite extends Phaser.GameObjects.Container {
    private background: Phaser.GameObjects.Rectangle;
    private portrait: Phaser.GameObjects.Rectangle;
    private nameText: Phaser.GameObjects.Text;
    private descText: Phaser.GameObjects.Text;
    private costText: Phaser.GameObjects.Text;
    private rarityBorder: Phaser.GameObjects.Rectangle;
    private readonly card: ICard;

    constructor(scene: Phaser.Scene, card: ICard) {
        super(scene, 0, 0);
        this.card = card;
        this.setSize(220, 320);

        const colors = this.getRarityColors(card.rarity ?? 'common');
        this.background = scene.add.rectangle(0, 0, 220, 320, 0x11131a, 0.95).setOrigin(0.5);
        this.rarityBorder = scene.add.rectangle(0, 0, 220, 320).setStrokeStyle(2, colors.border, 0.8).setOrigin(0.5);
        this.portrait = scene.add.rectangle(0, -80, 160, 120, colors.portrait).setOrigin(0.5);
        this.nameText = scene.add.text(0, 20, card.name, {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.descText = scene.add.text(-90, 50, card.description, {
            fontSize: '16px',
            color: '#b8c2d3',
            wordWrap: { width: 180 }
        }).setOrigin(0, 0);
        this.costText = scene.add.text(-95, -130, card.cost.toString(), {
            fontSize: '26px',
            color: '#ffffff'
        }).setOrigin(0.5);

        const costBadge = scene.add.circle(-95, -130, 24, colors.border, 0.85);
        costBadge.setStrokeStyle(2, 0xffffff, 0.8);
        this.costText.setDepth(2);

        this.add([this.background, this.rarityBorder, this.portrait, costBadge, this.costText, this.nameText, this.descText]);

        this.setInteractive(new Phaser.Geom.Rectangle(-110, -160, 220, 320), Phaser.Geom.Rectangle.Contains);
        this.scene.input.setDraggable(this);
        this.setupHover();
    }

    public getCard(): ICard {
        return this.card;
    }

    private setupHover() {
        this.on('pointerover', () => {
            this.scene.tweens.add({ targets: this, scale: 1.05, duration: 120 });
        });
        this.on('pointerout', () => {
            this.scene.tweens.add({ targets: this, scale: 1, duration: 120 });
        });
    }

    private getRarityColors(rarity: NonNullable<ICard['rarity']>) {
        switch (rarity) {
            case 'rare':
                return { border: 0x4db8ff, portrait: 0x1e4fa1 };
            case 'epic':
                return { border: 0xbf7bff, portrait: 0x432167 };
            case 'legendary':
                return { border: 0xffc857, portrait: 0x8c5316 };
            default:
                return { border: 0xb5bac9, portrait: 0x2c3348 };
        }
    }
}
