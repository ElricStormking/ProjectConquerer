import { UnitConfig } from '../entities/Unit';

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
    },

    [UnitType.COG_SOLDIER]: {
        type: UnitType.COG_SOLDIER,
        name: 'Feral Warrior',
        description: 'Disciplined frontline infantry of the Cog Dominion',
        unitClass: 'frontline',
        size: 'normal',
        rarity: 'common',
        baseStats: {
            maxHealth: 160,
            damage: 18,
            armor: 5,
            moveSpeed: 70,
            attackSpeed: 0.66,
            range: 60,
            mass: 85
        }
    },

    [UnitType.COG_RAILGUNNER]: {
        type: UnitType.COG_RAILGUNNER,
        name: 'Railgunner',
        description: 'Precision long-range specialist',
        unitClass: 'ranged',
        size: 'normal',
        rarity: 'rare',
        baseStats: {
            maxHealth: 110,
            damage: 32,
            armor: 2,
            moveSpeed: 55,
            attackSpeed: 0.7,
            range: 420,
            mass: 60
        }
    },

    [UnitType.COG_AEGIS_TANK]: {
        type: UnitType.COG_AEGIS_TANK,
        name: 'Aegis Tank',
        description: 'Slow but indestructible bastion tank',
        unitClass: 'frontline',
        size: 'large',
        rarity: 'rare',
        baseStats: {
            maxHealth: 420,
            damage: 24,
            armor: 9,
            moveSpeed: 40,
            attackSpeed: 0.5,
            range: 90,
            mass: 100
        }
    },

    [UnitType.COG_MEDIC_DRONE]: {
        type: UnitType.COG_MEDIC_DRONE,
        name: 'Medic Druid',
        description: 'Support unit that restores allied durability',
        unitClass: 'support',
        size: 'small',
        rarity: 'rare',
        baseStats: {
            maxHealth: 90,
            damage: 5,
            armor: 1,
            moveSpeed: 40,
            attackSpeed: 0.6,
            range: 120,
            mass: 140
        }
    },

    [UnitType.COG_THUNDER_CANNON]: {
        type: UnitType.COG_THUNDER_CANNON,
        name: 'Thunder Mage',
        description: 'Heavy siege artillery of the Cog Dominion',
        unitClass: 'siege',
        size: 'large',
        rarity: 'epic',
        baseStats: {
            maxHealth: 260,
            damage: 55,
            armor: 4,
            moveSpeed: 30,
            attackSpeed: 0.45,
            range: 520,
            mass: 120
        }
    },

    [UnitType.RAIDER_GRUNT]: {
        type: UnitType.RAIDER_GRUNT,
        name: 'Iron Raider',
        description: 'Aggressive melee attacker',
        unitClass: 'frontline',
        size: 'normal',
        rarity: 'common',
        baseStats: {
            maxHealth: 130,
            damage: 16,
            armor: 3,
            moveSpeed: 65,
            attackSpeed: 0.7,
            range: 50,
            mass: 70
        }
    },

    [UnitType.RAIDER_BOMBER]: {
        type: UnitType.RAIDER_BOMBER,
        name: 'Siege Bomber',
        description: 'Launches explosives at fortresses',
        unitClass: 'siege',
        size: 'large',
        rarity: 'rare',
        baseStats: {
            maxHealth: 200,
            damage: 40,
            armor: 2,
            moveSpeed: 45,
            attackSpeed: 0.55,
            range: 380,
            mass: 110
        }
    },

    [UnitType.RAIDER_BOSS]: {
        type: UnitType.RAIDER_BOSS,
        name: 'Iron Juggernaut',
        description: 'Massive raider tank with crushing area attacks',
        unitClass: 'frontline',
        size: 'large',
        rarity: 'legendary',
        baseStats: {
            maxHealth: 1260,  // 3x Aegis Tank HP (420)
            damage: 72,       // 3x Aegis Tank damage (24)
            armor: 10,
            moveSpeed: 30,
            attackSpeed: 0.33, // ~3s cooldown via canAttack()
            range: 120,        // short range; AoE around itself
            mass: 900
        }
    },

    [UnitType.RAIDER_ROGUE]: {
        type: UnitType.RAIDER_ROGUE,
        name: 'Raider Cutthroat',
        description: 'Fast melee assassin that darts around the battlefield',
        unitClass: 'frontline',
        size: 'small',
        rarity: 'rare',
        baseStats: {
            maxHealth: 90,
            damage: 22,
            armor: 2,
            moveSpeed: 80,
            attackSpeed: 1.6,
            range: 45,
            mass: 60
        }
    },

    [UnitType.RAIDER_ARCHER]: {
        type: UnitType.RAIDER_ARCHER,
        name: 'Raider Archer',
        description: 'Long-range raider marksman supporting the boss',
        unitClass: 'ranged',
        size: 'normal',
        rarity: 'rare',
        baseStats: {
            maxHealth: 95,
            damage: 24,
            armor: 2,
            moveSpeed: 50,
            attackSpeed: 0.9,
            range: 420,
            mass: 58
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