import Phaser from 'phaser';
import { ICommanderActiveSkill } from './ICommanderActiveSkill';
import { UnitManager } from '../UnitManager';
import { CommanderSkillTemplate } from '../../types/ironwars';

/**
 * Azariel (Lich King) - Soul Blasphemy
 * Decay zone that damages and converts healing to damage
 */
export class SoulBlasphemy implements ICommanderActiveSkill {
    id = 'soul_blasphemy';
    name = 'Soul Blasphemy';
    description = 'Creates a zone of decay where enemy healing is converted to damage.';

    private radius = 150;
    private duration = 8000;
    private dotTick = 500;
    private dotDamage = 6;
    private healReverseMs = 800;

    configure(template: CommanderSkillTemplate): void {
        this.radius = template.radius ?? this.radius;
        this.duration = template.durationMs ?? this.duration;
        this.dotTick = template.dotTickMs ?? this.dotTick;
        this.dotDamage = template.dotDamage ?? this.dotDamage;
        this.healReverseMs = template.healReverseMs ?? this.healReverseMs;
    }

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const RADIUS = this.radius;
        const DURATION = this.duration;
        const DOT_TICK = this.dotTick;
        const DOT_DAMAGE = this.dotDamage;

        // DISTINCTIVE: Dark Purple/Black Necrotic Decay Zone with skull motif
        const field = scene.add.graphics();
        field.setDepth(7800);
        
        // Initial burst effect - dark purple flash
        scene.cameras.main.flash(200, 80, 0, 80, false);

        let fieldTime = 0;
        const fieldEvent = scene.time.addEvent({
            delay: 100,
            repeat: DURATION / 100,
            callback: () => {
                fieldTime += 100;
                field.clear();

                const alpha = 0.5 * (1 - fieldTime / DURATION);
                
                // Dark necrotic ground
                field.fillStyle(0x1a001a, alpha);
                field.fillCircle(centerX, centerY, RADIUS);
                
                // Multiple decay rings
                field.lineStyle(3, 0x660066, alpha + 0.3);
                const pulseRadius = RADIUS * (0.9 + Math.sin(fieldTime * 0.008) * 0.1);
                field.strokeCircle(centerX, centerY, pulseRadius);
                field.lineStyle(2, 0x440044, alpha + 0.2);
                field.strokeCircle(centerX, centerY, RADIUS * 0.7);
                field.strokeCircle(centerX, centerY, RADIUS * 0.4);
                
                // Skull pattern in center (simplified)
                field.fillStyle(0x880088, alpha * 0.8);
                field.fillCircle(centerX, centerY - 10, 20); // head
                field.fillCircle(centerX - 8, centerY - 15, 6); // left eye
                field.fillCircle(centerX + 8, centerY - 15, 6); // right eye
                field.fillStyle(0x1a001a, alpha);
                field.fillCircle(centerX - 8, centerY - 15, 3); // left eye hole
                field.fillCircle(centerX + 8, centerY - 15, 3); // right eye hole

                // Decay runes around edge
                field.fillStyle(0xaa00aa, alpha * 0.6);
                for (let i = 0; i < 8; i++) {
                    const runeAngle = (i / 8) * Math.PI * 2 + fieldTime * 0.001;
                    const rx = centerX + Math.cos(runeAngle) * RADIUS * 0.85;
                    const ry = centerY + Math.sin(runeAngle) * RADIUS * 0.85;
                    field.fillRect(rx - 4, ry - 8, 8, 16);
                }
            }
        });

        // DoT and heal reversal
        const dotEvent = scene.time.addEvent({
            delay: DOT_TICK,
            repeat: DURATION / DOT_TICK - 1,
            callback: () => {
                const enemies = unitManager.getUnitsByTeam(2);
                enemies.forEach(unit => {
                    const pos = unit.getPosition();
                    if (Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS) {
                        unit.takeDamage(DOT_DAMAGE);
                        unit.applyHealReverse(this.healReverseMs);
                    }
                });
            }
        });

        // Soul particles rising
        const particleEvent = scene.time.addEvent({
            delay: 400,
            repeat: DURATION / 400 - 1,
            callback: () => {
                const particle = scene.add.graphics();
                particle.setDepth(8000);
                particle.setBlendMode(Phaser.BlendModes.ADD);
                particle.fillStyle(0xcc00cc, 0.7);

                const startX = centerX + Phaser.Math.Between(-RADIUS * 0.7, RADIUS * 0.7);
                const startY = centerY + Phaser.Math.Between(-RADIUS * 0.7, RADIUS * 0.7);
                particle.fillCircle(0, 0, 5);
                particle.x = startX;
                particle.y = startY;

                scene.tweens.add({
                    targets: particle,
                    y: startY - 80,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => particle.destroy()
                });
            }
        });

