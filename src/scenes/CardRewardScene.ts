import Phaser from 'phaser';
import { ICard } from '../types/ironwars';
import { CardSprite } from '../ui/CardSprite';
import { DataManager } from '../systems/DataManager';

type WeightedCardEntry = {
    template: ICard;
    weight: number;
};

export class CardRewardScene extends Phaser.Scene {
    private cardOptions: ICard[] = [];
    private cardSprites: CardSprite[] = [];
    private overlay?: Phaser.GameObjects.Rectangle;
    private titleText?: Phaser.GameObjects.Text;
    private instructionText?: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'CardRewardScene' });
    }

    /**
     * Show a \"New Reinforcement\" selection drawn from the player's deck.
     * The probability of each card type appearing is proportional to its count in the deck.
     */
    public showCardReward(deckPool: ICard[], onCardSelected: (card: ICard) => void): void {
        console.log('[CardRewardScene] showCardReward (New Reinforcement) called with deck size:', deckPool.length);
        this.cardOptions = this.generateCardOptionsFromDeck(deckPool, 3);
        this.createRewardUI(onCardSelected);
    }

    /**
     * Generate N card options sampled from the current deck composition.
     * Distribution: weight of each card type = number of copies of that type in the deck.
     */
    private generateCardOptionsFromDeck(deckPool: ICard[], count: number): ICard[] {
        const dataManager = DataManager.getInstance();

        // Build weighted entries by base card id
        const weightMap = new Map<string, WeightedCardEntry>();

        deckPool.forEach(card => {
            const key = this.getCardKey(card.id);
            const existing = weightMap.get(key);
            if (existing) {
                existing.weight += 1;
            } else {
                const template = dataManager.getCard(key) ?? card;
                weightMap.set(key, { template, weight: 1 });
            }
        });

        const entries = Array.from(weightMap.values());
        if (entries.length === 0) {
            console.warn('[CardRewardScene] Deck pool is empty, no reward options available.');
            return [];
        }

        const options: ICard[] = [];
        for (let i = 0; i < count; i++) {
            options.push({ ...this.weightedPick(entries) });
        }
        return options;
    }

    private weightedPick(entries: WeightedCardEntry[]): ICard {
        const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
        let r = Math.random() * totalWeight;
        for (const entry of entries) {
            if (r < entry.weight) {
                return entry.template;
            }
            r -= entry.weight;
        }
        return entries[entries.length - 1].template;
    }

    private getCardKey(id: string): string {
        // Normalize runtime copies like `card_railgunner_1_1717358234123` back to base id
        let base = id.replace(/_\d+$/, '');
        base = base.replace(/_\d+$/, '');
        return base;
    }

    private createRewardUI(onCardSelected: (card: ICard) => void): void {
        console.log('[CardRewardScene] createRewardUI - options:', this.cardOptions.length);
        // Semi-transparent overlay
        this.overlay = this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.85);
        this.overlay.setDepth(9000);

        // Title
        this.titleText = this.add.text(960, 200, 'New Reinforcements', {
            fontSize: '48px',
            color: '#ffffff',
            fontStyle: 'bold',
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5);
        this.titleText.setDepth(9001);

        // Instruction
        this.instructionText = this.add.text(960, 270, 'Select one reinforcement card from your deck', {
            fontSize: '24px',
            color: '#b8c2d3',
            fontStyle: 'italic'
        }).setOrigin(0.5);
        this.instructionText.setDepth(9001);

        // Create card displays
        const startX = 960 - (this.cardOptions.length - 1) * 140;
        this.cardOptions.forEach((card, index) => {
            const x = startX + index * 280;
            const y = 540;
            
            const cardSprite = new CardSprite(this, card);
            this.add.existing(cardSprite); // CRITICAL: Add to scene's display list
            cardSprite.setPosition(x, y);
            cardSprite.setDepth(9002);
            cardSprite.setScale(1.2);
            
            // Add glow effect
            const glow = this.add.rectangle(x, y, 240, 350, 0xffffff, 0.15);
            glow.setDepth(9001);
            glow.setVisible(false);

            // Use the CardSprite's internal input target so hit area matches
            // the visual card bounds (background rect).
            cardSprite.removeAllListeners();
            const inputTarget = cardSprite.getInputTarget();

            inputTarget.on('pointerover', () => {
                this.tweens.add({
                    targets: cardSprite,
                    scale: 1.35,
                    duration: 150,
                    ease: 'Back.easeOut'
                });
                glow.setVisible(true);
                this.tweens.add({
                    targets: glow,
                    alpha: 0.3,
                    duration: 150
                });
            });

            inputTarget.on('pointerout', () => {
                this.tweens.add({
                    targets: cardSprite,
                    scale: 1.2,
                    duration: 150
                });
                glow.setVisible(false);
            });

            inputTarget.on('pointerdown', () => {
                // Flash effect
                this.cameras.main.flash(200, 255, 255, 255, false);
                
                // Play selection animation
                this.tweens.add({
                    targets: cardSprite,
                    scale: 1.5,
                    alpha: 0,
                    duration: 300,
                    ease: 'Back.easeIn',
                    onComplete: () => {
                        this.cleanupRewardUI();
                        onCardSelected(card);
                    }
                });

                // Fade out other cards
                this.cardSprites.forEach((otherSprite, otherIndex) => {
                    if (otherIndex !== index) {
                        this.tweens.add({
                            targets: otherSprite,
                            alpha: 0,
                            duration: 200
                        });
                    }
                });

                // Fade out UI text
                this.tweens.add({
                    targets: [this.titleText, this.instructionText],
                    alpha: 0,
                    duration: 200
                });
            });

            this.cardSprites.push(cardSprite);
            
            // Animate cards in with staggered timing
            cardSprite.setAlpha(0);
            cardSprite.setScale(0);
            this.tweens.add({
                targets: cardSprite,
                alpha: 1,
                scale: 1.2,
                duration: 400,
                delay: index * 100,
                ease: 'Back.easeOut'
            });
        });
    }

    private cleanupRewardUI(): void {
        this.overlay?.destroy();
        this.titleText?.destroy();
        this.instructionText?.destroy();
        this.cardSprites.forEach(sprite => sprite.destroy());
        this.cardSprites = [];
        this.cardOptions = [];
    }
}
