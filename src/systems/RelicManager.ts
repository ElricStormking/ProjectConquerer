import Phaser from 'phaser';
import { DataManager } from './DataManager';
import {
    IRelicConfig,
    IRelicContext,
    RelicTrigger,
    RelicRarity
} from '../types/ironwars';

export interface RelicModifiers {
    fortressHp: number;
    fortressHpPercent: number;
    unitDamagePercent: number;
    unitArmorFlat: number;
    unitMoveSpeedPercent: number;
    unitAttackSpeedPercent: number;
    unitRangeFlat: number;
    goldGainPercent: number;
    shopDiscountPercent: number;
    cardDrawBonus: number;
    commanderCooldownPercent: number;
    commanderDamagePercent: number;
    healingPercent: number;
    maxHandSizeModifier: number;
}

const DEFAULT_MODIFIERS: RelicModifiers = {
    fortressHp: 0,
    fortressHpPercent: 0,
    unitDamagePercent: 0,
    unitArmorFlat: 0,
    unitMoveSpeedPercent: 0,
    unitAttackSpeedPercent: 0,
    unitRangeFlat: 0,
    goldGainPercent: 0,
    shopDiscountPercent: 0,
    cardDrawBonus: 0,
    commanderCooldownPercent: 0,
    commanderDamagePercent: 0,
    healingPercent: 0,
    maxHandSizeModifier: 0
};

const RARITY_WEIGHTS: Record<RelicRarity, number> = {
    common: 50,
    rare: 30,
    epic: 15,
    legendary: 4,
    mythic: 1,
    cursed: 0
};

export class RelicManager extends Phaser.Events.EventEmitter {
    private static instance: RelicManager;
    private readonly dataManager = DataManager.getInstance();

    private activeRelics: Map<string, IRelicConfig> = new Map();
    private cachedModifiers: RelicModifiers = { ...DEFAULT_MODIFIERS };
    private phoenixFeatherUsed = false;
    private firstRewardUpgraded = false;

    private constructor() {
        super();
    }

    public static getInstance(): RelicManager {
        if (!RelicManager.instance) {
            RelicManager.instance = new RelicManager();
        }
        return RelicManager.instance;
    }

    public reset(): void {
        this.activeRelics.clear();
        this.cachedModifiers = { ...DEFAULT_MODIFIERS };
        this.phoenixFeatherUsed = false;
        this.firstRewardUpgraded = false;
    }

    public addRelic(relicId: string): boolean {
        if (this.activeRelics.has(relicId)) {
            return false;
        }
        const config = this.dataManager.getRelicConfig(relicId);
        if (!config) {
            console.warn(`[RelicManager] Relic not found: ${relicId}`);
            return false;
        }
        this.activeRelics.set(relicId, config);
        this.recalculateModifiers();
        this.emit('relic-added', config);
        console.log(`[RelicManager] Added relic: ${config.name}, effect:`, config.effect);
        return true;
    }

    public removeRelic(relicId: string): boolean {
        const config = this.activeRelics.get(relicId);
        if (!config) {
            return false;
        }
        this.activeRelics.delete(relicId);
        this.recalculateModifiers();
        this.emit('relic-removed', config);
        console.log(`[RelicManager] Removed relic: ${config.name}`);
        return true;
    }

    public hasRelic(relicId: string): boolean {
        return this.activeRelics.has(relicId);
    }

    public getActiveRelics(): IRelicConfig[] {
        return Array.from(this.activeRelics.values());
    }

    public getActiveRelicIds(): string[] {
        return Array.from(this.activeRelics.keys());
    }

    public getCurses(): IRelicConfig[] {
        return this.getActiveRelics().filter(r => r.isCursed);
    }

    public getModifiers(): RelicModifiers {
        return { ...this.cachedModifiers };
    }

    public getModifier<K extends keyof RelicModifiers>(stat: K): RelicModifiers[K] {
        return this.cachedModifiers[stat];
    }

