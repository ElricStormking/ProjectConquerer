import Phaser from 'phaser';
import { ICommanderActiveSkill } from './ICommanderActiveSkill';
import { UnitManager } from '../UnitManager';

// Direct imports for synchronous registration
import { SkyfallCataclysm, JudgmentOfTheDawn, GrandBombardment } from './TriarchDominionSkills';
import { DragonSpearBarrage, ShikigamiSummoning, ShadowCloneAmbush } from './JadeDynastySkills';
import { SoulBlasphemy, SacrificialFeast, FleshLink } from './ForbiddenBloodlineSkills';

export class CommanderSkillRegistry {
    private static instance: CommanderSkillRegistry;
    private skills: Map<string, ICommanderActiveSkill> = new Map();
    private initialized: boolean = false;

    private constructor() {
        // Register all skills immediately in constructor
        this.initializeSkills();
    }

    public static getInstance(): CommanderSkillRegistry {
        if (!CommanderSkillRegistry.instance) {
            CommanderSkillRegistry.instance = new CommanderSkillRegistry();
        }
        return CommanderSkillRegistry.instance;
    }
    
    private initializeSkills(): void {
        if (this.initialized) return;
        this.initialized = true;
        
        // Triarch Dominion
        this.register(new SkyfallCataclysm());
        this.register(new JudgmentOfTheDawn());
        this.register(new GrandBombardment());
        
        // Jade Dynasty
        this.register(new DragonSpearBarrage());
        this.register(new ShikigamiSummoning());
        this.register(new ShadowCloneAmbush());
        
        // Forbidden Bloodline
        this.register(new SoulBlasphemy());
        this.register(new SacrificialFeast());
        this.register(new FleshLink());

        // Legacy aliases for backward compatibility with older data/save files
        this.registerAlias('orbital_strike', 'grand_bombardment');
        this.registerAlias('dragon_spear_barrage', 'dragon_strike');
        this.registerAlias('shikigami_summoning', 'shikigami_ritual');
        this.registerAlias('shadow_clone_ambush', 'shadowstep_backroll');
        
        console.log('[CommanderSkillRegistry] Initialized with skills:', this.getAllSkillIds());
    }

    public register(skill: ICommanderActiveSkill): void {
        if (this.skills.has(skill.id)) {
            console.warn(`[CommanderSkillRegistry] Skill ${skill.id} already registered, overwriting.`);
        }
        this.skills.set(skill.id, skill);
    }

    public get(skillId: string): ICommanderActiveSkill | undefined {
        return this.skills.get(skillId);
    }

    /**
     * Register an alias that points to an existing skill id.
     */
    private registerAlias(aliasId: string, targetId: string): void {
        if (this.skills.has(aliasId)) {
            return;
        }
        const target = this.skills.get(targetId);
        if (!target) {
            console.warn(`[CommanderSkillRegistry] Cannot register alias ${aliasId} -> ${targetId}: target not found`);
            return;
        }
        this.skills.set(aliasId, target);
    }

    public execute(
        skillId: string,
        scene: Phaser.Scene,
        unitManager: UnitManager,
        targetX: number,
        targetY: number
    ): boolean {
        const skill = this.skills.get(skillId);
        if (!skill) {
            console.warn(`[CommanderSkillRegistry] Skill not found: ${skillId}. Available skills:`, this.getAllSkillIds());
            return false;
        }
        console.log(`[CommanderSkillRegistry] Executing skill: ${skill.name} (${skillId}) at (${targetX}, ${targetY})`);
        skill.execute(scene, unitManager, targetX, targetY);
        return true;
    }

    public getAllSkillIds(): string[] {
        return Array.from(this.skills.keys());
    }
}
