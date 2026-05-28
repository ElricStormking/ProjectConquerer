import Phaser from 'phaser';
import { UnitType } from '../data/UnitTypes';

export interface ProjectileConfig {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    unitType: UnitType;
    damage: number;
    speed: number;
    attackerTeam?: number;
}

export class Projectile extends Phaser.GameObjects.Container {
    private projectileGraphics!: Phaser.GameObjects.Graphics;
    // Lock to first targeted position for self-detonation behavior
    private initialTargetX: number;
    private initialTargetY: number;
    private totalDistanceToTarget: number = 0;
    private traveledDistance: number = 0;
    private speed: number;
    private damage: number;
    private unitType: UnitType;
    private trail: Phaser.GameObjects.Graphics[] = [];
    private exploded: boolean = false;
    private attackerTeam: number | undefined;
    // Debug helpers to visualize landing point
    private debugTargetMarker?: Phaser.GameObjects.Graphics;
    private debugTargetLabel?: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, config: ProjectileConfig) {
        super(scene, config.startX, config.startY);
        
        this.initialTargetX = config.targetX;
        this.initialTargetY = config.targetY;
        this.speed = config.speed;
        this.damage = config.damage;
        this.unitType = config.unitType;
        this.attackerTeam = config.attackerTeam;

        // Precompute the total distance from spawn to the initial target.
        this.totalDistanceToTarget = Math.sqrt(
            (this.initialTargetX - this.x) * (this.initialTargetX - this.x) +
            (this.initialTargetY - this.y) * (this.initialTargetY - this.y)
        );

        this.createProjectileGraphics();
        scene.add.existing(this);

        // For Dark Mage, draw a red marker and coordinates at the landing point for debugging
        if (this.unitType === UnitType.DARK_MAGE) {
            this.createDebugTargetMarker();
        }
    }

    private createProjectileGraphics() {
        this.projectileGraphics = this.scene.add.graphics();
        
        switch (this.unitType) {
            case UnitType.SNIPER:
                // Arrow projectile (drawn pointing along +X; rotated during update)
                this.projectileGraphics.clear();
                this.projectileGraphics.fillStyle(0xFFD700, 1); // Gold
                this.projectileGraphics.lineStyle(1, 0xFFF1A8, 0.9);
                this.projectileGraphics.beginPath();
                // Shaft
                this.projectileGraphics.moveTo(-6, -1);
                this.projectileGraphics.lineTo(2, -1);
                this.projectileGraphics.lineTo(2, 1);
                this.projectileGraphics.lineTo(-6, 1);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                // Head (triangle)
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(2, -3);
                this.projectileGraphics.lineTo(6, 0);
                this.projectileGraphics.lineTo(2, 3);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                break;

            case UnitType.TRIARCH_AETHER_ARCHER:
                // Aether arrow: bright, piercing arcane bolt
                this.projectileGraphics.setBlendMode(Phaser.BlendModes.ADD);
                this.projectileGraphics.fillStyle(0x7bdcff, 0.9);
                this.projectileGraphics.lineStyle(1, 0xe6fbff, 0.9);
                this.projectileGraphics.beginPath();
                // Shaft
                this.projectileGraphics.moveTo(-10, -1.5);
                this.projectileGraphics.lineTo(6, -1.5);
                this.projectileGraphics.lineTo(6, 1.5);
                this.projectileGraphics.lineTo(-10, 1.5);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                // Head
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(6, -4);
                this.projectileGraphics.lineTo(12, 0);
                this.projectileGraphics.lineTo(6, 4);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                // Tail spark
                this.projectileGraphics.fillStyle(0x4bb8ff, 0.7);
                this.projectileGraphics.fillCircle(-12, 0, 2);
                break;

            case UnitType.TRIARCH_SNIPER_ELITE:
                this.projectileGraphics.setBlendMode(Phaser.BlendModes.ADD);
                this.projectileGraphics.fillStyle(0xf4fbff, 1);
                this.projectileGraphics.lineStyle(1, 0x9be8ff, 0.95);
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(-16, -1);
                this.projectileGraphics.lineTo(8, -1);
                this.projectileGraphics.lineTo(8, 1);
                this.projectileGraphics.lineTo(-16, 1);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(8, -5);
                this.projectileGraphics.lineTo(17, 0);
                this.projectileGraphics.lineTo(8, 5);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                this.projectileGraphics.lineStyle(2, 0xdff7ff, 0.85);
                this.projectileGraphics.lineBetween(-22, 0, -7, 0);
                break;

            case UnitType.JADE_ARCHER:
                this.projectileGraphics.clear();
                this.projectileGraphics.fillStyle(0x7de3a1, 1);
                this.projectileGraphics.lineStyle(1, 0xd8ffea, 0.9);
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(-7, -1);
                this.projectileGraphics.lineTo(3, -1);
                this.projectileGraphics.lineTo(3, 1);
                this.projectileGraphics.lineTo(-7, 1);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(3, -3);
                this.projectileGraphics.lineTo(8, 0);
                this.projectileGraphics.lineTo(3, 3);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                break;

            case UnitType.FROST_SKELETON_ARCHER:
                this.projectileGraphics.clear();
                this.projectileGraphics.fillStyle(0xd9e6ef, 1);
                this.projectileGraphics.lineStyle(1, 0xf7fbff, 0.9);
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(-7, -1);
                this.projectileGraphics.lineTo(3, -1);
                this.projectileGraphics.lineTo(3, 1);
                this.projectileGraphics.lineTo(-7, 1);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(3, -3);
                this.projectileGraphics.lineTo(8, 0);
                this.projectileGraphics.lineTo(3, 3);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                break;

            case UnitType.ELF_ELVEN_BOWMEN:
                this.projectileGraphics.clear();
                this.projectileGraphics.fillStyle(0x8cf06c, 1);
                this.projectileGraphics.lineStyle(1, 0xe6ffd8, 0.9);
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(-7, -1);
                this.projectileGraphics.lineTo(3, -1);
                this.projectileGraphics.lineTo(3, 1);
                this.projectileGraphics.lineTo(-7, 1);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(3, -3);
                this.projectileGraphics.lineTo(8, 0);
                this.projectileGraphics.lineTo(3, 3);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                break;

            case UnitType.TRIARCH_DOMINION_GUNNER:
                this.projectileGraphics.setBlendMode(Phaser.BlendModes.ADD);
                this.projectileGraphics.fillStyle(0xfff0b3, 0.95);
                this.projectileGraphics.fillCircle(0, 0, 3);
                this.projectileGraphics.lineStyle(2, 0xffcf66, 0.9);
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(-6, 0);
                this.projectileGraphics.lineTo(5, 0);
                this.projectileGraphics.strokePath();
                break;

            case UnitType.ABYSS_ABYSSAL_FIRESPITTER:
                this.projectileGraphics.setBlendMode(Phaser.BlendModes.ADD);
                this.projectileGraphics.fillStyle(0xff7a33, 0.9);
                this.projectileGraphics.fillCircle(0, 0, 6);
                this.projectileGraphics.fillStyle(0xffd166, 0.85);
                this.projectileGraphics.fillCircle(1, 0, 3);
                this.projectileGraphics.lineStyle(2, 0x992200, 0.75);
                this.projectileGraphics.strokeCircle(0, 0, 6);
                break;

            case UnitType.TRIARCH_FIRETHROWER_UNIT:
                this.projectileGraphics.setBlendMode(Phaser.BlendModes.ADD);
                this.projectileGraphics.fillStyle(0xfff1a8, 0.95);
                this.projectileGraphics.fillCircle(6, 0, 3);
                this.projectileGraphics.fillStyle(0xff8a18, 0.9);
                this.projectileGraphics.fillCircle(0, 0, 6);
                this.projectileGraphics.fillStyle(0xd94213, 0.7);
                this.projectileGraphics.fillCircle(-5, 0, 4);
                this.projectileGraphics.lineStyle(3, 0xffc04a, 0.75);
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(-8, 0);
                this.projectileGraphics.lineTo(9, 0);
                this.projectileGraphics.strokePath();
                break;
                
            case UnitType.TRIARCH_MANA_SIPHON_ADEPT:
                // Mana siphon bolt: vivid violet lance with core spark
                this.projectileGraphics.setBlendMode(Phaser.BlendModes.ADD);
                this.projectileGraphics.fillStyle(0xc07bff, 0.9);
                this.projectileGraphics.lineStyle(1, 0xf1ddff, 0.9);
                this.projectileGraphics.beginPath();
                // Shaft
                this.projectileGraphics.moveTo(-8, -2);
                this.projectileGraphics.lineTo(8, -2);
                this.projectileGraphics.lineTo(8, 2);
                this.projectileGraphics.lineTo(-8, 2);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                // Tip
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(8, -5);
                this.projectileGraphics.lineTo(14, 0);
                this.projectileGraphics.lineTo(8, 5);
                this.projectileGraphics.closePath();
                this.projectileGraphics.fillPath();
                this.projectileGraphics.strokePath();
                // Core glow
                this.projectileGraphics.fillStyle(0x7a33ff, 0.8);
                this.projectileGraphics.fillCircle(0, 0, 3);
                break;
                
            case UnitType.SHOTGUNNER:
                // Shotgun pellets
                this.projectileGraphics.fillStyle(0xC0C0C0, 1); // Silver pellets
                this.projectileGraphics.fillCircle(0, 0, 2);
                break;
                
            case UnitType.DARK_MAGE:
                // Dark magic orb (full purple)
                this.projectileGraphics.setBlendMode(Phaser.BlendModes.ADD);
                // Outer glow
                this.projectileGraphics.fillStyle(0xAA66FF, 0.9);
                this.projectileGraphics.fillCircle(0, 0, 9);
                // Inner aura
                this.projectileGraphics.fillStyle(0x7A33FF, 0.85);
                this.projectileGraphics.fillCircle(0, 0, 6);
                // Core
                this.projectileGraphics.fillStyle(0x330066, 1.0);
                this.projectileGraphics.fillCircle(0, 0, 3);
                // Subtle edge ring
                this.projectileGraphics.lineStyle(2, 0xD0B0FF, 0.8);
                this.projectileGraphics.strokeCircle(0, 0, 9);
                // subtle pulse
                this.scene.tweens.add({
                    targets: this.projectileGraphics,
                    scaleX: 1.15,
                    scaleY: 1.15,
                    duration: 300,
                    yoyo: true,
                    repeat: -1
                });
                break;
                
            case UnitType.CHRONOTEMPORAL:
                // Time magic - shimmering effect
                this.projectileGraphics.fillStyle(0x00FFFF, 0.7); // Cyan
                this.projectileGraphics.fillCircle(0, 0, 5);
                this.projectileGraphics.fillStyle(0xFFFFFF, 0.5); // White center
                this.projectileGraphics.fillCircle(0, 0, 2);
                break;

            case UnitType.COG_THUNDER_CANNON:
                // Thunder Cannon bolt: bright, jagged lightning shard
                this.projectileGraphics.setBlendMode(Phaser.BlendModes.ADD);
                this.projectileGraphics.lineStyle(3, 0xE3F2FD, 1.0);
                this.projectileGraphics.beginPath();
                this.projectileGraphics.moveTo(0, -10);
                this.projectileGraphics.lineTo(4, -4);
                this.projectileGraphics.lineTo(-2, 2);
                this.projectileGraphics.lineTo(5, 8);
                this.projectileGraphics.lineTo(0, 12);
                this.projectileGraphics.strokePath();
                this.projectileGraphics.fillStyle(0x90CAF9, 0.85);
                this.projectileGraphics.fillCircle(0, 0, 4);
                break;
                
            default:
                // Generic ranged attack
                this.projectileGraphics.fillStyle(0xFFFFFF, 0.8);
                this.projectileGraphics.fillCircle(0, 0, 4);
                break;
        }

        this.add(this.projectileGraphics);
    }

    public update(deltaTime: number): boolean {
        // Always head toward the initial targeted position
        const direction = {
            x: this.initialTargetX - this.x,
            y: this.initialTargetY - this.y
        };

        const remainingDistance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);

        // If we are within this frame's travel distance, detonate exactly at the initial target
        const stepDistance = this.speed * deltaTime;
        if (remainingDistance <= stepDistance || this.traveledDistance + stepDistance >= this.totalDistanceToTarget) {
            // Snap to target and explode
            this.x = this.initialTargetX;
            this.y = this.initialTargetY;
            this.createImpactEffect();
            return true; // Signal for removal
        }

        // Normalize direction and move by stepDistance
        const inv = 1 / Math.max(1e-6, remainingDistance);
        const vx = direction.x * inv;
        const vy = direction.y * inv;
        this.x += vx * stepDistance;
        this.y += vy * stepDistance;
        this.traveledDistance += stepDistance;

        // Orient projectile graphics along travel direction
        if (
            this.unitType === UnitType.SNIPER ||
            this.unitType === UnitType.JADE_ARCHER ||
            this.unitType === UnitType.FROST_SKELETON_ARCHER ||
            this.unitType === UnitType.ELF_ELVEN_BOWMEN ||
            this.unitType === UnitType.TRIARCH_SNIPER_ELITE ||
            this.unitType === UnitType.TRIARCH_DOMINION_GUNNER ||
            this.unitType === UnitType.TRIARCH_AETHER_ARCHER ||
            this.unitType === UnitType.TRIARCH_MANA_SIPHON_ADEPT ||
            this.unitType === UnitType.TRIARCH_FIRETHROWER_UNIT
        ) {
            const angle = Math.atan2(vy, vx);
            this.projectileGraphics.setRotation(angle);
        }

        // Create trail effect for magic projectiles
        if (
            this.unitType === UnitType.DARK_MAGE ||
            this.unitType === UnitType.CHRONOTEMPORAL ||
            this.unitType === UnitType.TRIARCH_SNIPER_ELITE ||
            this.unitType === UnitType.TRIARCH_AETHER_ARCHER ||
            this.unitType === UnitType.TRIARCH_MANA_SIPHON_ADEPT ||
            this.unitType === UnitType.TRIARCH_FIRETHROWER_UNIT
        ) {
            this.createTrailEffect();
        }

        return false;
    }

    private createDebugTargetMarker() {
        const g = this.scene.add.graphics();
        g.setDepth(10000);
        g.setPosition(this.initialTargetX, this.initialTargetY);
        g.lineStyle(2, 0xff0000, 0.95);
        g.fillStyle(0xff0000, 0.45);
        // Draw around local (0,0) so transforms apply correctly
        g.strokeCircle(0, 0, 10);
        g.fillCircle(0, 0, 4);
        g.lineBetween(-12, 0, 12, 0);
        g.lineBetween(0, -12, 0, 12);
        this.debugTargetMarker = g;

        const label = this.scene.add.text(0, 0, `(${Math.round(this.initialTargetX)}, ${Math.round(this.initialTargetY)})`,
            { font: '12px monospace', color: '#ff4444', stroke: '#000000', strokeThickness: 2 });
        label.setPosition(this.initialTargetX + 14, this.initialTargetY - 16);
        label.setDepth(10001);
        this.debugTargetLabel = label;

        // Pulse to make it visible
        this.scene.tweens.add({ targets: g, alpha: 0.4, yoyo: true, repeat: -1, duration: 400 });
    }

    private createTrailEffect() {
        if (this.trail.length > 8) {
            const oldTrail = this.trail.shift();
            oldTrail?.destroy();
        }

        const trailGraphics = this.scene.add.graphics();
        const alpha = 0.3;
        
        if (this.unitType === UnitType.DARK_MAGE) {
            trailGraphics.fillStyle(0xAA66FF, alpha);
        } else if (this.unitType === UnitType.TRIARCH_SNIPER_ELITE) {
            const angle = Math.atan2(this.initialTargetY - this.y, this.initialTargetX - this.x);
            const tailX = this.x - Math.cos(angle) * 34;
            const tailY = this.y - Math.sin(angle) * 34;
            trailGraphics.setBlendMode(Phaser.BlendModes.ADD);
            trailGraphics.lineStyle(3, 0xcdf6ff, 0.42);
            trailGraphics.lineBetween(tailX, tailY, this.x, this.y);
            trailGraphics.lineStyle(1, 0x6fd8ff, 0.6);
            trailGraphics.lineBetween(tailX - Math.cos(angle) * 10, tailY - Math.sin(angle) * 10, this.x, this.y);
            trailGraphics.fillStyle(0xffffff, 0.35);
            trailGraphics.fillCircle(this.x, this.y, 2);
            this.trail.push(trailGraphics);

            this.scene.tweens.add({
                targets: trailGraphics,
                alpha: 0,
                duration: 280,
                onComplete: () => {
                    trailGraphics.destroy();
                }
            });
            return;
        } else if (this.unitType === UnitType.TRIARCH_AETHER_ARCHER) {
            trailGraphics.fillStyle(0x7bdcff, alpha);
        } else if (this.unitType === UnitType.TRIARCH_MANA_SIPHON_ADEPT) {
            trailGraphics.fillStyle(0xc07bff, alpha);
        } else if (this.unitType === UnitType.TRIARCH_FIRETHROWER_UNIT) {
            trailGraphics.setBlendMode(Phaser.BlendModes.ADD);
            trailGraphics.fillStyle(0xff7a18, 0.28);
        } else {
            trailGraphics.fillStyle(0x00FFFF, alpha);
        }
        
        trailGraphics.fillCircle(this.x, this.y, 3);
        this.trail.push(trailGraphics);

        // Fade out trail over time
        this.scene.tweens.add({
            targets: trailGraphics,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                trailGraphics.destroy();
            }
        });
    }

    private createImpactEffect() {
        const impactGraphics = this.scene.add.graphics();
        // Draw at local (0,0) and place the graphics at world position
        impactGraphics.setPosition(this.x, this.y);
        
        switch (this.unitType) {
            case UnitType.SNIPER:
                // Bullet impact spark (centered at local origin)
                impactGraphics.fillStyle(0xFFD700, 1);
                impactGraphics.fillCircle(0, 0, 5);
                break;
                
            case UnitType.SHOTGUNNER:
                // Spread impact (centered at local origin)
                for (let i = 0; i < 5; i++) {
                    const angle = (i / 4) * Math.PI * 2;
                    const offsetX = Math.cos(angle) * 8;
                    const offsetY = Math.sin(angle) * 8;
                    impactGraphics.fillStyle(0xC0C0C0, 0.8);
                    impactGraphics.fillCircle(offsetX, offsetY, 2);
                }
                break;
                
            case UnitType.DARK_MAGE:
                // Dark magic explosion (purple, more obvious)
                impactGraphics.setBlendMode(Phaser.BlendModes.ADD);
                impactGraphics.fillStyle(0xAA66FF, 0.65);
                impactGraphics.fillCircle(0, 0, 24);
                impactGraphics.fillStyle(0x7A33FF, 0.55);
                impactGraphics.fillCircle(0, 0, 14);
                impactGraphics.lineStyle(3, 0xE0CCFF, 0.9);
                impactGraphics.strokeCircle(0, 0, 28);

                // (No particles flying away; keep explosion anchored only)

                // Area damage on impact
                if (!this.exploded) {
                    this.exploded = true;
                    const explosionRadius = 100;
                    this.scene.events.emit('dark-mage-explosion', {
                        x: this.x,
                        y: this.y,
                        radius: explosionRadius,
                        damage: Math.round(this.damage * 0.85),
                        attackerTeam: this.attackerTeam
                    });
                }
                // Remove debug marker once detonated
                this.debugTargetMarker?.destroy();
                this.debugTargetLabel?.destroy();
                break;

            case UnitType.TRIARCH_AETHER_ARCHER:
                // Aether impact burst (centered at local origin)
                impactGraphics.setBlendMode(Phaser.BlendModes.ADD);
                impactGraphics.lineStyle(3, 0xb9f4ff, 0.9);
                impactGraphics.strokeCircle(0, 0, 18);
                impactGraphics.lineStyle(1, 0xffffff, 0.8);
                impactGraphics.lineBetween(-10, 0, 10, 0);
                impactGraphics.lineBetween(0, -10, 0, 10);
                impactGraphics.fillStyle(0x7bdcff, 0.6);
                impactGraphics.fillCircle(0, 0, 6);
                break;

            case UnitType.TRIARCH_SNIPER_ELITE:
                impactGraphics.setBlendMode(Phaser.BlendModes.ADD);
                impactGraphics.lineStyle(3, 0xe9fbff, 0.9);
                impactGraphics.lineBetween(-14, 0, 14, 0);
                impactGraphics.lineBetween(0, -10, 0, 10);
                impactGraphics.fillStyle(0x9be8ff, 0.45);
                impactGraphics.fillCircle(0, 0, 10);
                break;

            case UnitType.TRIARCH_MANA_SIPHON_ADEPT:
                // Mana siphon impact: violet burst with cross flare
                impactGraphics.setBlendMode(Phaser.BlendModes.ADD);
                impactGraphics.lineStyle(3, 0xd8b6ff, 0.9);
                impactGraphics.strokeCircle(0, 0, 20);
                impactGraphics.lineStyle(2, 0x9f66ff, 0.85);
                impactGraphics.lineBetween(-12, 0, 12, 0);
                impactGraphics.lineBetween(0, -12, 0, 12);
                impactGraphics.fillStyle(0x7a33ff, 0.7);
                impactGraphics.fillCircle(0, 0, 7);
                break;
                
            case UnitType.CHRONOTEMPORAL:
                // Time distortion effect (centered at local origin)
                impactGraphics.lineStyle(3, 0x00FFFF, 0.8);
                impactGraphics.strokeCircle(0, 0, 10);
                impactGraphics.lineStyle(2, 0xFFFFFF, 0.6);
                impactGraphics.strokeCircle(0, 0, 15);
                break;

            case UnitType.COG_THUNDER_CANNON:
                // Thunder Cannon impact: small explosive lightning ring
                impactGraphics.setBlendMode(Phaser.BlendModes.ADD);
                impactGraphics.lineStyle(3, 0xE3F2FD, 0.95);
                impactGraphics.strokeCircle(0, 0, 32);
                impactGraphics.fillStyle(0x90CAF9, 0.35);
                impactGraphics.fillCircle(0, 0, 24);
                break;

            case UnitType.TRIARCH_FIRETHROWER_UNIT:
                impactGraphics.setBlendMode(Phaser.BlendModes.ADD);
                impactGraphics.fillStyle(0xff8a18, 0.45);
                impactGraphics.fillCircle(0, 0, 18);
                impactGraphics.fillStyle(0xffe08a, 0.5);
                impactGraphics.fillCircle(0, 0, 8);
                impactGraphics.lineStyle(2, 0xb82010, 0.75);
                impactGraphics.strokeCircle(0, 0, 20);
                break;
        }

        // Animate impact effect
        this.scene.tweens.add({
            targets: impactGraphics,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 300,
            onComplete: () => {
                impactGraphics.destroy();
            }
        });
    }

    public getDamage(): number {
        return this.damage;
    }

    public destroy() {
        this.trail.forEach(trail => trail.destroy());
        this.projectileGraphics.destroy();
        super.destroy();
    }
}

