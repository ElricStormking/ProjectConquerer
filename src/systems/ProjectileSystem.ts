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
}

export class Projectile extends Phaser.GameObjects.Container {
    private projectileGraphics: Phaser.GameObjects.Graphics;
    private targetX: number;
    private targetY: number;
    private speed: number;
    private damage: number;
    private unitType: UnitType;
    private trail: Phaser.GameObjects.Graphics[] = [];

    constructor(scene: Phaser.Scene, config: ProjectileConfig) {
        super(scene, config.startX, config.startY);
        
        this.targetX = config.targetX;
        this.targetY = config.targetY;
        this.speed = config.speed;
        this.damage = config.damage;
        this.unitType = config.unitType;

        this.createProjectileGraphics();
        scene.add.existing(this);
    }

    private createProjectileGraphics() {
        this.projectileGraphics = this.scene.add.graphics();
        
        switch (this.unitType) {
            case UnitType.SNIPER:
                // Bullet projectile
                this.projectileGraphics.fillStyle(0xFFD700, 1); // Gold bullet
                this.projectileGraphics.fillCircle(0, 0, 3);
                break;
                
            case UnitType.SHOTGUNNER:
                // Shotgun pellets
                this.projectileGraphics.fillStyle(0xC0C0C0, 1); // Silver pellets
                this.projectileGraphics.fillCircle(0, 0, 2);
                break;
                
            case UnitType.DARK_MAGE:
                // Dark magic orb
                this.projectileGraphics.fillStyle(0x8B0000, 0.8); // Dark red
                this.projectileGraphics.fillCircle(0, 0, 6);
                this.projectileGraphics.fillStyle(0x000000, 0.6); // Black center
                this.projectileGraphics.fillCircle(0, 0, 3);
                break;
                
            case UnitType.CHRONOTEMPORAL:
                // Time magic - shimmering effect
                this.projectileGraphics.fillStyle(0x00FFFF, 0.7); // Cyan
                this.projectileGraphics.fillCircle(0, 0, 5);
                this.projectileGraphics.fillStyle(0xFFFFFF, 0.5); // White center
                this.projectileGraphics.fillCircle(0, 0, 2);
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
        const direction = {
            x: this.targetX - this.x,
            y: this.targetY - this.y
        };

        const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        
        if (distance < this.speed * deltaTime) {
            // Reached target
            this.createImpactEffect();
            return true; // Signal for removal
        }

        // Normalize direction and move
        direction.x /= distance;
        direction.y /= distance;

        this.x += direction.x * this.speed * deltaTime;
        this.y += direction.y * this.speed * deltaTime;

        // Create trail effect for magic projectiles
        if (this.unitType === UnitType.DARK_MAGE || this.unitType === UnitType.CHRONOTEMPORAL) {
            this.createTrailEffect();
        }

        return false;
    }

    private createTrailEffect() {
        if (this.trail.length > 8) {
            const oldTrail = this.trail.shift();
            oldTrail?.destroy();
        }

        const trailGraphics = this.scene.add.graphics();
        const alpha = 0.3;
        
        if (this.unitType === UnitType.DARK_MAGE) {
            trailGraphics.fillStyle(0x8B0000, alpha);
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
        
        switch (this.unitType) {
            case UnitType.SNIPER:
                // Bullet impact spark
                impactGraphics.fillStyle(0xFFD700, 1);
                impactGraphics.fillCircle(this.x, this.y, 5);
                break;
                
            case UnitType.SHOTGUNNER:
                // Spread impact
                for (let i = 0; i < 5; i++) {
                    const angle = (i / 4) * Math.PI * 2;
                    const offsetX = Math.cos(angle) * 8;
                    const offsetY = Math.sin(angle) * 8;
                    impactGraphics.fillStyle(0xC0C0C0, 0.8);
                    impactGraphics.fillCircle(this.x + offsetX, this.y + offsetY, 2);
                }
                break;
                
            case UnitType.DARK_MAGE:
                // Dark magic explosion
                impactGraphics.fillStyle(0x8B0000, 0.6);
                impactGraphics.fillCircle(this.x, this.y, 12);
                impactGraphics.fillStyle(0x000000, 0.4);
                impactGraphics.fillCircle(this.x, this.y, 6);
                break;
                
            case UnitType.CHRONOTEMPORAL:
                // Time distortion effect
                impactGraphics.lineStyle(3, 0x00FFFF, 0.8);
                impactGraphics.strokeCircle(this.x, this.y, 10);
                impactGraphics.lineStyle(2, 0xFFFFFF, 0.6);
                impactGraphics.strokeCircle(this.x, this.y, 15);
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
        const projectile = new Projectile(this.scene, config);
        this.projectiles.push(projectile);
        return projectile;
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