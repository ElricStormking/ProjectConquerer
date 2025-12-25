import Phaser from 'phaser';
import { DataManager } from './DataManager';
import { RunProgressionManager } from './RunProgressionManager';
import { RelicManager } from './RelicManager';
import { CommanderManager } from './CommanderManager';
import { IMapNode, NodeType, ICard, IRelicConfig, IEventOption, RelicTrigger } from '../types/ironwars';

type RewardSceneResult = {
    card?: ICard;
    relic?: IRelicConfig;
    goldAwarded?: number;
};

type EventResolution = {
    option?: IEventOption;
};

export class NodeEncounterSystem {
    private readonly runManager = RunProgressionManager.getInstance();
    private readonly dataManager = DataManager.getInstance();
    private readonly relicManager = RelicManager.getInstance();
    private readonly commanderManager = CommanderManager.getInstance();
    private resolving = false;

    constructor(private readonly hostScene: Phaser.Scene) {}

    public resolveNode(node: IMapNode): void {
        // Prevent double-resolve (e.g. double-click on a node) which can attach
        // multiple battle listeners and charge extra lives for a single defeat.
        if (this.resolving) {
            return;
        }
        this.resolving = true;

        switch (node.type) {
            case NodeType.BATTLE:
            case NodeType.ELITE:
            case NodeType.BOSS:
                this.startBattleEncounter(node);
                break;
            case NodeType.EVENT:
                this.startEventEncounter(node);
                break;
            case NodeType.SHOP:
                this.startShopEncounter(node);
                break;
            case NodeType.REST:
                this.startRestEncounter(node);
                break;
            case NodeType.RECRUITMENT:
                this.startRecruitmentEncounter(node);
                break;
            default:
                this.finishEncounter(node);
                break;
        }
    }

    private startBattleEncounter(node: IMapNode): void {
        const scenePlugin = this.hostScene.scene;
        const battleKey = 'BattleScene';

        const attachBattleListeners = (battleScene: Phaser.Scene) => {
            battleScene.events.once('battle-victory', () => this.onBattleComplete(node, true));
            battleScene.events.once('battle-defeat', () => this.onBattleComplete(node, false));
        };

        let battleScene: Phaser.Scene | null = null;
        if (scenePlugin.isActive(battleKey)) {
            battleScene = scenePlugin.get(battleKey) as Phaser.Scene;
            attachBattleListeners(battleScene);
            battleScene.scene.restart({ nodeId: node.id, encounterId: node.encounterId, nodeType: node.type });
        } else {
            try {
                if (scenePlugin.get(battleKey)) {
                    scenePlugin.stop(battleKey);
                }
            } catch (err) {
                /* scene not created yet, safe to ignore */
            }
            scenePlugin.launch(battleKey, { nodeId: node.id, encounterId: node.encounterId, nodeType: node.type });
            battleScene = scenePlugin.get(battleKey) as Phaser.Scene;
            attachBattleListeners(battleScene);
        }

        scenePlugin.pause(this.hostScene.scene.key);
        scenePlugin.bringToTop(battleKey);
        this.ensureUiScene();
    }

    private onBattleComplete(node: IMapNode, victory: boolean): void {
        const scenePlugin = this.hostScene.scene;
        scenePlugin.stop('BattleScene');
        scenePlugin.stop('UIScene');
        const hostKey = this.hostScene.scene.key;
        if (scenePlugin.isPaused(hostKey)) {
            scenePlugin.resume(hostKey);
        } else if (scenePlugin.isSleeping(hostKey)) {
            scenePlugin.wake(hostKey);
        }
        scenePlugin.bringToTop(this.hostScene.scene.key);

        if (!victory) {
            const livesLeft = this.runManager.loseLife(1);
            this.resolving = false;
            this.hostScene.events.emit('battle-failed', node, livesLeft);
            return;
        }

        this.runManager.completeNode(node.id);
        this.presentBattleRewards(node);
    }

    private presentBattleRewards(node: IMapNode): void {
        const nodeCompleteContext = this.relicManager.applyTrigger(RelicTrigger.ON_NODE_COMPLETE, {
            nodeType: node.type
        });

        if (nodeCompleteContext.fortressHealBonus) {
            this.runManager.healFortress(nodeCompleteContext.fortressHealBonus as number);
        }

        const cardChoices = this.generateCardChoices(node.rewardTier);
        let goldReward = node.rewardTier * 50;
        goldReward = this.relicManager.applyGoldModifier(goldReward);

        const rewardSceneKey = 'RewardScene';

        const scenePlugin = this.hostScene.scene;
        scenePlugin.launch(rewardSceneKey, {
            title: 'Battle Cleared',
            subtitle: 'Choose one reward to add to your run',
            cardChoices,
            goldReward,
            onComplete: (result: RewardSceneResult) => {
                if (result.card) {
                    // Rewards now expand the player's collection; they are not
                    // automatically slotted into the active deck. The player
                    // can add them later in DeckBuilding.
                    this.runManager.addCardToCollection(result.card);
                }
                if (result.goldAwarded) {
                    this.runManager.gainGold(result.goldAwarded);
                }

                if (node.type === NodeType.ELITE || node.type === NodeType.BOSS) {
                    this.presentRelicReward(node);
                } else {
                    this.finishEncounter(node);
                }
            }
        });
        scenePlugin.bringToTop(rewardSceneKey);
    }

