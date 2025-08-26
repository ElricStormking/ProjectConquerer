import { UnitConfig } from '../entities/Unit';

export enum UnitType {
    KNIGHT = 'knight',
    ARCHER = 'archer',
    MAGE = 'mage',
    SHIELD_BEARER = 'shield_bearer',
    BERSERKER = 'berserker',
    CATAPULT = 'catapult'
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

export const UNIT_TEMPLATES: Record<UnitType, UnitTemplate> = {
    [UnitType.KNIGHT]: {
        type: UnitType.KNIGHT,
        name: 'Knight',
        description: 'Heavily armored frontline warrior',
        unitClass: 'frontline',
        size: 'normal',
        rarity: 'common',
        baseStats: {
            maxHealth: 100,
            damage: 15,
            armor: 5,
            moveSpeed: 40,
            attackSpeed: 1.0,
            range: 30,
            mass: 10
        }
    },
    
    [UnitType.ARCHER]: {
        type: UnitType.ARCHER,
        name: 'Archer',
        description: 'Long-range damage dealer',
        unitClass: 'ranged',
        size: 'small',
        rarity: 'common',
        baseStats: {
            maxHealth: 60,
            damage: 12,
            armor: 2,
            moveSpeed: 50,
            attackSpeed: 1.5,
            range: 150,
            mass: 6
        }
    },
    
    [UnitType.MAGE]: {
        type: UnitType.MAGE,
        name: 'Mage',
        description: 'Magical damage and area effects',
        unitClass: 'ranged',
        size: 'normal',
        rarity: 'rare',
        baseStats: {
            maxHealth: 70,
            damage: 20,
            armor: 1,
            moveSpeed: 35,
            attackSpeed: 0.8,
            range: 120,
            mass: 7
        }
    },
    
    [UnitType.SHIELD_BEARER]: {
        type: UnitType.SHIELD_BEARER,
        name: 'Shield Bearer',
        description: 'Defensive tank with high armor',
        unitClass: 'frontline',
        size: 'normal',
        rarity: 'common',
        baseStats: {
            maxHealth: 150,
            damage: 8,
            armor: 8,
            moveSpeed: 30,
            attackSpeed: 0.7,
            range: 25,
            mass: 12
        }
    },
    
    [UnitType.BERSERKER]: {
        type: UnitType.BERSERKER,
        name: 'Berserker',
        description: 'High damage glass cannon',
        unitClass: 'frontline',
        size: 'normal',
        rarity: 'rare',
        baseStats: {
            maxHealth: 80,
            damage: 25,
            armor: 3,
            moveSpeed: 60,
            attackSpeed: 1.8,
            range: 35,
            mass: 8
        }
    },
    
    [UnitType.CATAPULT]: {
        type: UnitType.CATAPULT,
        name: 'Catapult',
        description: 'Long-range siege weapon',
        unitClass: 'siege',
        size: 'large',
        rarity: 'epic',
        baseStats: {
            maxHealth: 200,
            damage: 40,
            armor: 4,
            moveSpeed: 20,
            attackSpeed: 0.3,
            range: 250,
            mass: 20
        }
    }
};

export class UnitFactory {
    public static createUnit(
        type: UnitType,
        team: number,
        x: number,
        y: number,
        starRank: number = 1
    ): UnitConfig {
        const template = UNIT_TEMPLATES[type];
        const rankMultiplier = 1 + (starRank - 1) * 0.15;
        
        return {
            x,
            y,
            team,
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