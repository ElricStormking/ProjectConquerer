import Phaser from 'phaser';

interface RestSceneData {
    healAmount: number;
    onComplete?: (action: 'rest' | 'skip') => void;
}

export class RestScene extends Phaser.Scene {
    private payload!: RestSceneData;

    constructor() {
        super({ key: 'RestScene' });
    }

    init(data: RestSceneData): void {
        this.payload = data;
    }

    create(): void {
        this.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.75).setOrigin(0);
        this.add.text(960, 300, 'Campfire Rest', {
            fontSize: '56px',
            color: '#ffd6a5',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(960, 420, `Resting will heal ${this.payload.healAmount} fortress HP.`, {
            fontSize: '28px',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.createButton(760, 620, 'Rest', () => this.finish('rest'));
        this.createButton(1160, 620, 'Skip', () => this.finish('skip'));
    }

    private createButton(x: number, y: number, label: string, onClick: () => void): void {
        const bg = this.add.rectangle(x, y, 260, 90, 0x2c3b2f, 0.9)
            .setStrokeStyle(3, 0xf0a870)
            .setOrigin(0.5);
        this.add.text(x, y, label, {
            fontSize: '30px',
            color: '#ffffff'
        }).setOrigin(0.5);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => onClick());
    }

    private finish(action: 'rest' | 'skip'): void {
        this.payload.onComplete?.(action);
    }
}
