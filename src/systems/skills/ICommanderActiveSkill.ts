import Phaser from 'phaser';
import { UnitManager } from '../UnitManager';
import { CommanderSkillTemplate } from '../../types/ironwars';

export interface ICommanderActiveSkill {
    id: string;
    name: string;
    description: string;
    configure?(template: CommanderSkillTemplate): void;

    execute(
        scene: Phaser.Scene,
        unitManager: UnitManager,
        targetX: number,
        targetY: number
    ): void;
}
