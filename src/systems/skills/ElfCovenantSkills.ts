import Phaser from 'phaser';
import { ICommanderActiveSkill } from './ICommanderActiveSkill';
import { UnitManager } from '../UnitManager';
import { CommanderSkillTemplate } from '../../types/ironwars';
import { UnitType } from '../../data/UnitTypes';
import type { DamageEvent } from '../CombatSystem';

export class Overgrowth implements ICommanderActiveSkill {
    id = 'overgrowth';
    name = 'Overgrowth';
    description = 'Summons nature spirits in the target area.';

    private radius = 120;
    private damage = 12;
    private summonCount = 3;
    private summonDuration = 5000;
    private summonRadius = 70;

    configure(template: CommanderSkillTemplate): void {
        this.radius = template.radius ?? this.radius;
        this.damage = template.damage ?? this.damage;
        this.summonCount = template.summonCount ?? this.summonCount;
        this.summonDuration = template.summonDurationMs ?? this.summonDuration;
        this.summonRadius = template.summonRadius ?? this.summonRadius;
    }

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const RADIUS = this.radius;
        const DAMAGE = this.damage;
        const SUMMON_COUNT = this.summonCount;
        const SUMMON_DURATION = this.summonDuration;
        const SUMMON_RADIUS = this.summonRadius;

        const bloom = scene.add.graphics();
        bloom.setDepth(7800);
        bloom.setBlendMode(Phaser.BlendModes.ADD);
        bloom.fillStyle(0x2ecc71, 0.25);
        bloom.fillCircle(centerX, centerY, RADIUS);
        bloom.lineStyle(3, 0x6bff9c, 0.85);
        bloom.strokeCircle(centerX, centerY, RADIUS);

        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const px = centerX + Math.cos(angle) * RADIUS * 0.7;
            const py = centerY + Math.sin(angle) * RADIUS * 0.7;
            bloom.fillStyle(0x8cffc3, 0.7);
            bloom.fillCircle(px, py, 6);
        }

        scene.tweens.add({
            targets: bloom,
            alpha: 0,
            duration: 650,
            onComplete: () => bloom.destroy()
        });

        if (DAMAGE > 0) {
            const enemies = unitManager.getUnitsByTeam(2);
            enemies.forEach(unit => {
                const pos = unit.getPosition();
                if (Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS) {
                    unit.takeDamage(DAMAGE);
                }
            });
        }

        for (let i = 0; i < SUMMON_COUNT; i++) {
            scene.time.delayedCall(i * 120, () => {
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const dist = Phaser.Math.FloatBetween(SUMMON_RADIUS * 0.2, SUMMON_RADIUS);
                const spawnX = centerX + Math.cos(angle) * dist;
                const spawnY = centerY + Math.sin(angle) * dist;
                this.spawnNatureSpirit(scene, unitManager, spawnX, spawnY, SUMMON_DURATION);
            });
        }
    }

    private spawnNatureSpirit(
        scene: Phaser.Scene,
        unitManager: UnitManager,
        x: number,
        y: number,
        durationMs: number
    ): void {
        const spawnFx = scene.add.graphics();
        spawnFx.setDepth(9000);
        spawnFx.setBlendMode(Phaser.BlendModes.ADD);
        spawnFx.fillStyle(0xb8ffde, 0.85);
        spawnFx.fillCircle(x, y, 18);
        scene.tweens.add({
            targets: spawnFx,
            alpha: 0,
            scale: { from: 0.5, to: 1.6 },
            duration: 300,
            onComplete: () => spawnFx.destroy()
        });

        const config = unitManager.createUnitConfig(UnitType.ELF_GLOW_SPROUT_SPIRIT, 1, x, y);
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

export class JudgmentOfWorldTree implements ICommanderActiveSkill {
    id = 'judgment_of_world_tree';
    name = 'Judgment of the World Tree';
    description = 'Shockwave knocks back enemies and shields allies.';

    private radius = 140;
    private damage = 0;
    private knockbackForce = 120;
    private shieldPercent = 1;
    private shieldDuration = 2000;

    configure(template: CommanderSkillTemplate): void {
        this.radius = template.radius ?? this.radius;
        this.damage = template.damage ?? this.damage;
        this.knockbackForce = template.knockbackForce ?? this.knockbackForce;
        this.shieldPercent = template.shieldPercent ?? this.shieldPercent;
        this.shieldDuration = template.shieldDurationMs ?? this.shieldDuration;
    }

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const RADIUS = this.radius;
        const DAMAGE = this.damage;
        const KNOCKBACK_FORCE = this.knockbackForce;
        const SHIELD_PERCENT = this.shieldPercent;
        const SHIELD_DURATION = this.shieldDuration;

        const shockwave = scene.add.graphics();
        shockwave.setDepth(9000);
        shockwave.setBlendMode(Phaser.BlendModes.ADD);
        shockwave.lineStyle(5, 0x8bff70, 0.9);
        shockwave.strokeCircle(centerX, centerY, RADIUS * 0.2);

        scene.tweens.add({
            targets: shockwave,
            scale: { from: 0.4, to: 1.1 },
            alpha: 0,
            duration: 450,
            onComplete: () => shockwave.destroy()
        });

        scene.time.delayedCall(120, () => {
            const enemies = unitManager.getUnitsByTeam(2);
            enemies.forEach(unit => {
                const pos = unit.getPosition();
                if (Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS) {
                    if (DAMAGE > 0) {
                        unit.takeDamage(DAMAGE);
                    }
                    const angle = Phaser.Math.Angle.Between(centerX, centerY, pos.x, pos.y);
                    unit.applyForce(Math.cos(angle) * KNOCKBACK_FORCE, Math.sin(angle) * KNOCKBACK_FORCE);
                }
            });

            const allies = unitManager.getUnitsByTeam(1);
            allies.forEach(unit => {
                const pos = unit.getPosition();
                if (Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS) {
                    const shieldAmount = unit.getMaxHp() * SHIELD_PERCENT;
                    unit.applyShield(shieldAmount, SHIELD_DURATION);

                    const halo = scene.add.graphics();
                    halo.setDepth(8600);
                    halo.setBlendMode(Phaser.BlendModes.ADD);
                    halo.lineStyle(2, 0xc2ff9a, 0.8);
                    halo.strokeCircle(pos.x, pos.y, 20);
                    scene.tweens.add({
                        targets: halo,
                        alpha: 0,
                        scale: { from: 1, to: 1.6 },
                        duration: 400,
                        onComplete: () => halo.destroy()
                    });
                }
            });

            scene.cameras.main.flash(150, 120, 255, 120);
        });
    }
}

