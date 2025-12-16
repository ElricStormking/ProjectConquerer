import Phaser from 'phaser';
import { ICommanderActiveSkill } from './ICommanderActiveSkill';
import { UnitManager } from '../UnitManager';

/**
 * Rex Aetherfall - Skyfall Cataclysm
 * Lightning storm at target with vortex pull effect
 */
export class SkyfallCataclysm implements ICommanderActiveSkill {
    id = 'skyfall_cataclysm';
    name = 'Skyfall Cataclysm';
    description = 'Summons a devastating lightning storm that strikes enemies and pulls them inward.';

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const FIELD_RADIUS = 160;
        const IMPACT_RADIUS = 90;
        const STRIKES = 6;
        const STRIKE_INTERVAL = 150;
        const DAMAGE_PER_STRIKE = 12;
        const VORTEX_DURATION = 4000;
        const PULL_STRENGTH = 15;

        // Field indicator
        const field = scene.add.graphics();
        field.setDepth(7800);
        field.setBlendMode(Phaser.BlendModes.ADD);
        field.fillStyle(0x101a33, 0.6);
        field.fillCircle(centerX, centerY, FIELD_RADIUS * 0.95);
        field.lineStyle(2, 0x4fd2ff, 0.7);
        field.strokeCircle(centerX, centerY, FIELD_RADIUS);
        scene.tweens.add({
            targets: field,
            alpha: 0,
            duration: STRIKES * STRIKE_INTERVAL + 300,
            onComplete: () => field.destroy()
        });

        const camera = scene.cameras.main;

        // Lightning strikes
        scene.time.addEvent({
            delay: STRIKE_INTERVAL,
            repeat: STRIKES - 1,
            callback: () => {
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const dist = Phaser.Math.FloatBetween(FIELD_RADIUS * 0.2, FIELD_RADIUS * 0.9);
                const strikeX = centerX + Math.cos(angle) * dist;
                const strikeY = centerY + Math.sin(angle) * dist;

                this.spawnLightningStrike(scene, strikeX, strikeY, IMPACT_RADIUS);

                const enemies = unitManager.getUnitsByTeam(2);
                enemies.forEach(unit => {
                    const pos = unit.getPosition();
                    if (Phaser.Math.Distance.Between(pos.x, pos.y, strikeX, strikeY) <= IMPACT_RADIUS) {
                        unit.takeDamage(DAMAGE_PER_STRIKE);
                    }
                });

                camera.shake(70, 0.0025);
            }
        });

        // Vortex pull effect
        const vortex = scene.add.graphics();
        vortex.setDepth(7700);
        vortex.setBlendMode(Phaser.BlendModes.ADD);

        let vortexTime = 0;
        scene.time.addEvent({
            delay: 50,
            repeat: VORTEX_DURATION / 50,
            callback: () => {
                vortexTime += 50;
                vortex.clear();
                vortex.lineStyle(2, 0x6633ff, 0.4 + Math.sin(vortexTime * 0.01) * 0.2);
                vortex.strokeCircle(centerX, centerY, FIELD_RADIUS * (0.8 + Math.sin(vortexTime * 0.005) * 0.1));

                // Pull enemies toward center
                const enemies = unitManager.getUnitsByTeam(2);
                enemies.forEach(unit => {
                    const pos = unit.getPosition();
                    const dist = Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY);
                    if (dist <= FIELD_RADIUS && dist > 20) {
                        const pullAngle = Phaser.Math.Angle.Between(pos.x, pos.y, centerX, centerY);
                        const pullX = Math.cos(pullAngle) * PULL_STRENGTH;
                        const pullY = Math.sin(pullAngle) * PULL_STRENGTH;
                        unit.applyForce(pullX, pullY);
                    }
                });
            }
        });

        scene.time.delayedCall(VORTEX_DURATION, () => {
            vortex.destroy();
        });
    }

    private spawnLightningStrike(scene: Phaser.Scene, x: number, y: number, impactRadius: number): void {
        const bolt = scene.add.graphics();
        bolt.setDepth(9000);
        bolt.setBlendMode(Phaser.BlendModes.ADD);
        bolt.lineStyle(4, 0xaee6ff, 1);

        const startY = y - 260;
        const endY = y + 10;
        const segments = 6;
        bolt.beginPath();
        bolt.moveTo(x + Phaser.Math.Between(-10, 10), startY);

        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const nextY = Phaser.Math.Linear(startY, endY, t);
            const offsetX = Phaser.Math.Between(-20, 20);
            bolt.lineTo(x + offsetX, nextY);
        }
        bolt.strokePath();

        scene.tweens.add({
            targets: bolt,
            alpha: 0,
            duration: 160,
            onComplete: () => bolt.destroy()
        });

        const shock = scene.add.graphics();
        shock.setDepth(8800);
        shock.setBlendMode(Phaser.BlendModes.ADD);
        shock.lineStyle(2, 0x8fd8ff, 1);
        shock.strokeCircle(x, y, impactRadius * 0.6);
        scene.tweens.add({
            targets: shock,
            alpha: 0,
            scale: { from: 0.8, to: 1.4 },
            duration: 260,
            onComplete: () => shock.destroy()
        });
    }
}

