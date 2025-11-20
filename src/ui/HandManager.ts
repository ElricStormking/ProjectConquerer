import Phaser from 'phaser';
import { ICard } from '../types/ironwars';
import { CardSprite } from './CardSprite';

interface PlacementResult {
    cardId: string;
    success: boolean;
}

export class HandManager {
    private scene: Phaser.Scene;
    private battleEvents: Phaser.Events.EventEmitter;
    private cards: CardSprite[] = [];
    private layoutCache: Map<string, { x: number; y: number; rotation: number }> = new Map();
    private draggingCardId?: string;
    private readonly baseY = 930;

    constructor(scene: Phaser.Scene, battleEvents: Phaser.Events.EventEmitter) {
        this.scene = scene;
        this.battleEvents = battleEvents;
        this.battleEvents.on('card-placement-result', (payload: PlacementResult) => this.handlePlacementResult(payload));
    }

    public setCards(cards: ICard[]) {
        this.destroyCurrentCards();
        this.layoutCache.clear();
        this.cards = cards.map(card => this.createCard(card));
        this.layoutCards();
    }

    private createCard(card: ICard): CardSprite {
        const sprite = new CardSprite(this.scene, card);
        this.scene.add.existing(sprite);
        sprite.setDepth(7000 + this.cards.length);

        sprite.on('dragstart', (_pointer: Phaser.Input.Pointer) => {
            this.draggingCardId = card.id;
            sprite.setDepth(9000);
            this.battleEvents.emit('ui:card-drag-start', card);
        });

        sprite.on('drag', (pointer: Phaser.Input.Pointer) => {
            sprite.x = pointer.x;
            sprite.y = pointer.y;
        });

        sprite.on('dragend', (pointer: Phaser.Input.Pointer) => {
            this.battleEvents.emit('ui:card-drag-end');
            this.battleEvents.emit('ui:card-play', {
                card,
                screenX: pointer.x,
                screenY: pointer.y
            });
        });

        return sprite;
    }

    private layoutCards() {
        const count = this.cards.length;
        if (count === 0) {
            return;
        }
        const cameraWidth = this.scene.cameras.main.width;
        const cardWidth = 220;
        const gap = 20;
        const step = cardWidth + gap; // ensure no overlap
        const totalWidth = step * (count - 1) + cardWidth;
        const startX = (cameraWidth - totalWidth) / 2 + cardWidth / 2;

        this.cards.forEach((cardSprite, index) => {
            const targetX = startX + index * step;
            const targetY = this.baseY;
            cardSprite.x = targetX;
            cardSprite.y = targetY;
            cardSprite.setRotation(0);
            this.layoutCache.set(cardSprite.getCard().id, {
                x: targetX,
                y: targetY,
                rotation: 0
            });
        });
    }

    private handlePlacementResult(payload: PlacementResult) {
        if (payload.success) {
            this.draggingCardId = undefined;
            return;
        }
        if (!this.draggingCardId || this.draggingCardId !== payload.cardId) {
            return;
        }
        const cardSprite = this.cards.find(c => c.getCard().id === payload.cardId);
        if (!cardSprite) {
            return;
        }
        const cached = this.layoutCache.get(payload.cardId);
        if (!cached) {
            return;
        }
        this.scene.tweens.add({
            targets: cardSprite,
            x: cached.x,
            y: cached.y,
            rotation: cached.rotation,
            duration: 150,
            ease: 'Sine.easeOut'
        });
        this.draggingCardId = undefined;
    }

    private destroyCurrentCards() {
        this.cards.forEach(card => card.destroy());
        this.cards = [];
    }
}
