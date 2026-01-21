import Phaser from 'phaser';
import { ICommanderActiveSkill } from './ICommanderActiveSkill';
import { UnitManager } from '../UnitManager';
import { CommanderSkillTemplate } from '../../types/ironwars';
import { UnitType } from '../../data/UnitTypes';

export class AbyssalDevastation implements ICommanderActiveSkill {
    id = 'abyssal_bloodlink';
    name = 'Abyssal Devastation';
    description = 'Smashes enemies, fears them, and siphons life to nearby allies.';

    private radius = 160;
    private damage = 60;
    private fearMs = 1200;
    private lifestealPercent = 0.25;

    configure(template: CommanderSkillTemplate): void {
        this.radius = template.radius ?? this.radius;
        this.damage = template.damage ?? this.damage;
        this.fearMs = template.stunMs ?? template.durationMs ?? this.fearMs;
        if (typeof template.siphonPercent === 'number' && template.siphonPercent > 0) {
            this.lifestealPercent = template.siphonPercent;
        }
    }

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const RADIUS = this.radius;
        const DAMAGE = this.damage;
        const FEAR_MS = this.fearMs;
        const LIFESTEAL = this.lifestealPercent;

        const slam = scene.add.graphics();
        slam.setDepth(8800);
        slam.setBlendMode(Phaser.BlendModes.ADD);
        slam.fillStyle(0x660000, 0.55);
        slam.fillCircle(centerX, centerY, RADIUS);
        slam.lineStyle(4, 0xff3333, 0.95);
        slam.strokeCircle(centerX, centerY, RADIUS);
        slam.lineStyle(2, 0xaa0000, 0.7);
        slam.strokeCircle(centerX, centerY, RADIUS * 0.6);

        scene.cameras.main.shake(80, 0.003);
        scene.time.delayedCall(450, () => slam.destroy());

        const now = scene.time.now;
        let totalDamage = 0;
        const enemies = unitManager.getUnitsByTeam(2);
        enemies.forEach(unit => {
            const pos = unit.getPosition();
            if (Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS) {
                unit.takeDamage(DAMAGE);
                totalDamage += DAMAGE;
                if (FEAR_MS > 0) {
                    (unit as any).applyFear?.(FEAR_MS, now);
                }
            }
        });

        if (LIFESTEAL > 0 && totalDamage > 0) {
            const allies = unitManager.getUnitsByTeam(1).filter(unit => {
                if (unit.isDead()) return false;
                const pos = unit.getPosition();
                return Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS;
            });
            if (allies.length > 0) {
                const healPerAlly = Math.max(1, Math.floor((totalDamage * LIFESTEAL) / allies.length));
                allies.forEach(unit => {
                    unit.heal(healPerAlly);
                    const halo = scene.add.graphics();
                    halo.setDepth(9000);
                    halo.setBlendMode(Phaser.BlendModes.ADD);
                    halo.lineStyle(2, 0xff6666, 0.8);
                    halo.strokeCircle(unit.getPosition().x, unit.getPosition().y, 18);
                    scene.tweens.add({
                        targets: halo,
                        alpha: 0,
                        scale: { from: 0.8, to: 1.6 },
                        duration: 350,
                        onComplete: () => halo.destroy()
                    });
                });
            }
        }
    }
}

export class MassEnthrall implements ICommanderActiveSkill {
    id = 'crimson_veil';
    name = 'Mass Enthrall';
    description = 'Charms enemies in a cone and summons illusory succubi.';

    private radius = 220;
    private charmDurationMs = 2200;
    private coneAngleRad = Phaser.Math.DegToRad(80);
    private summonCount = 2;
    private summonDurationMs = 8000;
    private summonRadius = 90;

