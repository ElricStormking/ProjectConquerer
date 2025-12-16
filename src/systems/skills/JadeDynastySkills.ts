import Phaser from 'phaser';
import { ICommanderActiveSkill } from './ICommanderActiveSkill';
import { UnitManager } from '../UnitManager';
import { Unit } from '../../entities/Unit';
import { CommanderSkillTemplate } from '../../types/ironwars';

/**
 * Long Jin - Dragon Spear Barrage
 * Rain of chi-infused spears with stun and burning trail
 */
export class DragonSpearBarrage implements ICommanderActiveSkill {
    id = 'dragon_strike';
    name = 'Dragon Strike';
    description = 'Rains chi-infused spears from the sky, stunning enemies and leaving a burning trail.';

    private radius = 130;
    private spearCount = 8;
    private spearInterval = 120;
    private damagePerSpear = 18;
    private impactRadius = 45;
    private stunDuration = 1000;
    private trailDuration = 3000;
    private trailDot = 8;
    private trailTick = 500;

    configure(template: CommanderSkillTemplate): void {
        this.radius = template.radius ?? this.radius;
        this.spearCount = template.spearCount ?? this.spearCount;
        this.spearInterval = template.strikeIntervalMs ?? this.spearInterval;
        this.damagePerSpear = template.damagePerStrike ?? this.damagePerSpear;
        this.impactRadius = template.impactRadius ?? this.impactRadius;
        this.stunDuration = template.stunMs ?? this.stunDuration;
        this.trailDuration = template.trailDurationMs ?? this.trailDuration;
        this.trailDot = template.trailDot ?? this.trailDot;
        this.trailTick = template.trailTickMs ?? this.trailTick;
    }

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const RADIUS = this.radius;
        const SPEAR_COUNT = this.spearCount;
        const SPEAR_INTERVAL = this.spearInterval;
        const DAMAGE_PER_SPEAR = this.damagePerSpear;
        const IMPACT_RADIUS = this.impactRadius;
        const STUN_DURATION = this.stunDuration;
        const TRAIL_DURATION = this.trailDuration;
        const TRAIL_DOT = this.trailDot;
        const TRAIL_TICK = this.trailTick;

        // DISTINCTIVE: Cyan/Green Dragon Chi energy field with rotating runes
        const field = scene.add.graphics();
        field.setDepth(7800);
        field.setBlendMode(Phaser.BlendModes.ADD);
        
        // Outer dragon circle
        field.fillStyle(0x00ffcc, 0.25);
        field.fillCircle(centerX, centerY, RADIUS);
        field.lineStyle(4, 0x00ffaa, 0.9);
        field.strokeCircle(centerX, centerY, RADIUS);
        field.lineStyle(2, 0x88ffdd, 0.7);
        field.strokeCircle(centerX, centerY, RADIUS * 0.7);
        
        // Dragon symbol (simplified spiral)
        field.lineStyle(3, 0x00ffcc, 0.8);
        field.beginPath();
        for (let i = 0; i < 20; i++) {
            const t = i / 20;
            const spiralR = RADIUS * 0.3 * (1 - t);
            const spiralAngle = t * Math.PI * 4;
            const sx = centerX + Math.cos(spiralAngle) * spiralR;
            const sy = centerY + Math.sin(spiralAngle) * spiralR;
            if (i === 0) field.moveTo(sx, sy);
            else field.lineTo(sx, sy);
        }
        field.strokePath();
        
        // Flash effect on cast
        scene.cameras.main.flash(200, 0, 255, 200, false);

        scene.tweens.add({
            targets: field,
            alpha: 0,
            duration: SPEAR_COUNT * SPEAR_INTERVAL + 500,
            onComplete: () => field.destroy()
        });

        // Spear rain
        const impactPositions: { x: number; y: number }[] = [];

        for (let i = 0; i < SPEAR_COUNT; i++) {
            scene.time.delayedCall(i * SPEAR_INTERVAL, () => {
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const dist = Phaser.Math.FloatBetween(0, RADIUS * 0.85);
                const impactX = centerX + Math.cos(angle) * dist;
                const impactY = centerY + Math.sin(angle) * dist;

                impactPositions.push({ x: impactX, y: impactY });
                this.spawnSpearStrike(scene, impactX, impactY);

                const enemies = unitManager.getUnitsByTeam(2);
                enemies.forEach(unit => {
                    const pos = unit.getPosition();
                    if (Phaser.Math.Distance.Between(pos.x, pos.y, impactX, impactY) <= IMPACT_RADIUS) {
                        unit.takeDamage(DAMAGE_PER_SPEAR);
                        unit.applyStun(STUN_DURATION);
                    }
                });

                scene.cameras.main.shake(50, 0.002);
            });
        }