/**
 * Valerius Dawnward - Judgment of the Dawn
 * Holy AoE explosion with cleanse and shield
 */
export class JudgmentOfTheDawn implements ICommanderActiveSkill {
    id = 'judgment_of_the_dawn';
    name = 'Judgment of the Dawn';
    description = 'Holy explosion that damages enemies, cleanses allies, and grants protective shields.';

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const RADIUS = 140;
        const DAMAGE = 45;
        const STUN_DURATION = 1500;
        const SHIELD_PERCENT = 0.15;
        const SHIELD_DURATION = 6000;
        const BUFF_DURATION = 5000;
        const ATTACK_BUFF = 0.25;

        // Holy circle telegraph
        const telegraph = scene.add.graphics();
        telegraph.setDepth(7800);
        telegraph.lineStyle(3, 0xffd700, 0.8);
        telegraph.strokeCircle(centerX, centerY, RADIUS);
        telegraph.fillStyle(0xffd700, 0.2);
        telegraph.fillCircle(centerX, centerY, RADIUS);

        scene.tweens.add({
            targets: telegraph,
            alpha: 0,
            scale: { from: 0.5, to: 1.2 },
            duration: 400,
            onComplete: () => telegraph.destroy()
        });

        // Main explosion after brief delay
        scene.time.delayedCall(200, () => {
            // Explosion VFX
            const explosion = scene.add.graphics();
            explosion.setDepth(9000);
            explosion.setBlendMode(Phaser.BlendModes.ADD);
            explosion.fillStyle(0xffffcc, 0.9);
            explosion.fillCircle(centerX, centerY, RADIUS * 0.3);

            scene.tweens.add({
                targets: explosion,
                alpha: 0,
                scale: { from: 1, to: 3 },
                duration: 400,
                onComplete: () => explosion.destroy()
            });

            // Light rays
            for (let i = 0; i < 8; i++) {
                const ray = scene.add.graphics();
                ray.setDepth(8900);
                ray.setBlendMode(Phaser.BlendModes.ADD);
                const angle = (i / 8) * Math.PI * 2;
                ray.lineStyle(6, 0xffd700, 0.8);
                ray.beginPath();
                ray.moveTo(centerX, centerY);
                ray.lineTo(
                    centerX + Math.cos(angle) * RADIUS * 1.2,
                    centerY + Math.sin(angle) * RADIUS * 1.2
                );
                ray.strokePath();
                scene.tweens.add({
                    targets: ray,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => ray.destroy()
                });
            }

            // Damage enemies
            const enemies = unitManager.getUnitsByTeam(2);
            enemies.forEach(unit => {
                const pos = unit.getPosition();
                if (Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS) {
                    unit.takeDamage(DAMAGE);
                    unit.applyStun(STUN_DURATION);
                }
            });

            // Buff allies: cleanse, shield, attack buff
            const allies = unitManager.getUnitsByTeam(1);
            allies.forEach(unit => {
                const pos = unit.getPosition();
                if (Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS) {
                    unit.cleanse();
                    const shieldAmount = unit.getMaxHp() * SHIELD_PERCENT;
                    unit.applyShield(shieldAmount, SHIELD_DURATION);
                    unit.applyAttackBuff(ATTACK_BUFF, BUFF_DURATION);
                }
            });

            scene.cameras.main.flash(150, 255, 255, 200);
        });
    }
}

/**
 * Elara Blackiron - Grand Bombardment Protocol
 * Artillery strike with telegraph and multiple shell impacts
 */
export class GrandBombardment implements ICommanderActiveSkill {
    id = 'grand_bombardment';
    name = 'Grand Bombardment Protocol';
    description = 'Calls in artillery strikes after a brief warning, devastating the target area.';

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const RADIUS = 180;
        const TELEGRAPH_DURATION = 3000;
        const SHELLS = 5;
        const SHELL_INTERVAL = 500;
        const DAMAGE_PER_SHELL = 35;
        const IMPACT_RADIUS = 60;
        const KNOCKBACK_FORCE = 80;

        // Telegraph warning zone
        const telegraph = scene.add.graphics();
        telegraph.setDepth(7800);

