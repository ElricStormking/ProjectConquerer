import Phaser from 'phaser';
import { DataManager } from './DataManager';
import { SaveManager } from './SaveManager';
import { ICommanderFullConfig, ICard } from '../types/ironwars';

export class CommanderManager extends Phaser.Events.EventEmitter {
    private static instance: CommanderManager;
    private readonly dataManager = DataManager.getInstance();
    private readonly saveManager = SaveManager.getInstance();

    private constructor() {
        super();
    }

    public static getInstance(): CommanderManager {
        if (!CommanderManager.instance) {
            CommanderManager.instance = new CommanderManager();
        }
        return CommanderManager.instance;
    }

    // ─────────────────────────────────────────────────────────────────
    // Commander Data Access
    // ─────────────────────────────────────────────────────────────────

    public getAllCommanders(): ICommanderFullConfig[] {
        return this.dataManager.getAllCommanders();
    }

    public getCommander(commanderId: string): ICommanderFullConfig | undefined {
        return this.dataManager.getCommander(commanderId);
    }

    public getCommandersByFaction(factionId: string): ICommanderFullConfig[] {
        return this.dataManager.getCommandersByFaction(factionId);
    }

    public getStarterCommander(factionId: string): ICommanderFullConfig | undefined {
        return this.dataManager.getStarterCommander(factionId);
    }

    // ─────────────────────────────────────────────────────────────────
    // Commander Cards
    // ─────────────────────────────────────────────────────────────────

    public getCardsForCommander(commanderId: string): ICard[] {
        return this.dataManager.getCardsForCommander(commanderId);
    }

    public getCardsForCommanders(commanderIds: string[]): ICard[] {
        const allCards: ICard[] = [];
        const seenCardIds = new Set<string>();
        
        for (const commanderId of commanderIds) {
            const cards = this.getCardsForCommander(commanderId);
            for (const card of cards) {
                if (!seenCardIds.has(card.id)) {
                    seenCardIds.add(card.id);
                    allCards.push(card);
                }
            }
        }
        
        return allCards;
    }

    public getStarterDeck(factionId: string): ICard[] {
        const starterCommander = this.getStarterCommander(factionId);
        if (!starterCommander) {
            console.warn(`[CommanderManager] No starter commander for faction: ${factionId}`);
            return [];
        }
        return this.getCardsForCommander(starterCommander.id);
    }

    // ─────────────────────────────────────────────────────────────────
    // Commander Unlock System
    // ─────────────────────────────────────────────────────────────────

    public isCommanderUnlocked(commanderId: string): boolean {
        const commander = this.getCommander(commanderId);
        if (!commander) return false;
        
        // Starter commanders are always unlocked
        if (commander.isStarter) return true;
        
        // Check meta progression
        return this.saveManager.isCommanderUnlocked(commanderId);
    }

    public getUnlockedCommanders(): ICommanderFullConfig[] {
        return this.getAllCommanders().filter(c => this.isCommanderUnlocked(c.id));
    }

    public getUnlockedCommandersByFaction(factionId: string): ICommanderFullConfig[] {
        return this.getCommandersByFaction(factionId).filter(c => this.isCommanderUnlocked(c.id));
    }

    public getLockedCommanders(): ICommanderFullConfig[] {
        return this.getAllCommanders().filter(c => !this.isCommanderUnlocked(c.id));
    }

    public unlockCommander(commanderId: string): boolean {
        const commander = this.getCommander(commanderId);
        if (!commander) {
            console.warn(`[CommanderManager] Cannot unlock unknown commander: ${commanderId}`);
            return false;
        }
        
        if (this.isCommanderUnlocked(commanderId)) {
            console.log(`[CommanderManager] Commander already unlocked: ${commanderId}`);
            return false;
        }
        
        const success = this.saveManager.unlockCommander(commanderId);
        if (success) {
            this.emit('commander-unlocked', commander);
        }
        return success;
    }

    // ─────────────────────────────────────────────────────────────────
    // Deck Building Helpers
    // ─────────────────────────────────────────────────────────────────

    public getAvailableCardsForRoster(commanderRoster: string[]): ICard[] {
        return this.getCardsForCommanders(commanderRoster);
    }

    /**
     * Check whether a given card template id is usable with the current
     * commander roster (i.e., at least one owned commander has this card
     * in their cardIds list).
     */
    public isCardUsableByRoster(cardId: string, commanderRoster: string[]): boolean {
        // For usability checks we work on template ids exactly as stored in
        // commanders.csv (e.g. 'card_soldier_1', 'card_overclock').
        const key = cardId;
        const allCommanders = this.getAllCommanders();
        const owners = allCommanders.filter(cmd => cmd.cardIds.includes(key)).map(cmd => cmd.id);

        if (owners.length === 0) {
            // Card is not yet assigned to any commander the player can own.
            // Treat as locked until a specific commander is designed for it.
            return false;
        }

        // Usable only if at least one owning commander is in the current roster.
        return owners.some(id => commanderRoster.includes(id));
    }

    private getCardKey(id: string): string {
        let base = id.replace(/_\d+$/, '');
        base = base.replace(/_\d+$/, '');
        return base;
    }

    private getCardKey(id: string): string {
        // Normalize runtime copies like `card_railgunner_1_1717358234123` back to the base card id
        // 1) Strip trailing timestamp / runtime suffix
        let base = id.replace(/_\d+$/, '');
        // 2) Strip trailing deck index (e.g. `_1`, `_2`) so all variants of the same type collapse
        base = base.replace(/_\d+$/, '');
        return base;
    }

    public validateDeck(deck: ICard[], commanderRoster: string[], maxDeckSize = 40): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];
        
        // Check deck size
        if (deck.length > maxDeckSize) {
            errors.push(`Deck has ${deck.length} cards, max is ${maxDeckSize}`);
        }
        
        if (deck.length === 0) {
            errors.push('Deck cannot be empty');
        }
        
        // Check all cards come from commanders in roster
        const availableCards = this.getAvailableCardsForRoster(commanderRoster);
        const availableCardKeys = new Set(availableCards.map(c => this.getCardKey(c.id)));
        
        for (const card of deck) {
            const key = this.getCardKey(card.id);
            if (!availableCardKeys.has(key)) {
                errors.push(`Card ${card.name} (${card.id}) is not available from current commanders`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

