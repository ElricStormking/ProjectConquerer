import { UnitConfig } from '../entities/Unit';
import { DataManager } from '../systems/DataManager';

export enum UnitType {
    CHRONOTEMPORAL = 'chronotemporal',
    SNIPER = 'sniper',
    DARK_MAGE = 'dark_mage',
    WARRIOR = 'warrior',
    NINJA = 'ninja',
    SHOTGUNNER = 'shotgunner',
    COG_SOLDIER = 'cog_soldier',
    COG_RAILGUNNER = 'cog_railgunner',
    COG_AEGIS_TANK = 'cog_aegis_tank',
    COG_MEDIC_DRONE = 'cog_medic_drone',
    COG_THUNDER_CANNON = 'cog_thunder_cannon',
    RAIDER_GRUNT = 'raider_grunt',
    RAIDER_BOMBER = 'raider_bomber',
    RAIDER_BOSS = 'raider_boss',
    RAIDER_ROGUE = 'raider_rogue',
    RAIDER_ARCHER = 'raider_archer'
}

export interface UnitTemplate {
    type: UnitType;
    name: string;
    description: string;
    unitClass: 'frontline' | 'ranged' | 'support' | 'siege' | 'summoner';
    size: 'small' | 'normal' | 'large';
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    baseStats: {
        maxHealth: number;
        damage: number;
        armor: number;
        moveSpeed: number;
        attackSpeed: number;
        range: number;
        mass: number;
    };
}

// Deprecated: Use DataManager.getInstance().getUnitTemplate() instead
export const UNIT_TEMPLATES: Record<UnitType, UnitTemplate> = {} as any;

export class UnitFactory {
    public static createUnit(
        type: UnitType,
        team: number,
        x: number,
        y: number,
        starRank: number = 1
    ): UnitConfig {
        // Fetch template from DataManager instead of hardcoded UNIT_TEMPLATES
        const template = DataManager.getInstance().getUnitTemplate(type);
        
        if (!template) {
            console.error(`UnitFactory: Unit type '${type}' not found in DataManager. Falling back to defaults.`);
            // Return a safe default to prevent crash, or throw error
            return {
                x, y, team,
                unitType: type,
                type: 'frontline',
                size: 'normal',
                stats: { maxHealth: 100, damage: 10, armor: 0, moveSpeed: 50, attackSpeed: 1, range: 50, mass: 50 }
            };
        }

        const rankMultiplier = 1 + (starRank - 1) * 0.15;
        
        return {
            x,
            y,
            team,
            unitType: type,
            type: template.unitClass,
            size: template.size,
            stats: {
                maxHealth: Math.round(template.baseStats.maxHealth * rankMultiplier),
                damage: Math.round(template.baseStats.damage * rankMultiplier),
                armor: Math.round(template.baseStats.armor * rankMultiplier),
                moveSpeed: template.baseStats.moveSpeed,
                attackSpeed: template.baseStats.attackSpeed,
                range: template.baseStats.range,
                mass: template.baseStats.mass
            }
        };
    }
    
    public static getClassCap(unitClass: string): number {
        switch (unitClass) {
            case 'frontline': return 8;
            case 'ranged': return 6;
            case 'support': return 4;
            case 'siege': return 2;
            case 'summoner': return 2;
            default: return 4;
        }
    }
}