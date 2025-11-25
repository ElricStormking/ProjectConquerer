import { DataManager } from '../systems/DataManager';

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

// Deprecated: Use DataManager.getInstance().getSkillTemplate()
export const SKILL_TEMPLATES: Record<SkillType, Omit<Skill, 'currentRank'>> = {} as any;

export class SkillManager {
    private activeSkills: Map<SkillType, Skill> = new Map();
    
    public generateSkillChoices(playerLevel: number, numChoices: number = 3): Skill[] {
        // Use DataManager to get ALL skill templates
        // DataManager doesn't expose getAllSkills directly yet, let's fix that by iterating known types
        // Or better, assume we only want valid ones.
        // For now, iterate over the Enum values and fetch from DataManager
        
        const availableSkills: Array<Omit<Skill, 'currentRank'>> = [];
        const dataManager = DataManager.getInstance();

        // Iterate all enum values to check for templates
        Object.values(SkillType).forEach(type => {
            const template = dataManager.getSkillTemplate(type);
            if (template) {
                availableSkills.push(template);
            }
        });

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