        // Burning chi trail effect
        scene.time.delayedCall(SPEAR_COUNT * SPEAR_INTERVAL + 200, () => {
            const trailGraphics = scene.add.graphics();
            trailGraphics.setDepth(7700);
            trailGraphics.setBlendMode(Phaser.BlendModes.ADD);

            let trailTime = 0;
            scene.time.addEvent({
                delay: TRAIL_TICK,
                repeat: TRAIL_DURATION / TRAIL_TICK,
                callback: () => {
                    trailTime += TRAIL_TICK;
                    trailGraphics.clear();

                    const alpha = 0.4 * (1 - trailTime / TRAIL_DURATION);
                    trailGraphics.fillStyle(0x00ff66, alpha);

                    impactPositions.forEach(pos => {
                        trailGraphics.fillCircle(pos.x, pos.y, 25 + Math.sin(trailTime * 0.01) * 5);
                    });

                    // DoT to enemies in trail
                    const enemies = unitManager.getUnitsByTeam(2);
                    enemies.forEach(unit => {
                        const unitPos = unit.getPosition();
                        for (const pos of impactPositions) {
                            if (Phaser.Math.Distance.Between(unitPos.x, unitPos.y, pos.x, pos.y) <= 30) {
                                unit.takeDamage(TRAIL_DOT);
                                break;
                            }
                        }
                    });
                }
            });

            scene.time.delayedCall(TRAIL_DURATION, () => {
                trailGraphics.destroy();
            });
        });
    }

    private spawnSpearStrike(scene: Phaser.Scene, x: number, y: number): void {
        // Spear projectile from sky
        const spear = scene.add.graphics();
        spear.setDepth(9000);
        spear.fillStyle(0x00ffaa, 1);
        spear.beginPath();
        spear.moveTo(0, -30);
        spear.lineTo(-4, 10);
        spear.lineTo(4, 10);
        spear.closePath();
        spear.fill();
        spear.x = x;
        spear.y = y - 200;
        spear.rotation = Math.PI;

        scene.tweens.add({
            targets: spear,
            y: y,
            duration: 150,
            ease: 'Quad.easeIn',
            onComplete: () => spear.destroy()
        });

        // Impact effect
        scene.time.delayedCall(150, () => {
            const impact = scene.add.graphics();
            impact.setDepth(8800);
            impact.setBlendMode(Phaser.BlendModes.ADD);
            impact.fillStyle(0x00ff88, 0.8);
            impact.fillCircle(x, y, 20);

            scene.tweens.add({
                targets: impact,
                alpha: 0,
                scale: { from: 1, to: 2 },
                duration: 200,
                onComplete: () => impact.destroy()
            });
        });
    }
}

/**
 * Hanami Reika - Shikigami Summoning
 * Summons spirit units at target location
 */
export class ShikigamiSummoning implements ICommanderActiveSkill {
    id = 'shikigami_ritual';
    name = 'Twelve-Shikigami Ritual';
    description = 'Summons friendly spirit units that fight alongside your army.';

    private summonCount = 3;
    private summonDuration = 10000;
    private radius = 80;
    private healPulseInterval = 2000;
    private healAmount = 15;
    private healRadius = 120;

    configure(template: CommanderSkillTemplate): void {
        this.summonCount = template.summonCount ?? this.summonCount;
        this.summonDuration = template.summonDurationMs ?? this.summonDuration;
        this.radius = template.radius ?? this.radius;
        this.healPulseInterval = template.healPulseIntervalMs ?? this.healPulseInterval;
        this.healAmount = template.healAmount ?? this.healAmount;
        this.healRadius = template.healRadius ?? this.healRadius;
    }

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const SUMMON_COUNT = this.summonCount;
        const SUMMON_DURATION = this.summonDuration;
        const RADIUS = this.radius;
        const HEAL_PULSE_INTERVAL = this.healPulseInterval;
        const HEAL_AMOUNT = this.healAmount;
        const HEAL_RADIUS = this.healRadius;