        scene.time.delayedCall(DURATION, () => {
            fieldEvent.destroy();
            dotEvent.destroy();
            particleEvent.destroy();
            field.destroy();
        });

        // Initial burst
        const burst = scene.add.graphics();
        burst.setDepth(9000);
        burst.setBlendMode(Phaser.BlendModes.ADD);
        burst.fillStyle(0x660066, 0.8);
        burst.fillCircle(centerX, centerY, RADIUS * 0.3);

        scene.tweens.add({
            targets: burst,
            alpha: 0,
            scale: { from: 1, to: 3 },
            duration: 400,
            onComplete: () => burst.destroy()
        });
    }
}

/**
 * Bellucci (Blood Queen) - Sacrificial Feast
 * Siphons HP from allies to buff all allies in area
 */
export class SacrificialFeast implements ICommanderActiveSkill {
    id = 'sacrificial_feast';
    name = 'Sacrificial Feast';
    description = 'Siphons life from nearby allies to empower all units in the area with increased damage.';

    private radius = 140;
    private siphonCount = 2;
    private siphonPercent = 0.3;
    private attackBuff = 0.5;
    private buffDuration = 6000;

    configure(template: CommanderSkillTemplate): void {
        this.radius = template.radius ?? this.radius;
        this.siphonCount = template.siphonCount ?? this.siphonCount;
        this.siphonPercent = template.siphonPercent ?? this.siphonPercent;
        this.attackBuff = template.attackBuffPercent ?? this.attackBuff;
        this.buffDuration = template.attackBuffDurationMs ?? this.buffDuration;
    }

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const RADIUS = this.radius;
        const SIPHON_COUNT = this.siphonCount;
        const SIPHON_PERCENT = this.siphonPercent;
        const ATTACK_BUFF = this.attackBuff;
        const BUFF_DURATION = this.buffDuration;

        // DISTINCTIVE: Crimson Blood Ritual Circle with dripping blood effect
        const ritual = scene.add.graphics();
        ritual.setDepth(7800);
        
        // Deep crimson pool
        ritual.fillStyle(0x440000, 0.5);
        ritual.fillCircle(centerX, centerY, RADIUS);
        ritual.fillStyle(0x880000, 0.3);
        ritual.fillCircle(centerX, centerY, RADIUS * 0.8);
        
        // Blood red rings
        ritual.lineStyle(4, 0xff0000, 0.9);
        ritual.strokeCircle(centerX, centerY, RADIUS);
        ritual.lineStyle(2, 0xcc0000, 0.7);
        ritual.strokeCircle(centerX, centerY, RADIUS * 0.6);
        