    private presentRelicReward(node: IMapNode): void {
        const relicChoices = this.relicManager.generateRelicReward(node.rewardTier, []);
        if (relicChoices.length === 0) {
            this.checkCommanderUnlock(node);
            return;
        }

        const relicRewardSceneKey = 'RelicRewardScene';
        const scenePlugin = this.hostScene.scene;
        scenePlugin.launch(relicRewardSceneKey, {
            title: node.type === NodeType.BOSS ? 'Boss Defeated!' : 'Elite Conquered!',
            subtitle: 'Choose a relic to aid your journey',
            relicChoices,
            allowSkip: true,
            onComplete: (selectedRelic: IRelicConfig | null) => {
                this.hostScene.scene.stop(relicRewardSceneKey);
                if (selectedRelic) {
                    this.runManager.addRelic(selectedRelic.id);
                }
                this.checkCommanderUnlock(node);
            }
        });
        scenePlugin.bringToTop(relicRewardSceneKey);
    }

    private checkCommanderUnlock(node: IMapNode): void {
        // Only bosses can unlock new commanders
        if (node.type !== NodeType.BOSS) {
            this.finishEncounter(node);
            return;
        }

        // Get a random locked commander to potentially unlock
        const lockedCommanders = this.commanderManager.getLockedCommanders();
        if (lockedCommanders.length === 0) {
            this.finishEncounter(node);
            return;
        }

        // 70% chance to unlock a commander after boss
        if (Math.random() > 0.7) {
            this.finishEncounter(node);
            return;
        }

        // Pick a random locked commander
        const commanderToUnlock = Phaser.Utils.Array.GetRandom(lockedCommanders);
        
        // Unlock the commander
        this.commanderManager.unlockCommander(commanderToUnlock.id);
        
        // Also add to current run's roster
        this.runManager.addCommanderToRoster(commanderToUnlock.id);
        
        // Show unlock scene
        const scenePlugin = this.hostScene.scene;
        const unlockSceneKey = 'CommanderUnlockScene';
        scenePlugin.launch(unlockSceneKey, {
            commander: commanderToUnlock,
            onComplete: () => {
                scenePlugin.stop(unlockSceneKey);
                this.finishEncounter(node);
            }
        });
        scenePlugin.bringToTop(unlockSceneKey);
    }

    private startEventEncounter(node: IMapNode): void {
        const eventSceneKey = 'EventScene';
        const scenePlugin = this.hostScene.scene;
        scenePlugin.launch(eventSceneKey, {
            eventId: node.encounterId,
            onComplete: (resolution: EventResolution) => {
                scenePlugin.stop(eventSceneKey);
                if (resolution.option) {
                    this.applyEventEffect(resolution.option.effectId ?? '');
                }
                this.finishEncounter(node);
            }
        });
        scenePlugin.bringToTop(eventSceneKey);
    }

    private startShopEncounter(node: IMapNode): void {
        this.relicManager.applyTrigger(RelicTrigger.ON_SHOP_ENTER, {});

        const shopSceneKey = 'ShopScene';
        const inventory = this.buildShopInventory(node.rewardTier);
        const curses = this.relicManager.getCurses();
        const curseRemovalCost = 100 + (node.rewardTier * 25);

        const scenePlugin = this.hostScene.scene;
        scenePlugin.launch(shopSceneKey, {
            inventory,
            currentGold: this.runManager.getGold(),
            curses,
            curseRemovalCost,
            onComplete: (result: { purchasedCards: ICard[]; purchasedRelic?: IRelicConfig; removedCurses: string[]; goldSpent: number }) => {
                scenePlugin.stop(shopSceneKey);
                if (result.goldSpent > 0) {
                    this.runManager.spendGold(result.goldSpent);
                }
                // Purchased cards go into the collection; player can add them
                // to the deck later in DeckBuilding.
                result.purchasedCards.forEach(card => this.runManager.addCardToCollection(card));
                if (result.purchasedRelic) {
                    this.runManager.addRelic(result.purchasedRelic.id);
                }
                result.removedCurses.forEach(curseId => this.runManager.removeCurse(curseId));
                this.finishEncounter(node);
            }
        });
        scenePlugin.bringToTop(shopSceneKey);
    }

    private startRestEncounter(node: IMapNode): void {
        const restSceneKey = 'RestScene';
        const state = this.runManager.getRunState();
        const healAmount = state ? Math.round(state.fortressMaxHp * 0.3) : 150;
        const scenePlugin = this.hostScene.scene;
        scenePlugin.launch(restSceneKey, {
            healAmount,
            onComplete: (action: 'rest' | 'skip') => {
                scenePlugin.stop(restSceneKey);
                if (action === 'rest') {
                    this.runManager.healFortress(healAmount);
                }
                this.finishEncounter(node);
            }
        });
        scenePlugin.bringToTop(restSceneKey);
    }