export class SoulBond implements ICommanderActiveSkill {
    id = 'soul_bond';
    name = 'Soul Bond';
    description = 'Links allies sharing damage and granting lifesteal.';

    private radius = 150;
    private duration = 6000;
    private lifestealPercent = 0.3;
    private damageSharePercent = 0;

    configure(template: CommanderSkillTemplate): void {
        this.radius = template.radius ?? this.radius;
        this.duration = template.durationMs ?? this.duration;
        if (typeof template.siphonPercent === 'number' && template.siphonPercent > 0) {
            this.lifestealPercent = template.siphonPercent;
        }
        if (typeof template.damageSharePercent === 'number' && template.damageSharePercent > 0) {
            this.damageSharePercent = template.damageSharePercent;
        }
    }

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const RADIUS = this.radius;
        const DURATION = this.duration;
        const LIFESTEAL = this.lifestealPercent;

        const allies = unitManager.getUnitsByTeam(1).filter(unit => {
            const pos = unit.getPosition();
            return Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS;
        });

        if (allies.length === 0) return;

        const sharePercent =
            this.damageSharePercent > 0
                ? this.damageSharePercent
                : Math.max(0, (allies.length - 1) / allies.length);

        allies.forEach(unit => {
            if (sharePercent > 0) {
                unit.applyDamageShare(sharePercent, allies, DURATION);
            }
        });

        const bondField = scene.add.graphics();
        bondField.setDepth(7800);
        bondField.setBlendMode(Phaser.BlendModes.ADD);

        let elapsed = 0;
        const linkInterval = 80;
        const linkEvent = scene.time.addEvent({
            delay: linkInterval,
            repeat: Math.max(1, Math.floor(DURATION / linkInterval)),
            callback: () => {
                elapsed += linkInterval;
                bondField.clear();
                const alpha = 0.6 * (1 - elapsed / DURATION);
                bondField.lineStyle(2, 0x6effd4, alpha);
                bondField.strokeCircle(centerX, centerY, RADIUS * 0.5);
                allies.forEach(unit => {
                    if (!unit.isAlive()) return;
                    const pos = unit.getPosition();
                    bondField.beginPath();
                    bondField.moveTo(centerX, centerY);
                    bondField.lineTo(pos.x, pos.y);
                    bondField.strokePath();
                    bondField.strokeCircle(pos.x, pos.y, 12);
                });
            }
        });

        const linkedSet = new Set(allies);
        const lifestealHandler = (payload: DamageEvent) => {
            if (!linkedSet.has(payload.attacker)) return;
            const healAmount = payload.damage * LIFESTEAL;
            if (healAmount <= 0) return;
            const living = allies.filter(unit => unit.isAlive());
            if (living.length === 0) return;
            const perUnit = healAmount / living.length;
            living.forEach(unit => unit.heal(perUnit));
        };

        scene.events.on('damage-dealt', lifestealHandler);

        scene.time.delayedCall(DURATION, () => {
            scene.events.off('damage-dealt', lifestealHandler);
            linkEvent.destroy();
            bondField.destroy();
            allies.forEach(unit => {
                if (unit.isAlive()) {
                    unit.clearDamageShare();
                }
            });
        });
    }
}
