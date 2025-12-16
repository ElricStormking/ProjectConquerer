export type { ICommanderActiveSkill } from './ICommanderActiveSkill';
export { CommanderSkillRegistry } from './CommanderSkillRegistry';

// Triarch Dominion Skills
export { SkyfallCataclysm, JudgmentOfTheDawn, GrandBombardment } from './TriarchDominionSkills';

// Jade Dynasty Skills
export { DragonSpearBarrage, ShikigamiSummoning, ShadowCloneAmbush } from './JadeDynastySkills';

// Forbidden Bloodline Skills
export { SoulBlasphemy, SacrificialFeast, FleshLink } from './ForbiddenBloodlineSkills';

import { CommanderSkillRegistry } from './CommanderSkillRegistry';

/**
 * Ensure all commander skills are registered.
 * Skills are auto-registered when CommanderSkillRegistry is first accessed,
 * but this function can be called to ensure early initialization.
 */
export function registerAllCommanderSkills(): void {
    // Just accessing getInstance() will trigger initialization
    const registry = CommanderSkillRegistry.getInstance();
    console.log('[Skills] Verified registration:', registry.getAllSkillIds().length, 'skills available');
}