    private recalculateModifiers(): void {
        const mods: RelicModifiers = { ...DEFAULT_MODIFIERS };

        this.activeRelics.forEach(relic => {
            const effect = relic.effect;
            const trigger = effect.trigger as RelicTrigger | undefined;

            if (trigger !== RelicTrigger.PASSIVE && trigger !== undefined) {
                return;
            }

            // Skip conditional passives in global cache - they must be applied dynamically
            if (effect.condition) {
                return;
            }

            switch (effect.type) {
                case 'fortress_hp':
                    mods.fortressHp += (effect.value as number) || 0;
                    break;
                case 'unit_damage_pct':
                    mods.unitDamagePercent += (effect.percentValue as number) || 0;
                    break;
                case 'unit_armor':
                    mods.unitArmorFlat += (effect.value as number) || 0;
                    break;
                case 'unit_move_speed_pct':
                    mods.unitMoveSpeedPercent += (effect.percentValue as number) || 0;
                    break;
                case 'unit_attack_speed_pct':
                    mods.unitAttackSpeedPercent += (effect.percentValue as number) || 0;
                    break;
                case 'unit_range':
                    mods.unitRangeFlat += (effect.value as number) || 0;
                    break;
                case 'gold_gain_pct':
                    mods.goldGainPercent += (effect.percentValue as number) || 0;
                    break;
                case 'shop_discount_pct':
                    mods.shopDiscountPercent += (effect.percentValue as number) || 0;
                    break;
                case 'commander_cooldown_pct':
                    mods.commanderCooldownPercent += (effect.percentValue as number) || 0;
                    break;
                case 'commander_damage_pct':
                    mods.commanderDamagePercent += (effect.percentValue as number) || 0;
                    break;
            }

            if (effect.cost) {
                this.applyCostModifiers(effect.cost as string, mods);
            }
        });

        this.cachedModifiers = mods;
    }

    private applyCostModifiers(cost: string, mods: RelicModifiers): void {
        if (cost.includes('healing_halved')) {
            mods.healingPercent -= 50;
        }
        if (cost.includes('unit_speed_reduce_20')) {
            mods.unitMoveSpeedPercent -= 20;
        }
        if (cost.includes('hand_size_reduce_2')) {
            mods.maxHandSizeModifier -= 2;
        }
        if (cost.includes('shop_cost_increase_25')) {
            mods.shopDiscountPercent -= 25;
        }
        if (cost.includes('commander_cooldown_increase_50')) {
            mods.commanderCooldownPercent += 50;
        }
    }

    public applyTrigger(trigger: RelicTrigger, context: IRelicContext = {}): IRelicContext {
        const result: IRelicContext = { ...context };

        console.log(`[RelicManager] applyTrigger called with trigger: ${trigger}, active relics: ${this.activeRelics.size}`);

        this.activeRelics.forEach(relic => {
            const effect = relic.effect;
            const relicTrigger = effect.trigger as RelicTrigger | undefined;

            console.log(`[RelicManager] Checking relic ${relic.id}: effect.trigger=${relicTrigger}, comparing to ${trigger}`);

            if (relicTrigger !== trigger) {
                return;
            }

            console.log(`[RelicManager] Trigger matched for ${relic.id}, applying effect...`);
            const applied = this.applyRelicEffect(relic, trigger, result);
            if (applied) {
                console.log(`[RelicManager] Effect applied for ${relic.id}, result:`, result);
                this.emit('relic-triggered', { relic, trigger, context: result });
            }
        });

        return result;
    }