        // DISTINCTIVE: Pink/Magenta Spirit Ritual Circle with Japanese torii gate symbols
        const ritual = scene.add.graphics();
        ritual.setDepth(7800);
        ritual.setBlendMode(Phaser.BlendModes.ADD);

        // Outer glowing circle - bright magenta
        ritual.fillStyle(0xff66cc, 0.2);
        ritual.fillCircle(centerX, centerY, RADIUS * 1.2);
        ritual.lineStyle(4, 0xff44aa, 0.9);
        ritual.strokeCircle(centerX, centerY, RADIUS);
        ritual.lineStyle(2, 0xffaaee, 0.7);
        ritual.strokeCircle(centerX, centerY, RADIUS * 0.6);
        ritual.strokeCircle(centerX, centerY, RADIUS * 0.3);

        // Hexagram pattern
        ritual.lineStyle(2, 0xff88dd, 0.8);
        for (let i = 0; i < 6; i++) {
            const angle1 = (i / 6) * Math.PI * 2;
            const angle2 = ((i + 2) / 6) * Math.PI * 2;
            ritual.beginPath();
            ritual.moveTo(centerX + Math.cos(angle1) * RADIUS, centerY + Math.sin(angle1) * RADIUS);
            ritual.lineTo(centerX + Math.cos(angle2) * RADIUS, centerY + Math.sin(angle2) * RADIUS);
            ritual.strokePath();
        }

        // Spirit orbs at vertices
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const sx = centerX + Math.cos(angle) * RADIUS * 0.8;
            const sy = centerY + Math.sin(angle) * RADIUS * 0.8;
            ritual.fillStyle(0xffccff, 0.9);
            ritual.fillCircle(sx, sy, 10);
            ritual.lineStyle(2, 0xff66cc, 1);
            ritual.strokeCircle(sx, sy, 10);
        }
        
        // Pink flash on cast
        scene.cameras.main.flash(200, 255, 100, 200, false);

        scene.tweens.add({
            targets: ritual,
            alpha: 0,
            duration: SUMMON_DURATION,
            onComplete: () => ritual.destroy()
        });

        // Summon spirits
        const spiritTypes = ['fox_spirit', 'blue_oni', 'paper_doll', 'spirit_lantern', 'crow_familiar'];
        const summonedUnits: string[] = [];

        for (let i = 0; i < SUMMON_COUNT; i++) {
            scene.time.delayedCall(i * 300, () => {
                const angle = (i / SUMMON_COUNT) * Math.PI * 2;
                const spawnX = centerX + Math.cos(angle) * RADIUS * 0.5;
                const spawnY = centerY + Math.sin(angle) * RADIUS * 0.5;

                // Spawn VFX
                const spawnEffect = scene.add.graphics();
                spawnEffect.setDepth(9000);
                spawnEffect.setBlendMode(Phaser.BlendModes.ADD);
                spawnEffect.fillStyle(0xffccff, 0.9);
                spawnEffect.fillCircle(spawnX, spawnY, 30);

                scene.tweens.add({
                    targets: spawnEffect,
                    alpha: 0,
                    scale: { from: 0.5, to: 1.5 },
                    duration: 400,
                    onComplete: () => spawnEffect.destroy()
                });

                // Spawn actual unit via UnitManager
                const spiritType = spiritTypes[Phaser.Math.Between(0, spiritTypes.length - 1)];
                const unitId = unitManager.spawnTemporaryUnit(spiritType, spawnX, spawnY, 1, SUMMON_DURATION);
                if (unitId) {
                    summonedUnits.push(unitId);
                }
            });
        }

        // Healing aura pulses
        const healPulseEvent = scene.time.addEvent({
            delay: HEAL_PULSE_INTERVAL,
            repeat: Math.floor(SUMMON_DURATION / HEAL_PULSE_INTERVAL) - 1,
            callback: () => {
                // Heal pulse VFX
                const pulse = scene.add.graphics();
                pulse.setDepth(7750);
                pulse.setBlendMode(Phaser.BlendModes.ADD);
                pulse.lineStyle(3, 0xff88cc, 0.6);
                pulse.strokeCircle(centerX, centerY, 20);

                scene.tweens.add({
                    targets: pulse,
                    scale: { from: 1, to: HEAL_RADIUS / 20 },
                    alpha: 0,
                    duration: 600,
                    onComplete: () => pulse.destroy()
                });

                // Heal allies in range
                const allies = unitManager.getUnitsByTeam(1);
                allies.forEach(unit => {
                    const pos = unit.getPosition();
                    if (Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= HEAL_RADIUS) {
                        unit.heal(HEAL_AMOUNT);
                    }
                });
            }
        });

        scene.time.delayedCall(SUMMON_DURATION, () => {
            healPulseEvent.destroy();
        });
    }
}