export class ProjectileSystem {
    private scene: Phaser.Scene;
    private projectiles: Projectile[] = [];

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public createProjectile(config: ProjectileConfig): Projectile {
        if (config.unitType === UnitType.TRIARCH_FIRETHROWER_UNIT) {
            this.createFlamethrowerParticles(config);
        }
        const projectile = new Projectile(this.scene, config);
        this.projectiles.push(projectile);
        return projectile;
    }

    private createFlamethrowerParticles(config: ProjectileConfig): void {
        const dx = config.targetX - config.startX;
        const dy = config.targetY - config.startY;
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
        if (distanceToTarget < 1) return;

        const angle = Math.atan2(dy, dx);
        const directionX = Math.cos(angle);
        const directionY = Math.sin(angle);
        const sideX = Math.cos(angle + Math.PI / 2);
        const sideY = Math.sin(angle + Math.PI / 2);
        const streamLength = Math.min(distanceToTarget, 190);
        const baseDepth = Math.max(config.startY, config.targetY) + 5200;

        const cone = this.scene.add.graphics();
        cone.setPosition(config.startX, config.startY);
        cone.setDepth(baseDepth - 1);
        cone.setBlendMode(Phaser.BlendModes.ADD);

        const spread = Phaser.Math.DegToRad(17);
        const leftX = Math.cos(angle - spread) * streamLength;
        const leftY = Math.sin(angle - spread) * streamLength;
        const rightX = Math.cos(angle + spread) * streamLength;
        const rightY = Math.sin(angle + spread) * streamLength;
        cone.fillStyle(0xff7a18, 0.2);
        cone.fillTriangle(0, 0, leftX, leftY, rightX, rightY);
        cone.lineStyle(5, 0xffd36a, 0.35);
        cone.lineBetween(0, 0, directionX * streamLength, directionY * streamLength);

        this.scene.tweens.add({
            targets: cone,
            alpha: 0,
            scaleX: 1.04,
            scaleY: 1.08,
            duration: 180,
            ease: 'Quad.easeOut',
            onComplete: () => cone.destroy()
        });

        const particleCount = 28;
        const palette = [0xfff2a6, 0xffc247, 0xff7a18, 0xd83a12];
        for (let i = 0; i < particleCount; i++) {
            const t = (i + Phaser.Math.FloatBetween(0, 0.85)) / particleCount;
            const forward = streamLength * t;
            const coneWidth = 8 + t * 52;
            const lateral = Phaser.Math.FloatBetween(-coneWidth, coneWidth);
            const x = config.startX + directionX * forward + sideX * lateral;
            const y = config.startY + directionY * forward + sideY * lateral;
            const color = palette[Math.min(palette.length - 1, Math.floor(t * palette.length))];
            const radius = Phaser.Math.FloatBetween(3, 7 + t * 8);
            const particle = this.scene.add.circle(x, y, radius, color, 0.9 - t * 0.28);
            particle.setDepth(baseDepth + i);
            particle.setBlendMode(Phaser.BlendModes.ADD);

            this.scene.tweens.add({
                targets: particle,
                x: x + directionX * Phaser.Math.FloatBetween(14, 34) + sideX * Phaser.Math.FloatBetween(-10, 10),
                y: y + directionY * Phaser.Math.FloatBetween(14, 34) + sideY * Phaser.Math.FloatBetween(-10, 10),
                alpha: 0,
                scaleX: 1.7 + t * 0.8,
                scaleY: 1.5 + t * 0.7,
                duration: Phaser.Math.Between(150, 290),
                ease: 'Quad.easeOut',
                onComplete: () => particle.destroy()
            });
        }

        for (let i = 0; i < 8; i++) {
            const t = Phaser.Math.FloatBetween(0.45, 1);
            const forward = streamLength * t;
            const lateral = Phaser.Math.FloatBetween(-18, 18) * t;
            const x = config.startX + directionX * forward + sideX * lateral;
            const y = config.startY + directionY * forward + sideY * lateral;
            const ember = this.scene.add.circle(x, y, Phaser.Math.FloatBetween(1.5, 3), 0x5a1b10, 0.5);
            ember.setDepth(baseDepth - 2);

            this.scene.tweens.add({
                targets: ember,
                y: y - Phaser.Math.FloatBetween(10, 24),
                alpha: 0,
                scaleX: 2,
                scaleY: 2,
                duration: Phaser.Math.Between(260, 420),
                ease: 'Sine.easeOut',
                onComplete: () => ember.destroy()
            });
        }
    }

    public update(deltaTime: number) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            const shouldRemove = projectile.update(deltaTime);
            
            if (shouldRemove) {
                projectile.destroy();
                this.projectiles.splice(i, 1);
            }
        }
    }

    public getProjectileCount(): number {
        return this.projectiles.length;
    }
}