    private applyRelicEffect(relic: IRelicConfig, trigger: RelicTrigger, context: IRelicContext): boolean {
        const effect = relic.effect;

        switch (effect.type) {
            case 'card_draw':
                context.cardDrawBonus = (Number(context.cardDrawBonus) || 0) + ((effect.value as number) || 0);
                return true;

            case 'resource_gain':
                context.resourceBonus = (Number(context.resourceBonus) || 0) + ((effect.value as number) || 0);
                return true;

            case 'fortress_heal':
                context.fortressHealBonus = (Number(context.fortressHealBonus) || 0) + ((effect.value as number) || 0);
                return true;

            case 'post_battle_heal':
                if (trigger === RelicTrigger.ON_NODE_COMPLETE) {
                    context.fortressHealBonus = (Number(context.fortressHealBonus) || 0) + ((effect.value as number) || 0);
                    return true;
                }
                break;

            case 'gold_gain_pct':
                if (trigger === RelicTrigger.ON_GOLD_GAIN) {
                    const percent = (effect.percentValue as number) || 0;
                    context.goldMultiplier = ((Number(context.goldMultiplier)) || 1) * (1 + percent / 100);
                    return true;
                }
                break;

            case 'gold_double_chance':
                if (trigger === RelicTrigger.ON_NODE_COMPLETE) {
                    const chance = (effect.percentValue as number) || 0;
                    if (Math.random() * 100 < chance) {
                        context.goldMultiplier = ((Number(context.goldMultiplier)) || 1) * 2;
                    }
                    return true;
                }
                break;

            case 'gold_gamble':
                if (trigger === RelicTrigger.ON_NODE_COMPLETE) {
                    if (Math.random() < 0.5) {
                        context.goldMultiplier = ((Number(context.goldMultiplier)) || 1) * 2;
                    } else {
                        context.goldMultiplier = 0;
                    }
                    return true;
                }
                break;

            case 'gain_gold_flat':
                if (trigger === RelicTrigger.ON_RUN_START) {
                    context.goldBonus = (Number(context.goldBonus) || 0) + ((effect.value as number) || 0);
                    return true;
                }
                break;

            case 'reward_choice_bonus':
                context.rewardChoiceBonus = (Number(context.rewardChoiceBonus) || 0) + ((effect.value as number) || 0);
                if (effect.cost) {
                    const costMatch = (effect.cost as string).match(/fortress_damage_(\d+)/);
                    if (costMatch) {
                        context.fortressDamage = (Number(context.fortressDamage) || 0) + parseInt(costMatch[1], 10);
                    }
                }
                return true;

            case 'boss_reward_bonus':
                if (trigger === RelicTrigger.ON_NODE_COMPLETE && context.nodeType === 'boss') {
                    context.bonusRareCard = (Number(context.bonusRareCard) || 0) + ((effect.value as number) || 0);
                    return true;
                }
                break;

            case 'fortress_revive':
                if (trigger === RelicTrigger.ON_DAMAGE_TAKEN && !this.phoenixFeatherUsed) {
                    if (context.wouldBeLethal) {
                        this.phoenixFeatherUsed = true;
                        context.preventDeath = true;
                        context.fortressHealBonus = (Number(context.fortressHealBonus) || 0) + ((effect.value as number) || 0);
                        return true;
                    }
                }
                break;

            case 'auto_upgrade_reward':
                if (!this.firstRewardUpgraded) {
                    context.upgradeReward = true;
                    this.firstRewardUpgraded = true;
                    return true;
                }
                break;

            case 'unit_death_spawn':
                if (trigger === RelicTrigger.ON_UNIT_DEATH) {
                    const chance = (effect.percentValue as number) || 0;
                    if (Math.random() * 100 < chance) {
                        context.spawnUnitId = effect.spawnId as string;
                        return true;
                    }
                }
                break;
        }

        if (effect.cost && trigger === RelicTrigger.ON_WAVE_END) {
            const costStr = effect.cost as string;
            const waveMatch = costStr.match(/fortress_damage_per_wave_(\d+)/);
            if (waveMatch) {
                context.fortressDamage = (Number(context.fortressDamage) || 0) + parseInt(waveMatch[1], 10);
                return true;
            }
        }

        return false;
    }

