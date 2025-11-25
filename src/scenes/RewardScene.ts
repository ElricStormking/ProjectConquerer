import Phaser from 'phaser';
import { ICard, IRelicConfig } from '../types/ironwars';

export interface RewardSceneResult {
    card?: ICard;
    relic?: IRelicConfig;
    goldAwarded?: number;
}

export interface RewardSceneData {
    title?: string;
    subtitle?: string;
    cardChoices?: ICard[];
    relicChoice?: IRelicConfig;
    goldReward?: number;
    onComplete?: (result: RewardSceneResult) => void;
}

export class RewardScene extends Phaser.Scene {
    private sceneData!: RewardSceneData;

    constructor() {
        super({ key: 'RewardScene' });
    }

    init(data: RewardSceneData) {
        this.sceneData = data;
    }

    create(): void {
        this.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.8).setOrigin(0).setDepth(0);
        this.add.text(960, 150, this.sceneData.title ?? 'Choose Your Reward', {
            fontSize: '50px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        if (this.sceneData.subtitle) {
            this.add.text(960, 215, this.sceneData.subtitle, {
                fontSize: '24px',
                color: '#f0d7a5'
            }).setOrigin(0.5);
        }

        const cards = this.sceneData.cardChoices ?? [];
        if (cards.length > 0) {
            this.renderCardChoices(cards);
        }

        if (this.sceneData.goldReward && this.sceneData.goldReward > 0) {
            this.renderGoldReward(this.sceneData.goldReward);
        }

        if (!cards.length && !(this.sceneData.goldReward && this.sceneData.goldReward > 0)) {
            this.createTextButton(960, 540, 'Continue', () => this.finishSelection());
        }
    }

    private renderCardChoices(cards: ICard[]): void {
        const spacing = 320;
        const startX = 960 - ((cards.length - 1) * spacing) / 2;
        cards.forEach((card, index) => {
            const x = startX + index * spacing;
            const container = this.add.container(x, 540);
            const panel = this.add.rectangle(0, 0, 260, 360, 0x1b2235, 0.92)
                .setStrokeStyle(3, 0xf6d75c)
                .setOrigin(0.5);
            const name = this.add.text(0, -130, card.name, {
                fontSize: '24px',
                color: '#ffffff',
                fontStyle: 'bold',
                align: 'center',
                wordWrap: { width: 220 }
            }).setOrigin(0.5);
            const cost = this.add.text(0, -80, `Cost: ${card.cost}`, {
                fontSize: '20px',
                color: '#f6d75c'
            }).setOrigin(0.5);
            const rarity = this.add.text(0, -40, `Rarity: ${(card.rarity ?? 'common').toUpperCase()}`, {
                fontSize: '18px',
                color: '#b5c6ff'
            }).setOrigin(0.5);
            const desc = this.add.text(0, 20, card.description, {
                fontSize: '18px',
                color: '#d6ddf0',
                align: 'center',
                wordWrap: { width: 220 }
            }).setOrigin(0.5);
            container.add([panel, name, cost, rarity, desc]);
            container.setSize(260, 360);
            container.setInteractive(new Phaser.Geom.Rectangle(-130, -180, 260, 360), Phaser.Geom.Rectangle.Contains);
            container.on('pointerover', () => container.setScale(1.03));
            container.on('pointerout', () => container.setScale(1));
            container.on('pointerdown', () => this.finishSelection({ card }));
        });
    }

    private renderGoldReward(amount: number): void {
        this.createTextButton(960, 820, `Collect ${amount} Gold`, () => this.finishSelection({ goldAwarded: amount }));
    }

    private createTextButton(x: number, y: number, label: string, onClick: () => void): void {
        const bg = this.add.rectangle(x, y, 260, 80, 0x2b3a4d, 0.95)
            .setStrokeStyle(3, 0xf6d75c)
            .setOrigin(0.5);
        this.add.text(x, y, label, {
            fontSize: '26px',
            color: '#ffffff'
        }).setOrigin(0.5);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', onClick);
    }

    private finishSelection(result?: RewardSceneResult): void {
        this.sceneData.onComplete?.(result ?? {});
        this.scene.stop();
    }
}
