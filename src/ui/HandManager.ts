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

        // Drag events are emitted from the CardSprite's internal input target
        // (its background rectangle), so subscribe to that object instead of
        // the container itself.
        const inputTarget = sprite.getInputTarget();

        inputTarget.on('dragstart', (_pointer: Phaser.Input.Pointer) => {
            this.draggingCardId = card.id;
            sprite.setDepth(9000);
            sprite.setDragHighlight(true);
            // Shrink card to 1/5 size (0.2 scale) while dragging to reduce visual obstruction
            this.scene.tweens.add({
                targets: sprite,
                scale: 0.3,
                duration: 100,
                ease: 'Sine.easeOut'
            });
            this.battleEvents.emit('ui:card-drag-start', card);
        });

        inputTarget.on('drag', (pointer: Phaser.Input.Pointer) => {
            sprite.x = pointer.x;
            sprite.y = pointer.y;
            this.battleEvents.emit('ui:card-drag', {
                screenX: pointer.x,
                screenY: pointer.y
            });
        });

        inputTarget.on('dragend', (pointer: Phaser.Input.Pointer) => {
            // Prevent duplicate firing if already handling a dragend
            if (!this.draggingCardId) {
                return;
            }
            sprite.setDragHighlight(false);
            // Restore card to normal size
            this.scene.tweens.add({
                targets: sprite,
                scale: 1,
                duration: 100,
                ease: 'Sine.easeOut'
            });
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