/**
 * Kasumi Nightwind - Shadow Clone Ambush
 * Spawns shadow clones that taunt and explode
 */
export class ShadowCloneAmbush implements ICommanderActiveSkill {
    id = 'shadowstep_backroll';
    name = 'Shadowstep Backroll';
    description = 'Deploys shadow clones that taunt enemies and explode on death.';

    private cloneCount = 3;
    private cloneDuration = 5000;
    private cloneDamage = 12;
    private cloneAttackInterval = 800;
    private attackRange = 100;
    private explosionDamage = 25;
    private explosionRadius = 70;
    private tauntDuration = 2500;
    private spawnRadius = 50;

    configure(template: CommanderSkillTemplate): void {
        this.cloneCount = template.cloneCount ?? this.cloneCount;
        this.cloneDuration = template.durationMs ?? this.cloneDuration;
        this.cloneDamage = template.cloneDamage ?? this.cloneDamage;
        this.cloneAttackInterval = template.cloneAttackIntervalMs ?? this.cloneAttackInterval;
        this.attackRange = template.cloneAttackRange ?? this.attackRange;
        this.explosionDamage = template.explosionDamage ?? this.explosionDamage;
        this.explosionRadius = template.explosionRadius ?? this.explosionRadius;
        this.tauntDuration = template.tauntDurationMs ?? this.tauntDuration;
        this.spawnRadius = template.summonRadius ?? this.spawnRadius;
    }

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const CLONE_COUNT = this.cloneCount;
        const CLONE_DURATION = this.cloneDuration;
        const CLONE_DAMAGE = this.cloneDamage;
        const CLONE_ATTACK_INTERVAL = this.cloneAttackInterval;
        const ATTACK_RANGE = this.attackRange;
        const EXPLOSION_DAMAGE = this.explosionDamage;
        const EXPLOSION_RADIUS = this.explosionRadius;
        const TAUNT_DURATION = this.tauntDuration;

        // DISTINCTIVE: Dark Purple Ninja Smoke Bomb with shadow tendrils
        const smoke = scene.add.graphics();
        smoke.setDepth(9000);
        
        // Multiple layered smoke clouds
        smoke.fillStyle(0x1a0033, 0.9);
        smoke.fillCircle(centerX, centerY, 70);
        smoke.fillStyle(0x330066, 0.7);
        smoke.fillCircle(centerX - 20, centerY - 15, 40);
        smoke.fillCircle(centerX + 25, centerY + 10, 35);
        smoke.fillCircle(centerX - 10, centerY + 20, 30);
        