    public generateStartingRelics(count: number): string[] {
        const allRelics = this.dataManager.getAllRelics();
        const nonCursed = allRelics.filter(r => !r.isCursed);
        const startingPool = nonCursed.filter(r => r.rarity === 'common' || r.rarity === 'rare');

        const pool = startingPool.length >= count ? startingPool : nonCursed;
        return this.pickRandomRelics(pool, count).map(r => r.id);
    }

    public generateRandomCurse(): IRelicConfig | undefined {
        const allRelics = this.dataManager.getAllRelics();
        const curses = allRelics.filter(r => r.isCursed);
        if (curses.length === 0) return undefined;
        return Phaser.Utils.Array.GetRandom(curses);
    }

    public generateRelicReward(tier: number, excludeIds: string[] = []): IRelicConfig[] {
        const allRelics = this.dataManager.getAllRelics();
        const available = allRelics.filter(r =>
            !r.isCursed &&
            !excludeIds.includes(r.id) &&
            !this.activeRelics.has(r.id)
        );

        if (available.length === 0) return [];

        const targetRarity = this.getTargetRarityForTier(tier);
        const preferred = available.filter(r => r.rarity === targetRarity);
        const pool = preferred.length > 0 ? preferred : available;

        return this.pickRandomRelics(pool, 3);
    }

    private getTargetRarityForTier(tier: number): RelicRarity {
        if (tier <= 1) return 'common';
        if (tier === 2) return 'rare';
        if (tier === 3) return 'epic';
        return 'legendary';
    }

    private pickRandomRelics(pool: IRelicConfig[], count: number): IRelicConfig[] {
        const selected: IRelicConfig[] = [];
        const remaining = [...pool];

        while (selected.length < count && remaining.length > 0) {
            const weights = remaining.map(r => RARITY_WEIGHTS[r.rarity] || 10);
            const totalWeight = weights.reduce((sum, w) => sum + w, 0);
            let roll = Math.random() * totalWeight;

            for (let i = 0; i < remaining.length; i++) {
                roll -= weights[i];
                if (roll <= 0) {
                    selected.push(remaining[i]);
                    remaining.splice(i, 1);
                    break;
                }
            }
        }

        return selected;
    }

    public applyRangeModifier(baseRange: number, context: IRelicContext = {}): number {
        let flatBonus = this.cachedModifiers.unitRangeFlat;

        this.activeRelics.forEach(relic => {
            const effect = relic.effect;
            if (effect.type === 'unit_range' && effect.condition && effect.trigger === RelicTrigger.PASSIVE) {
                if (this.checkCondition(effect.condition as string, context)) {
                    flatBonus += (effect.value as number) || 0;
                }
            }
        });

        return Math.max(0, baseRange + flatBonus);
    }

    public applyMoveSpeedModifier(baseSpeed: number, context: IRelicContext = {}): number {
        let percentBonus = this.cachedModifiers.unitMoveSpeedPercent;

        this.activeRelics.forEach(relic => {
            const effect = relic.effect;
            if (effect.type === 'unit_move_speed_pct' && effect.condition && effect.trigger === RelicTrigger.PASSIVE) {
                if (this.checkCondition(effect.condition as string, context)) {
                    percentBonus += (effect.percentValue as number) || 0;
                }
            }
        });

        return Math.max(0, baseSpeed * (1 + percentBonus / 100));
    }

    public applyAttackSpeedModifier(baseSpeed: number, context: IRelicContext = {}): number {
        let percentBonus = this.cachedModifiers.unitAttackSpeedPercent;

        this.activeRelics.forEach(relic => {
            const effect = relic.effect;
            if (effect.type === 'unit_attack_speed_pct' && effect.condition && effect.trigger === RelicTrigger.PASSIVE) {
                if (this.checkCondition(effect.condition as string, context)) {
                    percentBonus += (effect.percentValue as number) || 0;
                }
            }
        });

        return Math.max(0.1, baseSpeed * (1 + percentBonus / 100));
    }