        // Blood drops pattern (simplified circles)
        ritual.fillStyle(0xff0033, 0.8);
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const dx = centerX + Math.cos(angle) * RADIUS * 0.75;
            const dy = centerY + Math.sin(angle) * RADIUS * 0.75;
            // Blood drop as ellipse-ish shape
            ritual.fillCircle(dx, dy, 6);
            ritual.fillCircle(dx, dy - 4, 4);
            ritual.fillCircle(dx, dy - 7, 2);
        }
        
        // Crimson flash
        scene.cameras.main.flash(200, 150, 0, 0, false);

        scene.tweens.add({
            targets: ritual,
            alpha: 0,
            duration: 1500,
            onComplete: () => ritual.destroy()
        });

        // Find allies to siphon from
        const allies = unitManager.getUnitsByTeam(1);
        const alliesInRange = allies.filter(unit => {
            const pos = unit.getPosition();
            return Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS;
        });

        // Sort by current HP and pick top 2 (sacrifice the healthier ones)
        alliesInRange.sort((a, b) => b.getCurrentHp() - a.getCurrentHp());
        const siphonTargets = alliesInRange.slice(0, SIPHON_COUNT);

        // Siphon HP from targets
        let totalSiphoned = 0;
        siphonTargets.forEach((unit, index) => {
            const currentHp = unit.getCurrentHp();
            const siphonAmount = Math.floor(currentHp * SIPHON_PERCENT);

            // Don't kill the unit
            const actualSiphon = Math.min(siphonAmount, currentHp - 1);
            if (actualSiphon > 0) {
                totalSiphoned += actualSiphon;
                unit.takeDamage(actualSiphon); // self-damage for sacrifice

                // Blood drain VFX
                const unitPos = unit.getPosition();
                scene.time.delayedCall(index * 200, () => {
                    this.spawnBloodDrain(scene, unitPos.x, unitPos.y, centerX, centerY);
                });
            }
        });

        // Buff all allies in range
        scene.time.delayedCall(600, () => {
            // Buff burst VFX
            const buffBurst = scene.add.graphics();
            buffBurst.setDepth(9000);
            buffBurst.setBlendMode(Phaser.BlendModes.ADD);
            buffBurst.fillStyle(0xff3333, 0.7);
            buffBurst.fillCircle(centerX, centerY, 30);

            scene.tweens.add({
                targets: buffBurst,
                alpha: 0,
                scale: { from: 1, to: 4 },
                duration: 400,
                onComplete: () => buffBurst.destroy()
            });

            // Apply buff
            const currentAllies = unitManager.getUnitsByTeam(1);
            currentAllies.forEach(unit => {
                const pos = unit.getPosition();
                if (Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS) {
                    unit.applyAttackBuff(ATTACK_BUFF, BUFF_DURATION);

                    // Individual buff indicator
                    const indicator = scene.add.graphics();
                    indicator.setDepth(8600);
                    indicator.lineStyle(2, 0xff0000, 0.8);
                    indicator.strokeCircle(pos.x, pos.y, 20);

                    scene.tweens.add({
                        targets: indicator,
                        alpha: 0,
                        scale: { from: 1, to: 1.5 },
                        duration: 300,
                        onComplete: () => indicator.destroy()
                    });
                }
            });

            scene.cameras.main.flash(100, 100, 0, 0);
        });
    }

    private spawnBloodDrain(scene: Phaser.Scene, fromX: number, fromY: number, toX: number, toY: number): void {
        const particleCount = 8;
        for (let i = 0; i < particleCount; i++) {
            const particle = scene.add.graphics();
            particle.setDepth(8800);
            particle.setBlendMode(Phaser.BlendModes.ADD);
            particle.fillStyle(0xff0000, 0.9);
            particle.fillCircle(0, 0, 4);
            particle.x = fromX;
            particle.y = fromY;

            scene.tweens.add({
                targets: particle,
                x: toX + Phaser.Math.Between(-20, 20),
                y: toY + Phaser.Math.Between(-20, 20),
                alpha: 0,
                delay: i * 50,
                duration: 400,
                ease: 'Quad.easeIn',
                onComplete: () => particle.destroy()
            });
        }
    }
}

/**
 * Zhaquille (Frankenstein) - Flesh Link
 * Links allies to share damage and gain shields
 */
export class FleshLink implements ICommanderActiveSkill {
    id = 'flesh_link';
    name = 'Flesh Link';
    description = 'Links all friendly units in range, sharing damage equally and granting a protective shield.';

    private radius = 160;
    private duration = 4000;
    private shieldPercent = 0.1;
    private damageSharePercent = 0.5;

    configure(template: CommanderSkillTemplate): void {
        this.radius = template.radius ?? this.radius;
        this.duration = template.durationMs ?? this.duration;
        this.shieldPercent = template.shieldPercent ?? this.shieldPercent;
        this.damageSharePercent = template.damageSharePercent ?? this.damageSharePercent;
    }

