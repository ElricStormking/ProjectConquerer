import Phaser from 'phaser';
import { BattlePhase, IDeckState, IGameState, IStarterData } from '../types/ironwars';

export class GameStateManager extends Phaser.Events.EventEmitter {
    private static instance: GameStateManager;
    private state: IGameState;
    private starterData?: IStarterData;

    private constructor() {
        super();
        this.state = {
            fortressHp: 0,
            fortressMaxHp: 0,
            currentWave: 0,
            phase: 'PREPARATION',
            gold: 0,
            factionResource: 0,
            drawPile: [],
            hand: [],
            discardPile: []
        };
    }

    public static getInstance(): GameStateManager {
        if (!GameStateManager.instance) {
            GameStateManager.instance = new GameStateManager();
        }
        return GameStateManager.instance;
    }

    public initialize(starterData: IStarterData, startingGold = 10, startingResource = 12): void {
        this.starterData = starterData;
        this.state = {
            fortressHp: starterData.fortress.maxHp,
            fortressMaxHp: starterData.fortress.maxHp,
            currentWave: 0,
            phase: 'PREPARATION',
            gold: startingGold,
            factionResource: startingResource,
            drawPile: [...starterData.deck],
            hand: [],
            discardPile: []
        };
        this.emitState();
    }

    public getStarterData(): IStarterData | undefined {
        return this.starterData;
    }

    public getState(): IGameState {
        return {
            fortressHp: this.state.fortressHp,
            fortressMaxHp: this.state.fortressMaxHp,
            currentWave: this.state.currentWave,
            phase: this.state.phase,
            gold: this.state.gold,
            factionResource: this.state.factionResource,
            drawPile: [...this.state.drawPile],
            hand: [...this.state.hand],
            discardPile: [...this.state.discardPile]
        };
    }

    public setDeckState(deckState: IDeckState): void {
        this.state.drawPile = [...deckState.drawPile];
        this.state.hand = [...deckState.hand];
        this.state.discardPile = [...deckState.discardPile];
        this.emit('hand-updated', { hand: [...this.state.hand] });
        this.emit('deck-updated', this.getDeckCounts());
        this.emitState();
    }

    public setPhase(phase: BattlePhase): void {
        if (this.state.phase === phase) return;
        this.state.phase = phase;
        this.emit('phase-changed', phase);
        this.emitState();
    }

    public spendResource(amount: number): boolean {
        if (this.state.factionResource < amount) {
            return false;
        }
        this.state.factionResource -= amount;
        this.emit('resource-changed', this.state.factionResource);
        this.emitState();
        return true;
    }

    public gainResource(amount: number): void {
        this.state.factionResource += amount;
        this.emit('resource-changed', this.state.factionResource);
        this.emitState();
    }

    public takeFortressDamage(amount: number): void {
        this.state.fortressHp = Math.max(0, this.state.fortressHp - amount);
        this.emit('fortress-damaged', {
            hp: this.state.fortressHp,
            max: this.state.fortressMaxHp
        });
        if (this.state.fortressHp <= 0) {
            this.emit('fortress-destroyed');
        }
        this.emitState();
    }

    public healFortress(amount: number): void {
        this.state.fortressHp = Math.min(this.state.fortressMaxHp, this.state.fortressHp + amount);
        this.emit('fortress-damaged', {
            hp: this.state.fortressHp,
            max: this.state.fortressMaxHp
        });
        this.emitState();
    }

    public advanceWave(): void {
        this.state.currentWave += 1;
        this.emit('wave-changed', this.state.currentWave);
        this.emitState();
    }

    public resetWaves(): void {
        this.state.currentWave = 0;
        this.emit('wave-changed', this.state.currentWave);
        this.emitState();
    }

    private emitState(): void {
        this.emit('state-updated', this.getState());
    }

    private getDeckCounts() {
        return {
            drawPile: this.state.drawPile.length,
            discardPile: this.state.discardPile.length
        };
    }
}
