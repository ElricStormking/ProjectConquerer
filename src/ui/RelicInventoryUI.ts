import Phaser from 'phaser';
import { RelicManager } from '../systems/RelicManager';
import { IRelicConfig } from '../types/ironwars';

const ICON_SIZE = 48;
const ICON_SPACING = 8;
const TOOLTIP_WIDTH = 280;
const TOOLTIP_PADDING = 12;

export class RelicInventoryUI {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private relicIcons: Map<string, Phaser.GameObjects.Container> = new Map();
    private tooltip?: Phaser.GameObjects.Container;
    private readonly relicManager = RelicManager.getInstance();

    constructor(scene: Phaser.Scene, x = 1870, y = 60) {
        this.scene = scene;
        this.container = scene.add.container(x, y);
        this.container.setDepth(8000);

        this.relicManager.on('relic-added', (config: IRelicConfig) => this.addRelicIcon(config));
        this.relicManager.on('relic-removed', (config: IRelicConfig) => this.removeRelicIcon(config.id));

        this.refresh();
    }

    public refresh(): void {
        this.relicIcons.forEach((icon, id) => {
            icon.destroy();
            this.relicIcons.delete(id);
        });

        const relics = this.relicManager.getActiveRelics();
        relics.forEach(relic => this.addRelicIcon(relic));
    }

    private addRelicIcon(relic: IRelicConfig): void {
        if (this.relicIcons.has(relic.id)) return;

        const index = this.relicIcons.size;
        const col = index % 4;
        const row = Math.floor(index / 4);
        const x = -(col * (ICON_SIZE + ICON_SPACING));
        const y = row * (ICON_SIZE + ICON_SPACING);

        const iconContainer = this.scene.add.container(x, y);

        const bg = this.scene.add.rectangle(0, 0, ICON_SIZE, ICON_SIZE, this.getRarityColor(relic.rarity), 0.85);
        bg.setStrokeStyle(2, relic.isCursed ? 0xff4444 : 0xffffff, 0.9);
        bg.setOrigin(0.5);

        let icon: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
        const iconKey = relic.iconKey || 'relic_default';
        if (this.scene.textures.exists(iconKey)) {
            icon = this.scene.add.image(0, 0, iconKey);
            icon.setDisplaySize(ICON_SIZE - 8, ICON_SIZE - 8);
        } else {
            const initial = relic.name.charAt(0).toUpperCase();
            icon = this.scene.add.text(0, 0, initial, {
                fontSize: '24px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);
        }

        if (relic.isCursed) {
            const curseMark = this.scene.add.text(ICON_SIZE / 2 - 6, -ICON_SIZE / 2 + 6, '!', {
                fontSize: '16px',
                color: '#ff4444',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            iconContainer.add(curseMark);
        }

        iconContainer.add([bg, icon]);
        iconContainer.setSize(ICON_SIZE, ICON_SIZE);
        iconContainer.setInteractive(new Phaser.Geom.Rectangle(-ICON_SIZE / 2, -ICON_SIZE / 2, ICON_SIZE, ICON_SIZE), Phaser.Geom.Rectangle.Contains);

        iconContainer.on('pointerover', () => {
            bg.setScale(1.1);
            this.showTooltip(relic, iconContainer.x, iconContainer.y);
        });
        iconContainer.on('pointerout', () => {
            bg.setScale(1);
            this.hideTooltip();
        });

        this.container.add(iconContainer);
        this.relicIcons.set(relic.id, iconContainer);
    }

    private removeRelicIcon(relicId: string): void {
        const icon = this.relicIcons.get(relicId);
        if (icon) {
            icon.destroy();
            this.relicIcons.delete(relicId);
            this.repositionIcons();
        }
    }

    private repositionIcons(): void {
        let index = 0;
        this.relicIcons.forEach(iconContainer => {
            const col = index % 4;
            const row = Math.floor(index / 4);
            iconContainer.setPosition(
                -(col * (ICON_SIZE + ICON_SPACING)),
                row * (ICON_SIZE + ICON_SPACING)
            );
            index++;
        });
    }

    private showTooltip(relic: IRelicConfig, iconX: number, iconY: number): void {
        this.hideTooltip();

        const worldX = this.container.x + iconX - TOOLTIP_WIDTH - 20;
        const worldY = this.container.y + iconY;

        this.tooltip = this.scene.add.container(worldX, worldY);
        this.tooltip.setDepth(9500);

        const nameText = this.scene.add.text(TOOLTIP_PADDING, TOOLTIP_PADDING, relic.name, {
            fontSize: '18px',
            color: this.getRarityTextColor(relic.rarity),
            fontStyle: 'bold',
            wordWrap: { width: TOOLTIP_WIDTH - TOOLTIP_PADDING * 2 }
        });

        const rarityText = this.scene.add.text(TOOLTIP_PADDING, nameText.y + nameText.height + 4, 
            `[${relic.rarity.toUpperCase()}]${relic.isCursed ? ' - CURSE' : ''}`, {
            fontSize: '12px',
            color: relic.isCursed ? '#ff6666' : '#aaaaaa'
        });

        const descText = this.scene.add.text(TOOLTIP_PADDING, rarityText.y + rarityText.height + 8, relic.description, {
            fontSize: '14px',
            color: '#dddddd',
            wordWrap: { width: TOOLTIP_WIDTH - TOOLTIP_PADDING * 2 }
        });

        const totalHeight = descText.y + descText.height + TOOLTIP_PADDING;

        const bg = this.scene.add.rectangle(0, 0, TOOLTIP_WIDTH, totalHeight, 0x1a1a2e, 0.95);
        bg.setOrigin(0, 0);
        bg.setStrokeStyle(2, relic.isCursed ? 0xff4444 : this.getRarityColor(relic.rarity), 0.9);

        this.tooltip.add([bg, nameText, rarityText, descText]);

        if (worldY + totalHeight > 1080) {
            this.tooltip.setY(1080 - totalHeight - 10);
        }
    }

    private hideTooltip(): void {
        if (this.tooltip) {
            this.tooltip.destroy();
            this.tooltip = undefined;
        }
    }

    private getRarityColor(rarity: string): number {
        switch (rarity) {
            case 'common': return 0x666666;
            case 'rare': return 0x3366cc;
            case 'epic': return 0x9933cc;
            case 'legendary': return 0xffaa00;
            case 'mythic': return 0xff4488;
            case 'cursed': return 0x880000;
            default: return 0x444444;
        }
    }

    private getRarityTextColor(rarity: string): string {
        switch (rarity) {
            case 'common': return '#cccccc';
            case 'rare': return '#6699ff';
            case 'epic': return '#cc66ff';
            case 'legendary': return '#ffcc00';
            case 'mythic': return '#ff6699';
            case 'cursed': return '#ff4444';
            default: return '#ffffff';
        }
    }

    public destroy(): void {
        this.relicManager.off('relic-added');
        this.relicManager.off('relic-removed');
        this.hideTooltip();
        this.container.destroy();
    }
}
