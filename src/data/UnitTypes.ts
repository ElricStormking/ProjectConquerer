import { UnitConfig } from '../entities/Unit';

export enum UnitType {
    CHRONOTEMPORAL = 'chronotemporal',
    SNIPER = 'sniper',
    DARK_MAGE = 'dark_mage',
    WARRIOR = 'warrior',
    NINJA = 'ninja',
    SHOTGUNNER = 'shotgunner'
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
    [UnitType.CHRONOTEMPORAL]: {
        type: UnitType.CHRONOTEMPORAL,
        name: 'Chronotemporal',
        description: 'Time-manipulating support mage',
        unitClass: 'support',
        size: 'normal',
        rarity: 'legendary',
        baseStats: {
            maxHealth: 80,
            damage: 18,
            armor: 3,
            moveSpeed: 45,
            attackSpeed: 1.2,
            range: 100,
            mass: 40
        }
    },
    
    [UnitType.SNIPER]: {
        type: UnitType.SNIPER,
        name: 'Sniper',
        description: 'Elite long-range marksman',
        unitClass: 'ranged',
        size: 'small',
        rarity: 'rare',
        baseStats: {
            maxHealth: 55,
            damage: 25,
            armor: 1,
            moveSpeed: 40,
            attackSpeed: 0.8,
            range: 500,
            mass: 48
        }
    },
    
    [UnitType.DARK_MAGE]: {
        type: UnitType.DARK_MAGE,
        name: 'Dark Mage',
        description: 'Master of dark magic and curses',
        unitClass: 'ranged',
        size: 'normal',
        rarity: 'epic',
        baseStats: {
            maxHealth: 65,
            damage: 22,
            armor: 2,
            moveSpeed: 35,
            attackSpeed: 0.9,
            range: 300,
            mass: 36
        }
    },
    
    [UnitType.WARRIOR]: {
        type: UnitType.WARRIOR,
        name: 'Warrior',
        description: 'Stalwart frontline fighter',
        unitClass: 'frontline',
        size: 'normal',
        rarity: 'common',
        baseStats: {
            maxHealth: 200,
            damage: 16,
            armor: 6,
            moveSpeed: 50,
            attackSpeed: 1.0,
            range: 30,
            mass: 100
        }
    },
    
    [UnitType.NINJA]: {
        type: UnitType.NINJA,
        name: 'Ninja',
        description: 'Swift assassin with stealth abilities',
        unitClass: 'frontline',
        size: 'small',
        rarity: 'rare',
        baseStats: {
            maxHealth: 70,
            damage: 28,
            armor: 2,
            moveSpeed: 80,
            attackSpeed: 2.0,
            range: 35,
            mass: 30
        }
    },
    
    [UnitType.SHOTGUNNER]: {
        type: UnitType.SHOTGUNNER,
        name: 'Shotgunner',
        description: 'Close-range specialist with devastating firepower',
        unitClass: 'ranged',
        size: 'normal',
        rarity: 'epic',
        baseStats: {
            maxHealth: 90,
            damage: 35,
            armor: 4,
            moveSpeed: 45,
            attackSpeed: 0.6,
            range: 200,
            mass: 64
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