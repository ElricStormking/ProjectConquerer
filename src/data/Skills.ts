export enum SkillType {
    DAMAGE_BOOST = 'damage_boost',
    HEALTH_BOOST = 'health_boost',
    SPEED_BOOST = 'speed_boost',
    ARMOR_BOOST = 'armor_boost',
    ATTACK_SPEED = 'attack_speed',
    RANGE_BOOST = 'range_boost',
    CRITICAL_STRIKE = 'critical_strike',
    REGENERATION = 'regeneration',
    THORNS = 'thorns',
    EXPLOSIVE_DEATH = 'explosive_death',
    MULTI_SHOT = 'multi_shot',
    PIERCING_SHOT = 'piercing_shot'
}

export interface Skill {
    type: SkillType;
    name: string;
    description: string;
    maxRank: number;
    currentRank: number;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    effects: SkillEffect[];
}

export interface SkillEffect {
    stat: string;
    baseValue: number;
    perRank: number;
    isMultiplier: boolean;
}

export const SKILL_TEMPLATES: Record<SkillType, Omit<Skill, 'currentRank'>> = {
    [SkillType.DAMAGE_BOOST]: {
        type: SkillType.DAMAGE_BOOST,
        name: 'Battle Fury',
        description: 'Increases damage dealt by all units',
        maxRank: 5,
        icon: '⚔️',
        rarity: 'common',
        effects: [{
            stat: 'damage',
            baseValue: 10,
            perRank: 5,
            isMultiplier: false
        }]
    },
    
    [SkillType.HEALTH_BOOST]: {
        type: SkillType.HEALTH_BOOST,
        name: 'Fortitude',
        description: 'Increases maximum health of all units',
        maxRank: 5,
        icon: '❤️',
        rarity: 'common',
        effects: [{
            stat: 'maxHealth',
            baseValue: 20,
            perRank: 10,
            isMultiplier: false
        }]
    },
    
    [SkillType.SPEED_BOOST]: {
        type: SkillType.SPEED_BOOST,
        name: 'Swift Advance',
        description: 'Increases movement speed of all units',
        maxRank: 5,
        icon: '💨',
        rarity: 'common',
        effects: [{
            stat: 'moveSpeed',
            baseValue: 15,
            perRank: 10,
            isMultiplier: true
        }]
    },
    
    [SkillType.ARMOR_BOOST]: {
        type: SkillType.ARMOR_BOOST,
        name: 'Iron Will',
        description: 'Increases armor of all units',
        maxRank: 5,
        icon: '🛡️',
        rarity: 'common',
        effects: [{
            stat: 'armor',
            baseValue: 2,
            perRank: 1,
            isMultiplier: false
        }]
    },
    
    [SkillType.ATTACK_SPEED]: {
        type: SkillType.ATTACK_SPEED,
        name: 'Berserker Rage',
        description: 'Increases attack speed of all units',
        maxRank: 5,
        icon: '🗡️',
        rarity: 'rare',
        effects: [{
            stat: 'attackSpeed',
            baseValue: 20,
            perRank: 15,
            isMultiplier: true
        }]
    },
    
    [SkillType.RANGE_BOOST]: {
        type: SkillType.RANGE_BOOST,
        name: 'Eagle Eye',
        description: 'Increases attack range of all units',
        maxRank: 5,
        icon: '🎯',
        rarity: 'rare',
        effects: [{
            stat: 'range',
            baseValue: 20,
            perRank: 15,
            isMultiplier: true
        }]
    },
    
    [SkillType.CRITICAL_STRIKE]: {
        type: SkillType.CRITICAL_STRIKE,
        name: 'Deadly Precision',
        description: 'Increases critical hit chance and damage',
        maxRank: 5,
        icon: '💥',
        rarity: 'rare',
        effects: [{
            stat: 'critChance',
            baseValue: 5,
            perRank: 3,
            isMultiplier: false
        }, {
            stat: 'critMultiplier',
            baseValue: 0.2,
            perRank: 0.1,
            isMultiplier: false
        }]
    },
    
    [SkillType.REGENERATION]: {
        type: SkillType.REGENERATION,
        name: 'Healing Aura',
        description: 'Units slowly regenerate health over time',
        maxRank: 5,
        icon: '✨',
        rarity: 'epic',
        effects: [{
            stat: 'healthRegen',
            baseValue: 2,
            perRank: 1,
            isMultiplier: false
        }]
    },
    
    [SkillType.THORNS]: {
        type: SkillType.THORNS,
        name: 'Retribution',
        description: 'Units reflect damage back to attackers',
        maxRank: 3,
        icon: '🌹',
        rarity: 'epic',
        effects: [{
            stat: 'thornsDamage',
            baseValue: 20,
            perRank: 10,
            isMultiplier: true
        }]
    },
    
    [SkillType.EXPLOSIVE_DEATH]: {
        type: SkillType.EXPLOSIVE_DEATH,
        name: 'Final Vengeance',
        description: 'Units explode when they die, damaging enemies',
        maxRank: 3,
        icon: '💣',
        rarity: 'epic',
        effects: [{
            stat: 'deathExplosion',
            baseValue: 50,
            perRank: 25,
            isMultiplier: false
        }]
    },
    
    [SkillType.MULTI_SHOT]: {
        type: SkillType.MULTI_SHOT,
        name: 'Volley Fire',
        description: 'Ranged units have a chance to shoot multiple projectiles',
        maxRank: 3,
        icon: '🏹',
        rarity: 'legendary',
        effects: [{
            stat: 'multiShotChance',
            baseValue: 25,
            perRank: 15,
            isMultiplier: false
        }, {
            stat: 'extraProjectiles',
            baseValue: 1,
            perRank: 1,
            isMultiplier: false
        }]
    },
    
    [SkillType.PIERCING_SHOT]: {
        type: SkillType.PIERCING_SHOT,
        name: 'Armor Breaker',
        description: 'Attacks have a chance to ignore armor completely',
        maxRank: 3,
        icon: '⚡',
        rarity: 'legendary',
        effects: [{
            stat: 'armorPierceChance',
            baseValue: 15,
            perRank: 10,
            isMultiplier: false
        }]
    }
};

