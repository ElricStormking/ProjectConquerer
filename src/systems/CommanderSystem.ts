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
        this.castThunderStorm(worldX, worldY);
        this.emit('skill-cast', {
            cooldown: this.commander.cooldown,
            lastCast: this.lastCastTime
        });
        return true;
    }

    private castThunderStorm(centerX: number, centerY: number): void {
        const FIELD_RADIUS = 160;
        const IMPACT_RADIUS = 90;
        const STRIKES = 6;
        const STRIKE_INTERVAL = 150;
        const DAMAGE_PER_STRIKE = 12;

        const field = this.scene.add.graphics();
        field.setDepth(7800);
        field.setBlendMode(Phaser.BlendModes.ADD);
        field.fillStyle(0x101a33, 0.6);
        field.fillCircle(centerX, centerY, FIELD_RADIUS * 0.95);
        field.lineStyle(2, 0x4fd2ff, 0.7);
        field.strokeCircle(centerX, centerY, FIELD_RADIUS);
        this.scene.tweens.add({
            targets: field,
            alpha: 0,
            duration: STRIKES * STRIKE_INTERVAL + 300,
            onComplete: () => field.destroy()
        });

        const camera = this.scene.cameras.main;

        this.scene.time.addEvent({
            delay: STRIKE_INTERVAL,
            repeat: STRIKES - 1,
            callback: () => {
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const dist = Phaser.Math.FloatBetween(FIELD_RADIUS * 0.2, FIELD_RADIUS * 0.9);
                const strikeX = centerX + Math.cos(angle) * dist;
                const strikeY = centerY + Math.sin(angle) * dist;

                this.spawnLightningStrike(strikeX, strikeY, IMPACT_RADIUS);

                const enemies = this.unitManager.getUnitsByTeam(2);
                enemies.forEach(unit => {
                    const pos = unit.getPosition();
                    if (Phaser.Math.Distance.Between(pos.x, pos.y, strikeX, strikeY) <= IMPACT_RADIUS) {
                        unit.takeDamage(DAMAGE_PER_STRIKE);
                    }
                });

                camera.shake(70, 0.0025);
            }
        });
    }

    private spawnLightningStrike(x: number, y: number, impactRadius: number): void {
        const bolt = this.scene.add.graphics();
        bolt.setDepth(9000);
        bolt.setBlendMode(Phaser.BlendModes.ADD);
        bolt.lineStyle(4, 0xaee6ff, 1);

        const startY = y - 260;
        const endY = y + 10;
        const segments = 6;
        let currentX = x + Phaser.Math.Between(-10, 10);
        let currentY = startY;
        bolt.beginPath();
        bolt.moveTo(currentX, currentY);

        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const nextY = Phaser.Math.Linear(startY, endY, t);
            const offsetX = Phaser.Math.Between(-20, 20);
            const nextX = x + offsetX;
            bolt.lineTo(nextX, nextY);
            currentX = nextX;
            currentY = nextY;
        }
        bolt.strokePath();

        this.scene.tweens.add({
            targets: bolt,
            alpha: 0,
            duration: 160,
            onComplete: () => bolt.destroy()
        });

        const shock = this.scene.add.graphics();
        shock.setDepth(8800);
        shock.setBlendMode(Phaser.BlendModes.ADD);
        shock.lineStyle(2, 0x8fd8ff, 1);
        shock.strokeCircle(x, y, impactRadius * 0.6);
        this.scene.tweens.add({
            targets: shock,
            alpha: 0,
            scale: { from: 0.8, to: 1.4 },
            duration: 260,
            onComplete: () => shock.destroy()
        });
    }
}