    private startRecruitmentEncounter(node: IMapNode): void {
        const starterDeck = this.runManager.getDeckSnapshot();
        if (starterDeck.length === 0) {
            this.finishEncounter(node);
            return;
        }
        const bonusCard = Phaser.Utils.Array.GetRandom(starterDeck);
        // Recruitment grants a new copy of an existing card into the collection.
        this.runManager.addCardToCollection(bonusCard);
        this.finishEncounter(node);
    }

    private finishEncounter(node: IMapNode): void {
        const latest = this.runManager.getNodeSnapshot(node.id);
        if (!latest?.isCompleted) {
            this.runManager.completeNode(node.id);
        }
        this.resolving = false;
        this.hostScene.events.emit('node-resolved', latest ?? node);
    }

    private generateCardChoices(tier: number): ICard[] {
        const rarity = tier <= 1 ? 'common' : tier === 2 ? 'rare' : 'epic';
        const cards = this.dataManager.getAllCards();
        const filtered = cards.filter(card => card.rarity === rarity);
        const pool = filtered.length > 0 ? filtered : cards;
        return Phaser.Utils.Array.Shuffle([...pool]).slice(0, 3);
    }

    private buildShopInventory(tier: number): {
        cards: Array<{ card: ICard; cost: number }>;
        relic?: { relic: IRelicConfig; cost: number };
    } {
        const cards = this.generateCardChoices(tier).map(card => ({
            card,
            cost: 60 + tier * 20
        }));
        const relic = this.pickRelicForTier(tier);
        return {
            cards,
            relic: relic ? { relic, cost: 180 + tier * 25 } : undefined
        };
    }

    private pickRelicForTier(tier: number): IRelicConfig | undefined {
        const relics = this.dataManager.getAllRelics();
        if (relics.length === 0) return undefined;
        const preferredRarity = tier <= 1 ? 'common' : tier === 2 ? 'rare' : 'epic';
        const filtered = relics.filter(r => r.rarity === preferredRarity && !r.isCursed);
        const pool = filtered.length > 0 ? filtered : relics.filter(r => !r.isCursed) || relics;
        return Phaser.Utils.Array.GetRandom(pool);
    }

    private applyEventEffect(effectId: string): void {
        const lower = effectId?.toLowerCase();
        if (!lower) return;

        if (lower.startsWith('heal_fortress_')) {
            const value = parseInt(lower.replace('heal_fortress_', ''), 10) || 0;
            this.runManager.healFortress(value);
            return;
        }

        if (lower.startsWith('gain_gold_')) {
            const value = parseInt(lower.replace('gain_gold_', ''), 10) || 0;
            this.runManager.gainGold(value);
            return;
        }

        if (lower.startsWith('lose_gold_')) {
            const value = parseInt(lower.replace('lose_gold_', ''), 10) || 0;
            this.runManager.spendGold(value);
            return;
        }

        if (lower.includes('gain_relic_cursed')) {
            const cursed = this.dataManager.getAllRelics().find(rel => rel.isCursed);
            if (cursed) {
                this.runManager.addRelic(cursed.id);
            }
            return;
        }

        if (lower.includes('gain_relic_epic')) {
            const relic = this.pickRelicForTier(3);
            if (relic) this.runManager.addRelic(relic.id);
            return;
        }

        if (lower.includes('gain_relic_common')) {
            const relic = this.pickRelicForTier(1);
            if (relic) this.runManager.addRelic(relic.id);
            return;
        }

        if (lower.includes('add_card_epic')) {
            const cards = this.generateCardChoices(3);
            if (cards[0]) this.runManager.addCardToCollection(cards[0]);
            return;
        }

        if (lower.includes('add_card_rare')) {
            const cards = this.generateCardChoices(2);
            if (cards[0]) this.runManager.addCardToCollection(cards[0]);
            return;
        }

        if (lower.includes('gain_random_card')) {
            const cards = this.generateCardChoices(1);
            if (cards[0]) this.runManager.addCardToCollection(cards[0]);
            return;
        }

        if (lower.includes('add_curse')) {
            this.runManager.addCurse(`curse-${Date.now()}`);
            return;
        }

        if (lower.includes('remove_card')) {
            this.runManager.removeRandomCard();
        }
    }

    private ensureUiScene(): void {
        const manager = this.hostScene.scene;
        const uiKey = 'UIScene';
        let uiScene: Phaser.Scene | null = null;
        try {
            uiScene = manager.get(uiKey);
        } catch (err) {
            return;
        }
        if (!uiScene) return;

        if (manager.isSleeping(uiKey)) {
            manager.wake(uiKey);
        } else if (!manager.isActive(uiKey)) {
            manager.launch(uiKey);
        }
        manager.bringToTop(uiKey);
    }
}
