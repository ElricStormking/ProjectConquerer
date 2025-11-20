import Phaser from 'phaser';
import { ICommanderConfig } from '../types/ironwars';
import { UnitManager } from './UnitManager';

export class CommanderSystem extends Phaser.Events.EventEmitter {
    private commander?: ICommanderConfig;
    private lastCastTime = 0;
    private keySpace?: Phaser.Input.Keyboard.Key;

    constructor(
        private scene: Phaser.Scene,
        private unitManager: UnitManager
    ) {
        super();
    }

    public initialize(commander: ICommanderConfig): void {
        this.commander = commander;
        this.lastCastTime = -commander.cooldown;
        this.keySpace = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.keySpace?.on('down', () => this.tryCastAtPointer());
        this.emit('commander-ready', commander);
    }

    public tryCastAtPointer(): void {
        if (!this.commander) return;
        const pointer = this.scene.input.activePointer;
        this.tryCast(pointer.worldX, pointer.worldY);
    }

    public tryCast(worldX: number, worldY: number): boolean {
        if (!this.commander) return false;
        const now = this.scene.time.now;
        if (now - this.lastCastTime < this.commander.cooldown) {
            return false;
        }
        this.lastCastTime = now;
        this.castArtillery(worldX, worldY);
        this.emit('skill-cast', {
            cooldown: this.commander.cooldown,
            lastCast: this.lastCastTime
        });
        return true;
    }

    private castArtillery(worldX: number, worldY: number): void {
        const radius = 140;
        const gfx = this.scene.add.graphics();
        gfx.lineStyle(3, 0xff5533, 1);
        gfx.strokeCircle(worldX, worldY, radius);
        this.scene.tweens.add({ targets: gfx, alpha: 0, duration: 400, onComplete: () => gfx.destroy() });

        const enemies = this.unitManager.getUnitsByTeam(2);
        enemies.forEach(unit => {
            const pos = unit.getPosition();
            if (Phaser.Math.Distance.Between(pos.x, pos.y, worldX, worldY) <= radius) {
                unit.takeDamage(50);
            }
        });
    }
}
