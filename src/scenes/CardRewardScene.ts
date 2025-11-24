import Phaser from 'phaser';
import { ICard } from '../types/ironwars';
import { CardSprite } from '../ui/CardSprite';
import { COG_DOMINION_STARTER } from '../data/ironwars/cog_dominion_starter';

export class CardRewardScene extends Phaser.Scene {
    private cardOptions: ICard[] = [];
    private cardSprites: CardSprite[] = [];
    private overlay?: Phaser.GameObjects.Rectangle;
    private titleText?: Phaser.GameObjects.Text;
    private instructionText?: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'CardRewardScene' });
    }

    public showCardReward(onCardSelected: (card: ICard) => void): void {
        // Generate 3 random card options from the deck
        this.cardOptions = this.generateCardOptions(3);
        this.createRewardUI(onCardSelected);
    }

    private generateCardOptions(count: number): ICard[] {
        const allCards = COG_DOMINION_STARTER.deck;
        const options: ICard[] = [];
        
        // Create a shuffled copy of all available cards
        const shuffled = [...allCards].sort(() => Math.random() - 0.5);
        
        // Take the first 'count' cards
        for (let i = 0; i < Math.min(count, shuffled.length); i++) {
            options.push(shuffled[i]);
        }
        
        return options;
    }

    private createRewardUI(onCardSelected: (card: ICard) => void): void {
        // Semi-transparent overlay
        this.overlay = this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.85);
        this.overlay.setDepth(9000);

        // Title
        this.titleText = this.add.text(960, 200, 'Choose Your Reward', {
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
        this.instructionText = this.add.text(960, 270, 'Select one card to add to your deck', {
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

            // Make it interactive
            cardSprite.removeAllListeners();
            cardSprite.setInteractive(
                new Phaser.Geom.Rectangle(-110, -160, 220, 320),
                Phaser.Geom.Rectangle.Contains
            );

            cardSprite.on('pointerover', () => {
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

            cardSprite.on('pointerout', () => {
                this.tweens.add({
                    targets: cardSprite,
                    scale: 1.2,
                    duration: 150
                });
                glow.setVisible(false);
            });

            cardSprite.on('pointerdown', () => {
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