    configure(template: CommanderSkillTemplate): void {
        this.radius = template.radius ?? this.radius;
        this.charmDurationMs = template.durationMs ?? this.charmDurationMs;
        this.summonCount = template.summonCount ?? this.summonCount;
        this.summonDurationMs = template.summonDurationMs ?? this.summonDurationMs;
        this.summonRadius = template.summonRadius ?? this.summonRadius;
    }

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const RADIUS = this.radius;
        const CHARM_MS = this.charmDurationMs;
        const SUMMON_COUNT = this.summonCount;
        const SUMMON_DURATION = this.summonDurationMs;
        const SUMMON_RADIUS = this.summonRadius;
        const HALF_CONE = this.coneAngleRad / 2;
        const COS_HALF = Math.cos(HALF_CONE);

        const enemies = unitManager.getUnitsByTeam(2);
        const enemiesInRange = enemies.filter(unit => {
            const pos = unit.getPosition();
            return Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS;
        });

        let dirX = 0;
        let dirY = -1;
        if (enemiesInRange.length > 0) {
            let nearest = enemiesInRange[0];
            let nearestDist = Phaser.Math.Distance.Between(centerX, centerY, nearest.getPosition().x, nearest.getPosition().y);
            enemiesInRange.forEach(unit => {
                const pos = unit.getPosition();
                const dist = Phaser.Math.Distance.Between(centerX, centerY, pos.x, pos.y);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = unit;
                }
            });
            const pos = nearest.getPosition();
            const len = Math.max(1, Phaser.Math.Distance.Between(centerX, centerY, pos.x, pos.y));
            dirX = (pos.x - centerX) / len;
            dirY = (pos.y - centerY) / len;
        }

        const coneAngle = Math.atan2(dirY, dirX);
        const cone = scene.add.graphics();
        cone.setDepth(8800);
        cone.setBlendMode(Phaser.BlendModes.ADD);
        cone.fillStyle(0x8b1a8b, 0.25);
        cone.beginPath();
        cone.moveTo(centerX, centerY);
        cone.arc(centerX, centerY, RADIUS, coneAngle - HALF_CONE, coneAngle + HALF_CONE, false);
        cone.closePath();
        cone.fillPath();
        cone.lineStyle(3, 0xff55ff, 0.75);
        cone.strokeCircle(centerX, centerY, RADIUS * 0.95);

        scene.time.delayedCall(600, () => cone.destroy());

        const now = scene.time.now;
        enemiesInRange.forEach(unit => {
            const pos = unit.getPosition();
            const vx = pos.x - centerX;
            const vy = pos.y - centerY;
            const dist = Math.max(1, Math.sqrt(vx * vx + vy * vy));
            const dot = (vx * dirX + vy * dirY) / dist;
            if (dot >= COS_HALF) {
                (unit as any).applyCharm?.(CHARM_MS, now);
            }
        });

        for (let i = 0; i < SUMMON_COUNT; i++) {
            scene.time.delayedCall(i * 180, () => {
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const dist = Phaser.Math.FloatBetween(10, SUMMON_RADIUS);
                const x = centerX + Math.cos(angle) * dist;
                const y = centerY + Math.sin(angle) * dist;
                this.spawnIllusion(scene, unitManager, x, y, SUMMON_DURATION);
            });
        }
    }

    private spawnIllusion(
        scene: Phaser.Scene,
        unitManager: UnitManager,
        x: number,
        y: number,
        durationMs: number
    ): void {
        const config = unitManager.createUnitConfig(UnitType.ABYSS_SUCCUBUS_TEMPTRESS, 1, x, y);
        const unit = unitManager.spawnUnit(config);
        if (!unit) return;

        const sprite = (unit as any).sprite as Phaser.GameObjects.Sprite | undefined;
        if (sprite) {
            sprite.setAlpha(0.6);
        }

        scene.time.delayedCall(durationMs, () => {
            if (unit.isDead()) return;
            const unitSprite = (unit as any).sprite as Phaser.GameObjects.Sprite | undefined;
            if (unitSprite) {
                scene.tweens.add({
                    targets: unitSprite,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => unitManager.removeUnit(unit.getId())
                });
            } else {
                unitManager.removeUnit(unit.getId());
            }
        });
    }
}