    execute(scene: Phaser.Scene, unitManager: UnitManager, centerX: number, centerY: number): void {
        const RADIUS = this.radius;
        const DURATION = this.duration;
        const SHIELD_PERCENT = this.shieldPercent;
        const DAMAGE_SHARE = this.damageSharePercent;

        // Find all allies in range
        const allies = unitManager.getUnitsByTeam(1);
        const linkedUnits = allies.filter(unit => {
            const pos = unit.getPosition();
            return Phaser.Math.Distance.Between(pos.x, pos.y, centerX, centerY) <= RADIUS;
        });

        if (linkedUnits.length === 0) return;

        // Calculate total HP for shield
        let totalHp = 0;
        linkedUnits.forEach(unit => {
            totalHp += unit.getCurrentHp();
        });
        const shieldAmount = totalHp * SHIELD_PERCENT;

        // DISTINCTIVE: Sickly Green Bio-organic Link Field with tendril connections
        const linkField = scene.add.graphics();
        linkField.setDepth(7800);
        
        // Initial bio-mass burst
        const burstGraphics = scene.add.graphics();
        burstGraphics.setDepth(9000);
        burstGraphics.setBlendMode(Phaser.BlendModes.ADD);
        burstGraphics.fillStyle(0x33ff33, 0.8);
        burstGraphics.fillCircle(centerX, centerY, 40);
        burstGraphics.lineStyle(6, 0x00ff00, 0.9);
        burstGraphics.strokeCircle(centerX, centerY, 60);
        
        scene.tweens.add({
            targets: burstGraphics,
            alpha: 0,
            scale: { from: 1, to: 3 },
            duration: 500,
            onComplete: () => burstGraphics.destroy()
        });
        
        // Green flash
        scene.cameras.main.flash(200, 50, 150, 50, false);

        // Apply shields and setup damage sharing
        linkedUnits.forEach(unit => {
            unit.applyShield(shieldAmount / linkedUnits.length, DURATION);
            unit.applyDamageShare(DAMAGE_SHARE, linkedUnits, DURATION);
        });

        // Visualize links
        let linkTime = 0;
        const linkEvent = scene.time.addEvent({
            delay: 50,
            repeat: DURATION / 50,
            callback: () => {
                linkTime += 50;
                linkField.clear();

                const alpha = 0.6 * (1 - linkTime / DURATION);

                // Draw links between units
                linkField.lineStyle(2, 0x00ff00, alpha);
                for (let i = 0; i < linkedUnits.length; i++) {
                    const unitA = linkedUnits[i];
                    if (!unitA.isAlive()) continue;
                    const posA = unitA.getPosition();

                    for (let j = i + 1; j < linkedUnits.length; j++) {
                        const unitB = linkedUnits[j];
                        if (!unitB.isAlive()) continue;
                        const posB = unitB.getPosition();

                        // Pulsing line
                        const pulseOffset = Math.sin(linkTime * 0.02 + i) * 2;
                        linkField.beginPath();
                        linkField.moveTo(posA.x, posA.y);

                        // Curved link
                        const midX = (posA.x + posB.x) / 2;
                        const midY = (posA.y + posB.y) / 2 + pulseOffset * 5;
                        linkField.lineTo(midX, midY);
                        linkField.lineTo(posB.x, posB.y);
                        linkField.strokePath();
                    }

                    // Unit link indicator
                    linkField.lineStyle(1, 0x00ff00, alpha * 0.7);
                    linkField.strokeCircle(posA.x, posA.y, 15 + Math.sin(linkTime * 0.01) * 3);
                }

                // Center nexus
                linkField.fillStyle(0x00ff00, alpha * 0.5);
                linkField.fillCircle(centerX, centerY, 10 + Math.sin(linkTime * 0.015) * 5);
            }
        });

        // Initial link burst
        const burst = scene.add.graphics();
        burst.setDepth(9000);
        burst.setBlendMode(Phaser.BlendModes.ADD);
        burst.fillStyle(0x00ff00, 0.8);
        burst.fillCircle(centerX, centerY, 20);

        scene.tweens.add({
            targets: burst,
            alpha: 0,
            scale: { from: 1, to: 5 },
            duration: 400,
            onComplete: () => burst.destroy()
        });

        // Energy pulses along links
        const pulseEvent = scene.time.addEvent({
            delay: 500,
            repeat: DURATION / 500 - 1,
            callback: () => {
                linkedUnits.forEach(unit => {
                    if (!unit.isAlive()) return;
                    const pos = unit.getPosition();

                    const pulse = scene.add.graphics();
                    pulse.setDepth(8700);
                    pulse.setBlendMode(Phaser.BlendModes.ADD);
                    pulse.fillStyle(0x66ff66, 0.6);
                    pulse.fillCircle(0, 0, 6);
                    pulse.x = centerX;
                    pulse.y = centerY;

                    scene.tweens.add({
                        targets: pulse,
                        x: pos.x,
                        y: pos.y,
                        alpha: 0,
                        duration: 400,
                        onComplete: () => pulse.destroy()
                    });
                });
            }
        });

        scene.time.delayedCall(DURATION, () => {
            linkEvent.destroy();
            pulseEvent.destroy();
            linkField.destroy();

            // Clear damage share
            linkedUnits.forEach(unit => {
                if (unit.isAlive()) {
                    unit.clearDamageShare();
                }
            });
        });
    }
}
