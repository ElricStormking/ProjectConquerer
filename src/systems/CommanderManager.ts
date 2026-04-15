import Phaser from 'phaser';
import { DataManager } from './DataManager';
import { SaveManager } from './SaveManager';
import { ICommanderFullConfig, ICard } from '../types/ironwars';

export const STARTING_COMMANDER_DECK_SIZE = 5;

const BASIC_STARTER_CARDS_BY_FACTION: Record<string, string[]> = {
    jade_dynasty: ['card_jade_scimitar_soldier', 'card_jade_archer'],
    frost_clan: ['card_frost_skeleton_soldiers', 'card_frost_skeleton_archer'],
    triarch_dominion: ['card_triarch_dominion_footmen', 'card_triarch_dominion_gunner'],
    elf_covenant: ['card_elf_elven_scout', 'card_elf_elven_bowmen'],
    abyss_legion: ['card_abyss_feral_imp', 'card_abyss_abyssal_firespitter']
};

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

    public getStartingDeckForCommander(commanderId: string, deckSize = STARTING_COMMANDER_DECK_SIZE): ICard[] {
        const commander = this.getCommander(commanderId);
        if (!commander) {
            console.warn(`[CommanderManager] Unknown commander for starter deck: ${commanderId}`);
            return [];
        }

        return this.getStarterDeck(commander.factionId, deckSize);
    }

    public getStarterDeck(factionId: string, deckSize = STARTING_COMMANDER_DECK_SIZE): ICard[] {
        const basicStarterCards = this.getBasicStarterCardsForFaction(factionId);
        if (basicStarterCards.length > 0) {
            return this.buildStarterCopies(basicStarterCards, deckSize);
        }

        const starterCommander = this.getStarterCommander(factionId);
        if (!starterCommander) {
            console.warn(`[CommanderManager] No starter commander for faction: ${factionId}`);
            return [];
        }
        return this.buildStarterDeck(this.getCardsForCommander(starterCommander.id), deckSize);
    }

    public getStarterCardPool(factionId: string, deckSize = STARTING_COMMANDER_DECK_SIZE): ICard[] {
        const basicStarterCards = this.getBasicStarterCardsForFaction(factionId);
        if (basicStarterCards.length === 0 || deckSize <= 0) {
            return [];
        }

        return basicStarterCards.flatMap(card =>
            Array.from({ length: deckSize }, () => ({ ...card }))
        );
    }

    private buildStarterDeck(cardPool: ICard[], deckSize: number): ICard[] {
        if (cardPool.length === 0 || deckSize <= 0) {
            return [];
        }

        const starterDeck: ICard[] = [];
        for (let i = 0; i < deckSize; i++) {
            const template = cardPool[i % cardPool.length];
            starterDeck.push({
                ...template,
                id: `${template.id}_${i + 1}`
            });
        }

        return starterDeck;
    }

    private buildStarterCopies(cardPool: ICard[], copiesPerCard: number): ICard[] {
        if (cardPool.length === 0 || copiesPerCard <= 0) {
            return [];
        }

        return cardPool.flatMap(template =>
            Array.from({ length: copiesPerCard }, (_, index) => ({
                ...template,
                id: `${template.id}_${index + 1}`
            }))
        );
    }

    private getBasicStarterCardsForFaction(factionId: string): ICard[] {
        const cardIds = BASIC_STARTER_CARDS_BY_FACTION[factionId];
        if (!cardIds || cardIds.length === 0) {
            return [];
        }

        return cardIds
            .map(cardId => {
                const card = this.dataManager.getCard(cardId);
                if (!card) {
                    console.warn(`[CommanderManager] Missing basic starter card '${cardId}' for faction: ${factionId}`);
                }
                return card;
            })
            .filter((card): card is ICard => card !== undefined);
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
        const key = this.getTemplateCardId(cardId);
        const allCommanders = this.getAllCommanders();
        const rosterCommanders = allCommanders.filter(cmd => commanderRoster.includes(cmd.id));

        if (rosterCommanders.some(cmd => cmd.cardIds.includes(key))) {
            return true;
        }

        if (rosterCommanders.some(cmd => BASIC_STARTER_CARDS_BY_FACTION[cmd.factionId]?.includes(key))) {
            return true;
        }

        const owners = allCommanders.filter(cmd => cmd.cardIds.includes(key)).map(cmd => cmd.id);

        if (owners.length === 0) {
            // Card is not yet assigned to any commander the player can own.
            // Treat as locked until a specific commander is designed for it.
            return false;
        }

        // Usable only if at least one owning commander is in the current roster.
        return owners.some(id => commanderRoster.includes(id));
    }

    private getTemplateCardId(cardId: string): string {
        if (this.dataManager.getCard(cardId)) {
            return cardId;
        }

        let base = cardId.replace(/_\d+$/, '');
        if (this.dataManager.getCard(base)) {
            return base;
        }

        base = base.replace(/_\d+$/, '');
        if (this.dataManager.getCard(base)) {
            return base;
        }

        return cardId;
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
        
        // Check all cards come from commanders in roster or the faction starter pool.
        for (const card of deck) {
            if (!this.isCardUsableByRoster(card.id, commanderRoster)) {
                errors.push(`Card ${card.name} (${card.id}) is not available from current commanders`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

