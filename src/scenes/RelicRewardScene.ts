import Phaser from 'phaser';
import { IRelicConfig } from '../types/ironwars';
import { RelicManager } from '../systems/RelicManager';

export interface RelicRewardSceneData {
    title?: string;
    subtitle?: string;
    relicChoices: IRelicConfig[];
    allowSkip?: boolean;
    onComplete?: (selectedRelic: IRelicConfig | null) => void;
}

export class RelicRewardScene extends Phaser.Scene {
    private sceneData!: RelicRewardSceneData;
    private readonly relicManager = RelicManager.getInstance();

    constructor() {
        super({ key: 'RelicRewardScene' });
    }

    init(data: RelicRewardSceneData): void {
        this.sceneData = data;
    }

    create(): void {
        this.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.85).setOrigin(0).setDepth(0);

        this.add.text(960, 120, this.sceneData.title ?? 'Choose a Relic', {
            fontSize: '48px',
            color: '#ffd700',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        if (this.sceneData.subtitle) {
            this.add.text(960, 180, this.sceneData.subtitle, {
                fontSize: '22px',
                color: '#cccccc'
            }).setOrigin(0.5);
        }

        const relics = this.sceneData.relicChoices;
        const spacing = 340;
        const startX = 960 - ((relics.length - 1) * spacing) / 2;

        relics.forEach((relic, index) => {
            const x = startX + index * spacing;
            this.createRelicCard(x, 480, relic);
        });

        if (this.sceneData.allowSkip !== false) {
            this.createSkipButton(960, 820);
        }
    }

    private createRelicCard(x: number, y: number, relic: IRelicConfig): void {
        const container = this.add.container(x, y);
        const cardWidth = 280;
        const cardHeight = 380;

        const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x1b1b2f, 0.95);
        bg.setStrokeStyle(3, this.getRarityColor(relic.rarity), 1);
        bg.setOrigin(0.5);

        const iconSize = 80;
        const iconBg = this.add.rectangle(0, -120, iconSize, iconSize, this.getRarityColor(relic.rarity), 0.7);
        iconBg.setStrokeStyle(2, 0xffffff, 0.5);

        let iconDisplay: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
        const iconKey = relic.iconKey || 'relic_default';
        if (this.textures.exists(iconKey)) {
            iconDisplay = this.add.image(0, -120, iconKey);
            iconDisplay.setDisplaySize(iconSize - 16, iconSize - 16);
        } else {
            iconDisplay = this.add.text(0, -120, relic.name.charAt(0).toUpperCase(), {
                fontSize: '36px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);
        }

        const nameText = this.add.text(0, -50, relic.name, {
            fontSize: '22px',
            color: this.getRarityTextColor(relic.rarity),
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: cardWidth - 30 }
        }).setOrigin(0.5);

        const rarityLabel = `[${relic.rarity.toUpperCase()}]${relic.isCursed ? ' CURSE' : ''}`;
        const rarityText = this.add.text(0, -15, rarityLabel, {
            fontSize: '14px',
            color: relic.isCursed ? '#ff6666' : '#888888'
        }).setOrigin(0.5);

        const descText = this.add.text(0, 60, relic.description, {
            fontSize: '16px',
            color: '#dddddd',
            align: 'center',
            wordWrap: { width: cardWidth - 40 }
        }).setOrigin(0.5);

        if (relic.isCursed) {
            const warningText = this.add.text(0, 150, '⚠ This is a curse!', {
                fontSize: '14px',
                color: '#ff4444'
            }).setOrigin(0.5);
            container.add(warningText);
        }

        container.add([bg, iconBg, iconDisplay, nameText, rarityText, descText]);
        container.setSize(cardWidth, cardHeight);
        container.setInteractive(new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains);

        container.on('pointerover', () => {
            container.setScale(1.05);
            bg.setFillStyle(0x2a2a4a, 0.98);
        });
        container.on('pointerout', () => {
            container.setScale(1);
            bg.setFillStyle(0x1b1b2f, 0.95);
        });
        container.on('pointerdown', () => {
            this.selectRelic(relic);
        });
    }

    private createSkipButton(x: number, y: number): void {
        const btn = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 200, 50, 0x333344, 0.9);
        bg.setStrokeStyle(2, 0x666666, 0.8);
        const label = this.add.text(0, 0, 'Skip Reward', {
            fontSize: '20px',
            color: '#aaaaaa'
        }).setOrigin(0.5);
        btn.add([bg, label]);
        btn.setSize(200, 50);
        btn.setInteractive(new Phaser.Geom.Rectangle(-100, -25, 200, 50), Phaser.Geom.Rectangle.Contains);
        btn.on('pointerover', () => bg.setFillStyle(0x444455, 0.95));
        btn.on('pointerout', () => bg.setFillStyle(0x333344, 0.9));
        btn.on('pointerdown', () => this.finishSelection(null));
    }

    private selectRelic(relic: IRelicConfig): void {
        this.relicManager.addRelic(relic.id);
        this.finishSelection(relic);
    }

    private finishSelection(relic: IRelicConfig | null): void {
        this.sceneData.onComplete?.(relic);
        this.scene.stop();
    }

    private getRarityColor(rarity: string): number {
        switch (rarity) {
            case 'common': return 0x888888;
            case 'rare': return 0x4488ff;
            case 'epic': return 0xaa55ff;
            case 'legendary': return 0xffaa00;
            case 'mythic': return 0xff55aa;
            case 'cursed': return 0xcc2222;
            default: return 0x666666;
        }
    }

    private getRarityTextColor(rarity: string): string {
        switch (rarity) {
            case 'common': return '#cccccc';
            case 'rare': return '#66aaff';
            case 'epic': return '#cc88ff';
            case 'legendary': return '#ffcc44';
            case 'mythic': return '#ff88cc';
            case 'cursed': return '#ff6666';
            default: return '#ffffff';
        }
    }

    public showRelicReward(
        relicChoices: IRelicConfig[],
        onComplete: (selectedRelic: IRelicConfig | null) => void,
        title?: string,
        subtitle?: string
    ): void {
        this.sceneData = {
            title: title ?? 'Choose a Relic',
            subtitle,
            relicChoices,
            allowSkip: true,
            onComplete
        };
        this.scene.restart(this.sceneData);
    }
}