export class SkillManager {
    private activeSkills: Map<SkillType, Skill> = new Map();
    
    public generateSkillChoices(playerLevel: number, numChoices: number = 3): Skill[] {
        const availableSkills = Object.values(SKILL_TEMPLATES);
        const choices: Skill[] = [];
        
        // Weight skills by rarity and current rank
        const weightedSkills = availableSkills.map(template => {
            const currentSkill = this.activeSkills.get(template.type);
            const currentRank = currentSkill ? currentSkill.currentRank : 0;
            
            // Can't level up maxed skills
            if (currentRank >= template.maxRank) return null;
            
            // Rarity weights
            const rarityWeights = {
                common: 100,
                rare: 60,
                epic: 25,
                legendary: 5
            };
            
            // Level requirements for rarities
            const rarityLevelReqs = {
                common: 1,
                rare: 3,
                epic: 7,
                legendary: 12
            };
            
            if (playerLevel < rarityLevelReqs[template.rarity]) return null;
            
            return {
                skill: template,
                weight: rarityWeights[template.rarity],
                currentRank
            };
        }).filter(item => item !== null);
        
        // Select random skills based on weight
        for (let i = 0; i < numChoices && weightedSkills.length > 0; i++) {
            const totalWeight = weightedSkills.reduce((sum, item) => sum + item!.weight, 0);
            let random = Math.random() * totalWeight;
            
            let selectedIndex = 0;
            for (let j = 0; j < weightedSkills.length; j++) {
                random -= weightedSkills[j]!.weight;
                if (random <= 0) {
                    selectedIndex = j;
                    break;
                }
            }
            
            const selected = weightedSkills[selectedIndex]!;
            const skill: Skill = {
                ...selected.skill,
                currentRank: selected.currentRank + 1
            };
            
            choices.push(skill);
            weightedSkills.splice(selectedIndex, 1);
        }
        
        return choices;
    }
    
    public selectSkill(skill: Skill): void {
        this.activeSkills.set(skill.type, skill);
    }
    
    public getActiveSkills(): Skill[] {
        return Array.from(this.activeSkills.values());
    }
    
    public getSkillRank(type: SkillType): number {
        const skill = this.activeSkills.get(type);
        return skill ? skill.currentRank : 0;
    }
}