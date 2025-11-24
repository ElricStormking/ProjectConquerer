import Phaser from 'phaser';
import { ICard, IDeckState } from '../types/ironwars';

export class DeckSystem extends Phaser.Events.EventEmitter {
    private drawPile: ICard[] = [];
    private discardPile: ICard[] = [];
    private hand: ICard[] = [];
    private readonly maxHandSize: number;

    constructor(maxHandSize = 7) {
        super();
        this.maxHandSize = maxHandSize;
    }

    public reset(deck: ICard[]): void {
        this.drawPile = [...deck];
        this.discardPile = [];
        this.hand = [];
        this.shuffle();
        this.emitState();
    }

    public getState(): IDeckState {
        return {
            drawPile: [...this.drawPile],
            discardPile: [...this.discardPile],
            hand: [...this.hand],
            maxHandSize: this.maxHandSize
        };
    }

    public shuffle(): void {
        for (let i = this.drawPile.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
        }
    }

    public draw(count = 1): ICard[] {
        const drawn: ICard[] = [];
        for (let i = 0; i < count; i++) {
            if (this.hand.length >= this.maxHandSize) break;
            if (this.drawPile.length === 0) {
                if (this.discardPile.length === 0) break;
                this.drawPile = [...this.discardPile];
                this.discardPile = [];
                this.shuffle();
            }
            const card = this.drawPile.shift();
            if (!card) break;
            this.hand.push(card);
            drawn.push(card);
            this.emit('card-drawn', card);
        }
        if (drawn.length > 0) {
            this.emitState();
        }
        return drawn;
    }

    public discard(cardId: string): void {
        const index = this.hand.findIndex(card => card.id === cardId);
        if (index === -1) return;
        const [card] = this.hand.splice(index, 1);
        this.discardPile.push(card);
        this.emitState();
    }

    public removeFromHand(cardId: string): ICard | undefined {
        const index = this.hand.findIndex(card => card.id === cardId);
        if (index === -1) return undefined;
        const [card] = this.hand.splice(index, 1);
        this.emitState();
        return card;
    }

    public returnToHand(card: ICard): void {
        if (this.hand.length >= this.maxHandSize) {
            this.discardPile.push(card);
        } else {
            this.hand.push(card);
        }
        this.emitState();
    }

    public addCard(card: ICard): void {
        // Add card directly to hand if there's space, otherwise to draw pile
        if (this.hand.length < this.maxHandSize) {
            this.hand.push(card);
            this.emit('card-drawn', card);
        } else {
            this.drawPile.push(card);
        }
        this.emitState();
    }

    private emitState(): void {
        this.emit('deck-state-changed', this.getState());
        this.emit('hand-updated', { hand: [...this.hand] });
    }
}
