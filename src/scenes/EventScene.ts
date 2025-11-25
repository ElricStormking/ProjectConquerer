import Phaser from 'phaser';
import { DataManager } from '../systems/DataManager';
import { IEventConfig, IEventOption } from '../types/ironwars';

interface EventSceneData {
    eventId?: string;
    onComplete?: (result: { option?: IEventOption }) => void;
}

export class EventScene extends Phaser.Scene {
    private payload!: EventSceneData;
    private eventConfig?: IEventConfig;

    constructor() {
        super({ key: 'EventScene' });
    }

    init(data: EventSceneData): void {
        this.payload = data;
        if (data.eventId) {
            this.eventConfig = DataManager.getInstance().getEventConfig(data.eventId);
        }
    }

    create(): void {
        this.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.8).setOrigin(0).setDepth(0);
        const title = this.eventConfig?.name ?? 'Unknown Event';
        const description = this.eventConfig?.description ?? 'The path ahead is unclear.';

        this.add.text(960, 200, title, {
            fontSize: '48px',
            color: '#ffe9c4',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(960, 320, description, {
            fontSize: '26px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 900 }
        }).setOrigin(0.5);

        const options = this.eventConfig?.options ?? [{ id: 'continue', label: 'Continue', effectId: '' }];
        const spacing = 220;
        const startX = 960 - ((options.length - 1) * spacing) / 2;
        options.forEach((option, index) => {
            const x = startX + index * spacing;
            this.createOptionButton(x, 520, option.label, () => this.finish(option));
        });
    }

    private createOptionButton(x: number, y: number, label: string, onClick: () => void): void {
        const bg = this.add.rectangle(x, y, 260, 120, 0x243145, 0.9)
            .setStrokeStyle(3, 0xffda8f)
            .setOrigin(0.5);
        this.add.text(x, y, label, {
            fontSize: '22px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 220 }
        }).setOrigin(0.5);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x2d3b52));
        bg.on('pointerout', () => bg.setFillStyle(0x243145));
        bg.on('pointerdown', () => {
            this.cameras.main.flash(150, 255, 255, 255);
            onClick();
        });
    }

    private finish(option?: IEventOption): void {
        this.payload.onComplete?.({ option });
    }
}