        let flashTime = 0;
        const flashEvent = scene.time.addEvent({
            delay: 100,
            repeat: TELEGRAPH_DURATION / 100,
            callback: () => {
                flashTime += 100;
                telegraph.clear();
                const flashAlpha = 0.2 + Math.sin(flashTime * 0.02) * 0.15;
                telegraph.fillStyle(0xff3300, flashAlpha);
                telegraph.fillCircle(centerX, centerY, RADIUS);
                telegraph.lineStyle(3, 0xff0000, 0.8);
                telegraph.strokeCircle(centerX, centerY, RADIUS);

                // Crosshair
                telegraph.lineStyle(2, 0xff0000, 0.6);
                telegraph.beginPath();
                telegraph.moveTo(centerX - RADIUS, centerY);
                telegraph.lineTo(centerX + RADIUS, centerY);
                telegraph.moveTo(centerX, centerY - RADIUS);
                telegraph.lineTo(centerX, centerY + RADIUS);
                telegraph.strokePath();
            }
        });

        // Slow enemies in telegraph zone
        const slowEvent = scene.time.addEvent({
            delay: 200,
            repeat: TELEGRAPH_DURATION / 200,
            callback: () => {
                const enemies = unitManager.getUnitsByTeam(2);
                enemies.forEach(unit => {
                    const pos = unit.getPosition();
                    if (Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS) {
                        unit.applySlow(0.2, 250);
                    }
                });
            }
        });

        // Artillery barrage after telegraph
        scene.time.delayedCall(TELEGRAPH_DURATION, () => {
            flashEvent.destroy();
            slowEvent.destroy();
            telegraph.destroy();

            for (let i = 0; i < SHELLS; i++) {
                scene.time.delayedCall(i * SHELL_INTERVAL, () => {
                    const offsetX = Phaser.Math.Between(-RADIUS * 0.7, RADIUS * 0.7);
                    const offsetY = Phaser.Math.Between(-RADIUS * 0.7, RADIUS * 0.7);
                    const impactX = centerX + offsetX;
                    const impactY = centerY + offsetY;

                    this.spawnShellImpact(scene, impactX, impactY, IMPACT_RADIUS);

                    const enemies = unitManager.getUnitsByTeam(2);
                    enemies.forEach(unit => {
                        const pos = unit.getPosition();
                        const dist = Phaser.Math.Distance.Between(pos.x, pos.y, impactX, impactY);
                        if (dist <= IMPACT_RADIUS) {
                            const centerDamageBonus = dist < IMPACT_RADIUS * 0.3 ? 1.5 : 1.0;
                            unit.takeDamage(DAMAGE_PER_SHELL * centerDamageBonus);

                            // Knockback
                            const knockAngle = Phaser.Math.Angle.Between(impactX, impactY, pos.x, pos.y);
                            const knockX = Math.cos(knockAngle) * KNOCKBACK_FORCE;
                            const knockY = Math.sin(knockAngle) * KNOCKBACK_FORCE;
                            unit.applyForce(knockX, knockY);
                        }
                    });

                    scene.cameras.main.shake(100, 0.004);
                });
            }
        });
    }

    private spawnShellImpact(scene: Phaser.Scene, x: number, y: number, radius: number): void {
        // Explosion circle
        const explosion = scene.add.graphics();
        explosion.setDepth(9000);
        explosion.setBlendMode(Phaser.BlendModes.ADD);
        explosion.fillStyle(0xff6600, 0.9);
        explosion.fillCircle(x, y, radius * 0.4);

        scene.tweens.add({
            targets: explosion,
            alpha: 0,
            scale: { from: 1, to: 2.5 },
            duration: 300,
            onComplete: () => explosion.destroy()
        });

        // Smoke ring
        const smoke = scene.add.graphics();
        smoke.setDepth(8800);
        smoke.lineStyle(8, 0x333333, 0.6);
        smoke.strokeCircle(x, y, radius * 0.3);

        scene.tweens.add({
            targets: smoke,
            alpha: 0,
            scale: { from: 1, to: 2 },
            duration: 600,
            onComplete: () => smoke.destroy()
        });

        // Debris particles
        for (let i = 0; i < 6; i++) {
            const debris = scene.add.graphics();
            debris.setDepth(8900);
            debris.fillStyle(0x666666, 1);
            debris.fillRect(-3, -3, 6, 6);
            debris.x = x;
            debris.y = y;

            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const speed = Phaser.Math.Between(80, 150);

            scene.tweens.add({
                targets: debris,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed - 40,
                alpha: 0,
                duration: 500,
                ease: 'Quad.easeOut',
                onComplete: () => debris.destroy()
            });
        }
    }
}