export class RiftOfTheAbyss implements ICommanderActiveSkill {
    id = 'abyssal_ritual';
    name = 'Rift of the Abyss';
    description = 'Opens a chaos rift that damages enemies and spawns imps.';

    private radius = 180;
    private durationMs = 8000;
    private dotTickMs = 500;
    private dotDamage = 12;
    private summonCount = 1;
    private summonDurationMs = 8000;
    private summonRadius = 110;
    private summonIntervalMs = 3000;

    configure(template: CommanderSkillTemplate): void {
        this.radius = template.radius ?? this.radius;
        this.durationMs = template.durationMs ?? this.durationMs;
        this.dotTickMs = template.dotTickMs ?? this.dotTickMs;
        this.dotDamage = template.dotDamage ?? this.dotDamage;
        this.summonCount = template.summonCount ?? this.summonCount;
        this.summonDurationMs = template.summonDurationMs ?? this.summonDurationMs;
        this.summonRadius = template.summonRadius ?? this.summonRadius;
    }

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const RADIUS = this.radius;
        const DURATION = this.durationMs;
        const DOT_TICK = this.dotTickMs;
        const DOT_DAMAGE = this.dotDamage;
        const SUMMON_COUNT = this.summonCount;
        const SUMMON_DURATION = this.summonDurationMs;
        const SUMMON_RADIUS = this.summonRadius;
        const SUMMON_INTERVAL = this.summonIntervalMs;

        const rift = scene.add.graphics();
        rift.setDepth(7800);
        rift.setBlendMode(Phaser.BlendModes.ADD);
        rift.fillStyle(0x2a001a, 0.6);
        rift.fillCircle(centerX, centerY, RADIUS);
        rift.lineStyle(3, 0xff3377, 0.9);
        rift.strokeCircle(centerX, centerY, RADIUS);
        rift.lineStyle(2, 0x880033, 0.7);
        rift.strokeCircle(centerX, centerY, RADIUS * 0.6);

        scene.time.delayedCall(DURATION, () => rift.destroy());

        const damageEvent = scene.time.addEvent({
            delay: DOT_TICK,
            repeat: Math.max(0, Math.floor(DURATION / DOT_TICK) - 1),
            callback: () => {
                const enemies = unitManager.getUnitsByTeam(2);
                enemies.forEach(unit => {
                    const pos = unit.getPosition();
                    if (Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS) {
                        unit.takeDamage(DOT_DAMAGE);
                    }
                });
            }
        });

        const summonEvent = scene.time.addEvent({
            delay: SUMMON_INTERVAL,
            repeat: Math.max(0, Math.floor(DURATION / SUMMON_INTERVAL) - 1),
            callback: () => {
                for (let i = 0; i < SUMMON_COUNT; i++) {
                    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                    const dist = Phaser.Math.FloatBetween(10, SUMMON_RADIUS);
                    const x = centerX + Math.cos(angle) * dist;
                    const y = centerY + Math.sin(angle) * dist;
                    this.spawnImp(scene, unitManager, x, y, SUMMON_DURATION);
                }
            }
        });

        scene.time.delayedCall(DURATION + 50, () => {
            damageEvent.destroy();
            summonEvent.destroy();
        });
    }

    private spawnImp(
        scene: Phaser.Scene,
        unitManager: UnitManager,
        x: number,
        y: number,
        durationMs: number
    ): void {
        const config = unitManager.createUnitConfig(UnitType.ABYSS_ABYSSAL_IMP, 1, x, y);
        const unit = unitManager.spawnUnit(config);
        if (!unit) return;

        scene.time.delayedCall(durationMs, () => {
            if (unit.isDead()) return;
            const sprite = (unit as any).sprite as Phaser.GameObjects.Sprite | undefined;
            if (sprite) {
                scene.tweens.add({
                    targets: sprite,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => unitManager.removeUnit(unit.getId())
                });
            } else {
                unitManager.removeUnit(unit.getId());
            }
        });
    }
}
