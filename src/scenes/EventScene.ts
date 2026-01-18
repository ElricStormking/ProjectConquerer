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
    private outcomeActive = false;

    constructor() {
        super({ key: 'EventScene' });
    }

    init(data: EventSceneData): void {
        this.payload = data;
        this.outcomeActive = false;
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
        const spacing = options.length > 2 ? 320 : 300;
        const startX = 960 - ((options.length - 1) * spacing) / 2;
        options.forEach((option, index) => {
            const x = startX + index * spacing;
            const outcome = this.getOptionDescription(option);
            this.createOptionButton(x, 520, option.label, () => this.showOutcome(option, outcome));
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

    private showOutcome(option: IEventOption, detail: string): void {
        if (this.outcomeActive) {
            return;
        }
        this.outcomeActive = true;

        const text = detail || 'You move on.';
        const overlay = this.add.rectangle(0, 0, 1920, 1080, 0x000000, 0.7).setOrigin(0);
        overlay.setDepth(10);
        overlay.setInteractive();

        const panel = this.add.rectangle(960, 520, 520, 240, 0x1b2235, 0.95)
            .setStrokeStyle(3, 0xffda8f)
            .setOrigin(0.5);
        panel.setDepth(11);

        const title = this.add.text(960, 450, 'Outcome', {
            fontSize: '30px',
            color: '#ffe9c4',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        title.setDepth(11);

        const body = this.add.text(960, 520, text, {
            fontSize: '20px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 440 }
        }).setOrigin(0.5);
        body.setDepth(11);

        const btn = this.add.rectangle(960, 610, 200, 50, 0x243145, 0.9)
            .setStrokeStyle(2, 0xffda8f)
            .setOrigin(0.5);
        btn.setDepth(11);
        const btnText = this.add.text(960, 610, 'Continue', {
            fontSize: '18px',
            color: '#ffffff'
        }).setOrigin(0.5);
        btnText.setDepth(11);

        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setFillStyle(0x2d3b52));
        btn.on('pointerout', () => btn.setFillStyle(0x243145));
        btn.on('pointerdown', () => {
            overlay.destroy();
            panel.destroy();
            title.destroy();
            body.destroy();
            btn.destroy();
            btnText.destroy();
            this.finish(option);
        });
    }

    private getOptionDescription(option: IEventOption): string {
        if (option.description) return option.description;
        return this.describeEffect(option.effectId);
    }

    private describeEffect(effectId: string): string {
        if (!effectId) return '';
        const lower = effectId.toLowerCase();
        const toValue = (prefix: string): number => parseInt(lower.replace(prefix, ''), 10) || 0;

        if (lower.startsWith('heal_fortress_')) {
            const value = toValue('heal_fortress_');
            return value > 0 ? `Heal ${value} fortress HP.` : '';
        }
        if (lower.startsWith('lose_fortress_')) {
            const value = toValue('lose_fortress_');
            return value > 0 ? `Lose ${value} fortress HP.` : '';
        }
        if (lower.startsWith('damage_fortress_')) {
            const value = toValue('damage_fortress_');
            return value > 0 ? `Lose ${value} fortress HP.` : '';
        }
        if (lower.startsWith('gain_gold_')) {
            const value = toValue('gain_gold_');
            return value > 0 ? `Gain ${value} gold.` : '';
        }
        if (lower.startsWith('lose_gold_')) {
            const value = toValue('lose_gold_');
            return value > 0 ? `Lose ${value} gold.` : '';
        }
        if (lower.includes('gain_relic_cursed')) return 'Gain 1 cursed relic.';
        if (lower.includes('gain_relic_epic')) return 'Gain 1 epic relic.';
        if (lower.includes('gain_relic_common')) return 'Gain 1 common relic.';
        if (lower.includes('add_card_epic') || lower.includes('gain_card_epic')) return 'Gain 1 epic card.';
        if (lower.includes('add_card_rare') || lower.includes('gain_card_rare')) return 'Gain 1 rare card.';
        if (lower.includes('gain_random_card') || lower.includes('gain_card_common')) return 'Gain 1 common card.';
        if (lower.includes('remove_card') || lower.includes('lose_card')) return 'Lose 1 card from your deck.';
        if (lower.includes('add_curse')) return 'Gain 1 curse relic.';
        return '';
    }

    private finish(option?: IEventOption): void {
        this.payload.onComplete?.({ option });
    }
}