    public applyArmorModifier(baseArmor: number, context: IRelicContext = {}): number {
        let flatBonus = this.cachedModifiers.unitArmorFlat;

        this.activeRelics.forEach(relic => {
            const effect = relic.effect;
            if (effect.type === 'unit_armor' && effect.condition && effect.trigger === RelicTrigger.PASSIVE) {
                if (this.checkCondition(effect.condition as string, context)) {
                    flatBonus += (effect.value as number) || 0;
                }
            }
        });

        return Math.max(0, baseArmor + flatBonus);
    }

    private checkCondition(condition: string, context: IRelicContext): boolean {
        if (condition === 'ranged') {
            return context.unitType === 'ranged';
        }
        if (condition === 'unit_hp_below_50' && context.unitHpPercent !== undefined) {
            return (context.unitHpPercent as number) < 50;
        }
        if (condition === 'fortress_hp_above_75' && context.fortressHpPercent !== undefined) {
            return (context.fortressHpPercent as number) > 75;
        }
        if (condition === 'elite' && context.nodeType === 'elite') {
            return true;
        }
        if (condition === 'boss' && context.nodeType === 'boss') {
            return true;
        }
        if (condition === 'fortress_lethal') {
            return !!context.wouldBeLethal;
        }
        return false;
    }

    public applyFortressHpModifier(baseHp: number): number {
        const flatBonus = this.cachedModifiers.fortressHp;
        const percentBonus = this.cachedModifiers.fortressHpPercent;
        return Math.floor((baseHp + flatBonus) * (1 + percentBonus / 100));
    }

    public applyDamageModifier(baseDamage: number, context: IRelicContext = {}): number {
        let percentBonus = this.cachedModifiers.unitDamagePercent;

        this.activeRelics.forEach(relic => {
            const effect = relic.effect;
            
            // Handle conditional passives
            if (effect.type === 'unit_damage_pct' && effect.condition && effect.trigger === RelicTrigger.PASSIVE) {
                if (this.checkCondition(effect.condition as string, context)) {
                    percentBonus += (effect.percentValue as number) || 0;
                }
            }

            // Handle damage modifiers that are linked to damage events (like Molten Heart)
            if (effect.type === 'unit_damage_pct' && effect.trigger === RelicTrigger.ON_DAMAGE_DEALT) {
                percentBonus += (effect.percentValue as number) || 0;
            }
        });

        return Math.floor(baseDamage * (1 + percentBonus / 100));
    }

    public applyHealingModifier(baseHealing: number): number {
        const percentMod = this.cachedModifiers.healingPercent;
        return Math.max(0, Math.floor(baseHealing * (1 + percentMod / 100)));
    }

    public applyGoldModifier(baseGold: number): number {
        const context = this.applyTrigger(RelicTrigger.ON_GOLD_GAIN, { amount: baseGold });
        const multiplier = (context.goldMultiplier as number) || 1;
        const percentBonus = this.cachedModifiers.goldGainPercent;
        return Math.floor(baseGold * multiplier * (1 + percentBonus / 100));
    }

    public applyShopDiscount(basePrice: number): number {
        const discount = this.cachedModifiers.shopDiscountPercent;
        return Math.max(1, Math.floor(basePrice * (1 - discount / 100)));
    }

    public getEffectiveMaxHandSize(baseSize: number): number {
        return Math.max(1, baseSize + this.cachedModifiers.maxHandSizeModifier);
    }

    public getEffectiveCommanderCooldown(baseCooldown: number): number {
        const percentMod = this.cachedModifiers.commanderCooldownPercent;
        return Math.max(1000, baseCooldown * (1 + percentMod / 100));
    }

    public resetBattleState(): void {
        this.phoenixFeatherUsed = false;
    }

    public resetStageState(): void {
        this.firstRewardUpgraded = false;
    }

    public loadRelicsFromIds(relicIds: string[]): void {
        this.reset();
        relicIds.forEach(id => this.addRelic(id));
    }
}