        // Shadow tendrils
        smoke.lineStyle(4, 0x6600aa, 0.8);
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            smoke.beginPath();
            smoke.moveTo(centerX, centerY);
            const endX = centerX + Math.cos(angle) * 80;
            const endY = centerY + Math.sin(angle) * 80;
            smoke.lineTo(endX, endY);
            smoke.strokePath();
        }
        
        // Ninja star silhouette in center
        smoke.fillStyle(0xaa00ff, 0.9);
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            smoke.beginPath();
            smoke.moveTo(centerX, centerY);
            smoke.lineTo(centerX + Math.cos(angle) * 25, centerY + Math.sin(angle) * 25);
            smoke.lineTo(centerX + Math.cos(angle + 0.3) * 15, centerY + Math.sin(angle + 0.3) * 15);
            smoke.closePath();
            smoke.fill();
        }

        scene.tweens.add({
            targets: smoke,
            alpha: 0,
            scale: { from: 1, to: 2.5 },
            duration: 600,
            onComplete: () => smoke.destroy()
        });
        
        // Purple flash
        scene.cameras.main.flash(150, 100, 0, 150, false);

        // Spawn clones
        for (let i = 0; i < CLONE_COUNT; i++) {
            scene.time.delayedCall(i * 150 + 200, () => {
                const angle = (i / CLONE_COUNT) * Math.PI * 2 + Math.PI / 6;
                const spawnX = centerX + Math.cos(angle) * this.spawnRadius;
                const spawnY = centerY + Math.sin(angle) * this.spawnRadius;

                this.spawnShadowClone(
                    scene,
                    unitManager,
                    spawnX,
                    spawnY,
                    CLONE_DURATION,
                    CLONE_DAMAGE,
                    CLONE_ATTACK_INTERVAL,
                    ATTACK_RANGE,
                    EXPLOSION_DAMAGE,
                    EXPLOSION_RADIUS,
                    TAUNT_DURATION
                );
            });
        }
    }

    private spawnShadowClone(
        scene: Phaser.Scene,
        unitManager: UnitManager,
        x: number,
        y: number,
        duration: number,
        damage: number,
        attackInterval: number,
        attackRange: number,
        explosionDamage: number,
        explosionRadius: number,
        tauntDuration: number
    ): void {
        // Clone visual
        const clone = scene.add.graphics();
        clone.setDepth(8500);
        clone.fillStyle(0x6600aa, 0.7);
        clone.fillCircle(0, 0, 18);
        clone.lineStyle(2, 0xaa00ff, 0.9);
        clone.strokeCircle(0, 0, 18);
        clone.x = x;
        clone.y = y;

        // Appear effect
        clone.setAlpha(0);
        scene.tweens.add({
            targets: clone,
            alpha: 1,
            duration: 200
        });

        // Flicker effect
        scene.tweens.add({
            targets: clone,
            alpha: { from: 0.7, to: 1 },
            duration: 200,
            yoyo: true,
            repeat: -1
        });

        // Taunt nearby enemies
        const enemies = unitManager.getUnitsByTeam(2);
        enemies.forEach(unit => {
            const pos = unit.getPosition();
            if (Phaser.Math.Distance.Between(pos.x, pos.y, x, y) <= attackRange * 1.5) {
                unit.applyTaunt(x, y, tauntDuration);
            }
        });

        // Clone attacks
        const attackEvent = scene.time.addEvent({
            delay: attackInterval,
            repeat: Math.floor(duration / attackInterval) - 1,
            callback: () => {
                const currentEnemies = unitManager.getUnitsByTeam(2);
                
                // Find closest enemy
                let closestDist = attackRange;
                let targetUnit: Unit | null = null;
                
                for (const enemy of currentEnemies) {
                    const pos = enemy.getPosition();
                    const dist = Phaser.Math.Distance.Between(pos.x, pos.y, clone.x, clone.y);
                    if (dist < closestDist) {
                        closestDist = dist;
                        targetUnit = enemy;
                    }
                }

                if (targetUnit !== null) {
                    targetUnit.takeDamage(damage);

                    // Attack VFX
                    const slash = scene.add.graphics();
                    slash.setDepth(8600);
                    slash.setBlendMode(Phaser.BlendModes.ADD);
                    slash.lineStyle(3, 0xaa00ff, 0.8);
                    const targetPos = targetUnit.getPosition();
                    slash.beginPath();
                    slash.moveTo(clone.x, clone.y);
                    slash.lineTo(targetPos.x, targetPos.y);
                    slash.strokePath();

                    scene.tweens.add({
                        targets: slash,
                        alpha: 0,
                        duration: 150,
                        onComplete: () => slash.destroy()
                    });
                }
            }
        });

        // Clone explosion on expire
        scene.time.delayedCall(duration, () => {
            attackEvent.destroy();

            // Explosion VFX
            const explosion = scene.add.graphics();
            explosion.setDepth(9000);
            explosion.setBlendMode(Phaser.BlendModes.ADD);
            explosion.fillStyle(0x9900ff, 0.9);
            explosion.fillCircle(clone.x, clone.y, explosionRadius * 0.4);

            scene.tweens.add({
                targets: explosion,
                alpha: 0,
                scale: { from: 1, to: 2.5 },
                duration: 300,
                onComplete: () => explosion.destroy()
            });

            // Damage enemies in explosion
            const currentEnemies = unitManager.getUnitsByTeam(2);
            currentEnemies.forEach(unit => {
                const pos = unit.getPosition();
                if (Phaser.Math.Distance.Between(pos.x, pos.y, clone.x, clone.y) <= explosionRadius) {
                    unit.takeDamage(explosionDamage);
                }
            });

            clone.destroy();
            scene.cameras.main.shake(60, 0.002);
        });
    }
}
