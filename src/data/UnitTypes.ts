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
    RAIDER_ARCHER = 'raider_archer',
    JADE_AZURE_SPEAR = 'jade_azure_spear',
    JADE_STORM_MONKS = 'jade_storm_monks',
    JADE_CROSSBOW_GUNNERS = 'jade_crossbow_gunners',
    JADE_HALBERD_GUARDIAN = 'jade_halberd_guardian',
    JADE_SHRINE_ONI = 'jade_shrine_oni',
    JADE_SHIKIGAMI_FOX = 'jade_shikigami_fox',
    JADE_CHI_DRAGOON = 'jade_chi_dragoon',
    JADE_SHURIKEN_NINJAS = 'jade_shuriken_ninjas',
    JADE_SHADOWBLADE_ASSASSINS = 'jade_shadowblade_assassins',
    JADE_SPIRIT_LANTERN = 'jade_spirit_lantern',
    JADE_PAPER_DOLL = 'jade_paper_doll',
    JADE_BLUE_ONI = 'jade_blue_oni',
    FROST_SHADE_SERVANT = 'shade_servant',
    FROST_PUTRID_ARCHER = 'putrid_archer',
    FROST_ETERNAL_WATCHER = 'eternal_watcher',
    FROST_CURSED_WALKER = 'cursed_walker',
    FROST_BLOODLINE_NOBLE = 'bloodline_noble',
    FROST_AGONY_SCREAMER = 'agony_screamer',
    FROST_FLESH_WEAVER = 'flesh_weaver',
    FROST_BOUND_SPECTRE = 'bound_spectre',
    FROST_ABOMINATION = 'abomination',
    FROST_FORBIDDEN_SCIENTIST = 'forbidden_scientist',
    FROST_SCREAMING_COFFIN = 'screaming_coffin',
    FROST_FLESH_CRAWLER = 'flesh_crawler',
    FROST_FLESH_TITAN = 'flesh_titan'
}

export interface UnitTemplate {
    type: UnitType;
    name: string;
    description: string;
    unitClass: 'frontline' | 'ranged' | 'support' | 'siege' | 'summoner';
    size: 'small' | 'normal' | 'large';
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    /**
     * How many copies of this unit a deployment card should spawn during
     * the preparation phase. If undefined, falls back to the legacy default.
     */
    spawnAmount?: number;
    spriteScale?: number;
    spriteOffsetY?: number;
    baseStats: {
        maxHealth: number;
        damage: number;
        armor: number;
        moveSpeed: number;
        attackSpeed: number;
        range: number;
        mass: number;
    };
    skillPrimaryId?: string;
    skillSecondaryId?: string;
    passiveSkillId?: string;
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
            spriteScale: template.spriteScale,
            spriteOffsetY: template.spriteOffsetY,
            unitTemplate: template,
            stats: {
                maxHealth: Math.round(template.baseStats.maxHealth * rankMultiplier),
                damage: Math.round(template.baseStats.damage * rankMultiplier),
                armor: Math.round(template.baseStats.armor * rankMultiplier),
                moveSpeed: template.baseStats.moveSpeed,
                attackSpeed: template.baseStats.attackSpeed,
                range: template.baseStats.range,
                mass: template.baseStats.mass
            },
            skillPrimaryId: template.skillPrimaryId,
            skillSecondaryId: template.skillSecondaryId,
            passiveSkillId: template.passiveSkillId
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