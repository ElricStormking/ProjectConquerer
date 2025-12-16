import Phaser from 'phaser';
import { UnitManager } from '../UnitManager';

export interface ICommanderActiveSkill {
    id: string;
    name: string;
    description: string;

    execute(
        scene: Phaser.Scene,
        unitManager: UnitManager,
        targetX: number,
        targetY: number
    ): void;
}
