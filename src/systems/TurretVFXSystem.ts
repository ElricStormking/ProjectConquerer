import Phaser from 'phaser';

export interface TurretShotConfig {
    effectId: string;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    damage: number;
    isStunShot?: boolean;
    chainTargets?: Array<{ x: number; y: number }>;
    aoeRadius?: number;
}

interface ActiveProjectile {
    container: Phaser.GameObjects.Container;
    config: TurretShotConfig;
    progress: number;
    trail: Phaser.GameObjects.Graphics[];
    duration: number;
}

export class TurretVFXSystem {
    private scene: Phaser.Scene;
    private activeProjectiles: ActiveProjectile[] = [];
    private activeBeams: Map<string, Phaser.GameObjects.Graphics> = new Map();

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public createTurretShot(config: TurretShotConfig): void {
        const projectile = this.createProjectileGraphics(config);
        if (!projectile) {
            this.createFallbackShot(config);
            return;
        }

        const duration = this.getProjectileDuration(config.effectId);
        const activeProj: ActiveProjectile = {
            container: projectile,
            config,
            progress: 0,
            trail: [],
            duration
        };

        this.activeProjectiles.push(activeProj);
    }

    private createProjectileGraphics(config: TurretShotConfig): Phaser.GameObjects.Container | null {
        const container = this.scene.add.container(config.startX, config.startY);
        container.setDepth(8000);
        const g = this.scene.add.graphics();
        container.add(g);

        switch (config.effectId) {
            case 'jade_archer_volley':
                this.drawJadeArrow(g, config.isStunShot);
                break;
            case 'triarch_cannon_blast':
                this.drawTriarchCannonball(g);
                break;
            case 'cannon_shoot':
                this.drawCogCannonball(g);
                break;
            case 'abyss_corruption_tower':
                this.drawCorruptionOrb(g);
                this.addCorruptionPulse(g);
                break;
            case 'triarch_lightbringer_tower':
                this.drawLightbringerLance(g);
                break;
            case 'triarch_machine_gun_nest':
                this.drawMachineGunBullet(g);
                break;
            case 'triarch_aether_tower':
                this.drawAetherBolt(g);
                break;
            case 'torment_spire':
                this.drawDecayBolt(g);
                break;
            case 'elf_sun_crystal_spire':
                container.destroy();
                this.createSunCrystalBeam(config);
                return null;
            default:
                this.drawDefaultProjectile(g);
                break;
        }

        return container;
    }

    private drawJadeArrow(g: Phaser.GameObjects.Graphics, isStunShot?: boolean): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        const baseColor = isStunShot ? 0x00ff88 : 0xFFD700;
        const glowColor = isStunShot ? 0x44ffaa : 0x88ff66;

        g.fillStyle(baseColor, 1);
        g.lineStyle(1, glowColor, 0.9);
        // Shaft
        g.beginPath();
        g.moveTo(-8, -1.5);
        g.lineTo(4, -1.5);
        g.lineTo(4, 1.5);
        g.lineTo(-8, 1.5);
        g.closePath();
        g.fillPath();
        g.strokePath();
        // Head
        g.beginPath();
        g.moveTo(4, -4);
        g.lineTo(10, 0);
        g.lineTo(4, 4);
        g.closePath();
        g.fillPath();
        g.strokePath();
        // Jade glow aura
        g.fillStyle(glowColor, 0.4);
        g.fillCircle(0, 0, 6);

        if (isStunShot) {
            g.lineStyle(2, 0x00ffaa, 0.8);
            g.strokeCircle(0, 0, 10);
        }
    }

    private drawTriarchCannonball(g: Phaser.GameObjects.Graphics): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        // Brass core
        g.fillStyle(0xcd7f32, 1);
        g.fillCircle(0, 0, 8);
        // Orange glow
        g.fillStyle(0xff6600, 0.7);
        g.fillCircle(0, 0, 12);
        // Outer ring
        g.lineStyle(2, 0xffaa00, 0.9);
        g.strokeCircle(0, 0, 10);
        // Spark highlight
        g.fillStyle(0xffffcc, 0.9);
        g.fillCircle(-3, -3, 2);
    }

    private drawCogCannonball(g: Phaser.GameObjects.Graphics): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        // Steel shell
        g.fillStyle(0x888899, 1);
        g.fillCircle(0, 0, 7);
        // Fire core
        g.fillStyle(0xff4400, 0.8);
        g.fillCircle(0, 0, 4);
        // Outer glow
        g.fillStyle(0xffaa33, 0.5);
        g.fillCircle(0, 0, 10);
        // Spark
        g.fillStyle(0xffffee, 0.9);
        g.fillCircle(-2, -2, 1.5);
    }

    private drawCorruptionOrb(g: Phaser.GameObjects.Graphics): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        // Outer corruption aura
        g.fillStyle(0x660066, 0.5);
        g.fillCircle(0, 0, 14);
        // Dark purple core
        g.fillStyle(0xaa00aa, 0.85);
        g.fillCircle(0, 0, 9);
        // Inner void
        g.fillStyle(0x220022, 1);
        g.fillCircle(0, 0, 4);
        // Corruption wisps
        g.lineStyle(2, 0xcc44cc, 0.7);
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const ox = Math.cos(angle) * 10;
            const oy = Math.sin(angle) * 10;
            g.lineBetween(0, 0, ox, oy);
        }
        // Edge ring
        g.lineStyle(2, 0xff66ff, 0.6);
        g.strokeCircle(0, 0, 12);
    }

    private addCorruptionPulse(g: Phaser.GameObjects.Graphics): void {
        this.scene.tweens.add({
            targets: g,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    private drawLightbringerLance(g: Phaser.GameObjects.Graphics): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        // Holy light shaft
        g.fillStyle(0xffffcc, 0.95);
        g.lineStyle(1, 0xffffff, 1);
        g.beginPath();
        g.moveTo(-10, -2);
        g.lineTo(8, -2);
        g.lineTo(8, 2);
        g.lineTo(-10, 2);
        g.closePath();
        g.fillPath();
        g.strokePath();
        // Radiant tip
        g.beginPath();
        g.moveTo(8, -5);
        g.lineTo(16, 0);
        g.lineTo(8, 5);
        g.closePath();
        g.fillPath();
        g.strokePath();
        // Gold aura
        g.fillStyle(0xffdd66, 0.5);
        g.fillCircle(0, 0, 8);
        // Tail glow
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(-12, 0, 3);
    }

    private drawMachineGunBullet(g: Phaser.GameObjects.Graphics): void {
        // Brass bullet
        g.fillStyle(0xddaa44, 1);
        g.beginPath();
        g.moveTo(-4, -1.5);
        g.lineTo(4, -1.5);
        g.lineTo(6, 0);
        g.lineTo(4, 1.5);
        g.lineTo(-4, 1.5);
        g.closePath();
        g.fillPath();
        // Tracer glow
        g.setBlendMode(Phaser.BlendModes.ADD);
        g.fillStyle(0xffff66, 0.6);
        g.fillCircle(-6, 0, 2);
    }

    private drawAetherBolt(g: Phaser.GameObjects.Graphics): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        // Lightning bolt shape
        g.lineStyle(3, 0x66ccff, 1);
        g.beginPath();
        g.moveTo(-8, -4);
        g.lineTo(-2, -1);
        g.lineTo(-4, 2);
        g.lineTo(4, 0);
        g.lineTo(2, 3);
        g.lineTo(10, 0);
        g.strokePath();
        // Core glow
        g.fillStyle(0xaaddff, 0.8);
        g.fillCircle(0, 0, 5);
        // Electric sparks
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(2, -2, 1.5);
        g.fillCircle(-3, 1, 1);
    }

    private drawDecayBolt(g: Phaser.GameObjects.Graphics): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        // Sickly green core
        g.fillStyle(0x66aa33, 0.9);
        g.fillCircle(0, 0, 7);
        // Dark decay ring
        g.fillStyle(0x334411, 0.7);
        g.fillCircle(0, 0, 10);
        // Poison drips
        g.fillStyle(0x88cc44, 0.8);
        for (let i = 0; i < 3; i++) {
            const ox = Phaser.Math.Between(-6, 6);
            const oy = Phaser.Math.Between(4, 10);
            g.fillCircle(ox, oy, 2);
        }
        // Bone fragment hint
        g.fillStyle(0xddddaa, 0.6);
        g.fillCircle(-2, -2, 1.5);
    }

    private drawDefaultProjectile(g: Phaser.GameObjects.Graphics): void {
        g.fillStyle(0xfff3b0, 0.9);
        g.fillCircle(0, 0, 5);
        g.lineStyle(1, 0xffffcc, 0.8);
        g.strokeCircle(0, 0, 6);
    }

    private createSunCrystalBeam(config: TurretShotConfig): void {
        const beamKey = `${config.startX}_${config.startY}`;
        let beam = this.activeBeams.get(beamKey);

        if (beam) {
            beam.clear();
        } else {
            beam = this.scene.add.graphics();
            beam.setDepth(7900);
            this.activeBeams.set(beamKey, beam);
        }

        beam.setBlendMode(Phaser.BlendModes.ADD);

        const dx = config.targetX - config.startX;
        const dy = config.targetY - config.startY;
        const dist = Math.hypot(dx, dy);

        // Main beam
        beam.lineStyle(6, 0xffdd44, 0.7);
        beam.lineBetween(config.startX, config.startY - 30, config.targetX, config.targetY);
        
        // Inner bright core
        beam.lineStyle(3, 0xffffaa, 0.9);
        beam.lineBetween(config.startX, config.startY - 30, config.targetX, config.targetY);
        
        // White hot center
        beam.lineStyle(1, 0xffffff, 1);
        beam.lineBetween(config.startX, config.startY - 30, config.targetX, config.targetY);

        // Light particles along beam
        const particleCount = Math.floor(dist / 40);
        for (let i = 0; i < particleCount; i++) {
            const t = (i + Math.random() * 0.5) / particleCount;
            const px = config.startX + dx * t;
            const py = (config.startY - 30) + (dy + 30) * t;
            const size = 2 + Math.random() * 2;
            beam.fillStyle(0xffffcc, 0.6 + Math.random() * 0.3);
            beam.fillCircle(px + (Math.random() - 0.5) * 8, py + (Math.random() - 0.5) * 8, size);
        }

        // Impact glow
        beam.fillStyle(0xffff88, 0.6);
        beam.fillCircle(config.targetX, config.targetY, 16);
        beam.fillStyle(0xffffff, 0.4);
        beam.fillCircle(config.targetX, config.targetY, 10);

        // Fade beam
        this.scene.tweens.add({
            targets: beam,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                beam?.clear();
                beam?.setAlpha(1);
            }
        });
    }

    private createFallbackShot(config: TurretShotConfig): void {
        const shot = this.scene.add.graphics();
        shot.setDepth(8000);
        shot.lineStyle(3, 0xfff3b0, 1);
        shot.beginPath();
        shot.moveTo(config.startX, config.startY - 40);
        shot.lineTo(config.targetX, config.targetY);
        shot.strokePath();

        this.scene.tweens.add({
            targets: shot,
            alpha: 0,
            duration: 180,
            onComplete: () => shot.destroy()
        });

        this.createImpactEffect(config);
    }

    private getProjectileDuration(effectId: string): number {
        switch (effectId) {
            case 'triarch_machine_gun_nest':
                return 80;
            case 'jade_archer_volley':
            case 'triarch_lightbringer_tower':
                return 150;
            case 'triarch_cannon_blast':
            case 'cannon_shoot':
                return 200;
            case 'abyss_corruption_tower':
            case 'torment_spire':
                return 250;
            case 'triarch_aether_tower':
                return 120;
            default:
                return 180;
        }
    }

    public update(deltaMs: number): void {
        for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
            const proj = this.activeProjectiles[i];
            proj.progress += deltaMs;

            const t = Math.min(1, proj.progress / proj.duration);
            const { startX, startY, targetX, targetY } = proj.config;

            // Lerp position
            const x = startX + (targetX - startX) * t;
            const y = (startY - 40) + ((targetY - startY) + 40) * t;
            proj.container.setPosition(x, y);

            // Rotate toward direction
            const angle = Math.atan2(targetY - startY, targetX - startX);
            proj.container.setRotation(angle);

            // Create trail
            if (proj.progress % 30 < deltaMs) {
                this.createTrailParticle(proj);
            }

            if (t >= 1) {
                this.createImpactEffect(proj.config);
                this.cleanupProjectile(proj);
                this.activeProjectiles.splice(i, 1);
            }
        }
    }

    private createTrailParticle(proj: ActiveProjectile): void {
        if (proj.trail.length > 6) {
            const old = proj.trail.shift();
            old?.destroy();
        }

        const trail = this.scene.add.graphics();
        trail.setDepth(7999);
        const { x, y } = proj.container;

        switch (proj.config.effectId) {
            case 'jade_archer_volley':
                trail.fillStyle(0x88ff66, 0.5);
                trail.fillCircle(x, y, 3);
                break;
            case 'triarch_cannon_blast':
            case 'cannon_shoot':
                trail.fillStyle(0x666666, 0.4);
                trail.fillCircle(x, y, 5);
                trail.fillStyle(0xff6600, 0.3);
                trail.fillCircle(x, y, 3);
                break;
            case 'abyss_corruption_tower':
                trail.setBlendMode(Phaser.BlendModes.ADD);
                trail.fillStyle(0x880088, 0.6);
                trail.fillCircle(x, y, 4);
                break;
            case 'triarch_lightbringer_tower':
                trail.setBlendMode(Phaser.BlendModes.ADD);
                trail.fillStyle(0xffffaa, 0.5);
                trail.fillCircle(x, y, 3);
                break;
            case 'triarch_machine_gun_nest':
                trail.fillStyle(0xffff44, 0.4);
                trail.fillCircle(x, y, 1.5);
                break;
            case 'triarch_aether_tower':
                trail.setBlendMode(Phaser.BlendModes.ADD);
                trail.fillStyle(0x66ccff, 0.5);
                trail.fillCircle(x, y, 3);
                break;
            case 'torment_spire':
                trail.fillStyle(0x88aa44, 0.5);
                trail.fillCircle(x, y, 2);
                trail.fillStyle(0x446622, 0.4);
                trail.fillCircle(x + 2, y + 4, 1.5);
                break;
            default:
                trail.fillStyle(0xfff3b0, 0.3);
                trail.fillCircle(x, y, 2);
        }

        proj.trail.push(trail);

        this.scene.tweens.add({
            targets: trail,
            alpha: 0,
            duration: 200,
            onComplete: () => trail.destroy()
        });
    }

    public createImpactEffect(config: TurretShotConfig): void {
        const impact = this.scene.add.graphics();
        impact.setPosition(config.targetX, config.targetY);
        impact.setDepth(8001);

        switch (config.effectId) {
            case 'jade_archer_volley':
                this.drawJadeImpact(impact, config.isStunShot, config.aoeRadius);
                break;
            case 'triarch_cannon_blast':
                this.drawCannonImpact(impact, config.aoeRadius ?? 100, true);
                break;
            case 'cannon_shoot':
                this.drawCannonImpact(impact, config.aoeRadius ?? 80, false);
                break;
            case 'abyss_corruption_tower':
                this.drawCorruptionImpact(impact);
                break;
            case 'triarch_lightbringer_tower':
                this.drawLightbringerImpact(impact);
                break;
            case 'triarch_machine_gun_nest':
                this.drawMachineGunImpact(impact);
                break;
            case 'triarch_aether_tower':
                this.drawAetherImpact(impact, config.chainTargets);
                break;
            case 'torment_spire':
                this.drawDecayImpact(impact);
                break;
            case 'elf_sun_crystal_spire':
                this.drawSunCrystalImpact(impact);
                break;
            default:
                impact.fillStyle(0xffffcc, 0.8);
                impact.fillCircle(0, 0, 12);
        }

        this.scene.tweens.add({
            targets: impact,
            alpha: 0,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 250,
            onComplete: () => impact.destroy()
        });
    }

    private drawJadeImpact(g: Phaser.GameObjects.Graphics, isStunShot?: boolean, aoeRadius?: number): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        // Piercing flash
        g.fillStyle(0xFFD700, 0.8);
        g.fillCircle(0, 0, 8);
        g.lineStyle(2, 0x88ff66, 0.9);
        g.lineBetween(-12, 0, 12, 0);
        g.lineBetween(0, -12, 0, 12);

        if (isStunShot && aoeRadius) {
            // AoE stun ring
            g.lineStyle(4, 0x00ffaa, 0.8);
            g.strokeCircle(0, 0, aoeRadius);
            g.lineStyle(2, 0xaaffcc, 0.6);
            g.strokeCircle(0, 0, aoeRadius * 0.7);
            // Stun sparks
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const ox = Math.cos(angle) * aoeRadius * 0.8;
                const oy = Math.sin(angle) * aoeRadius * 0.8;
                g.fillStyle(0xffffff, 0.9);
                g.fillCircle(ox, oy, 3);
            }
        }
    }

    private drawCannonImpact(g: Phaser.GameObjects.Graphics, radius: number, hasStagger: boolean): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        // AoE splash ring
        g.fillStyle(0xff6600, 0.5);
        g.fillCircle(0, 0, radius);
        g.fillStyle(0xffaa00, 0.6);
        g.fillCircle(0, 0, radius * 0.6);
        // Bright core
        g.fillStyle(0xffffcc, 0.8);
        g.fillCircle(0, 0, radius * 0.3);
        // Edge ring
        g.lineStyle(3, 0xff8800, 0.9);
        g.strokeCircle(0, 0, radius);

        if (hasStagger) {
            // Shockwave ring
            g.lineStyle(2, 0xffcc66, 0.7);
            g.strokeCircle(0, 0, radius * 1.2);
        }

        // Debris particles
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = radius * (0.5 + Math.random() * 0.5);
            g.fillStyle(0x885522, 0.7);
            g.fillCircle(Math.cos(angle) * dist, Math.sin(angle) * dist, 3);
        }
    }

    private drawCorruptionImpact(g: Phaser.GameObjects.Graphics): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        // Corruption spread
        g.fillStyle(0x660066, 0.6);
        g.fillCircle(0, 0, 20);
        g.fillStyle(0xaa00aa, 0.7);
        g.fillCircle(0, 0, 12);
        // Dark tendrils
        g.lineStyle(2, 0xcc44cc, 0.8);
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.3;
            const len = 15 + Math.random() * 10;
            g.lineBetween(0, 0, Math.cos(angle) * len, Math.sin(angle) * len);
        }
        // Corruption stack indicator
        g.fillStyle(0xff00ff, 0.9);
        g.fillCircle(0, -18, 5);
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(0, -18, 2);
    }

    private drawLightbringerImpact(g: Phaser.GameObjects.Graphics): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        // Radiant burst
        g.fillStyle(0xffffcc, 0.7);
        g.fillCircle(0, 0, 16);
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(0, 0, 8);
        // Cross flare
        g.lineStyle(3, 0xffffaa, 0.9);
        g.lineBetween(-20, 0, 20, 0);
        g.lineBetween(0, -20, 0, 20);
        // Slow aura ring
        g.lineStyle(2, 0x88ccff, 0.6);
        g.strokeCircle(0, 0, 24);
    }

    private drawMachineGunImpact(g: Phaser.GameObjects.Graphics): void {
        // Small spark impact
        g.fillStyle(0xffff66, 0.9);
        g.fillCircle(0, 0, 4);
        // Spark spray
        for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 6 + Math.random() * 6;
            g.fillStyle(0xffffaa, 0.7);
            g.fillCircle(Math.cos(angle) * dist, Math.sin(angle) * dist, 1.5);
        }
        // Suppression indicator (red tint)
        g.fillStyle(0xff4444, 0.3);
        g.fillCircle(0, 0, 10);
    }

    private drawAetherImpact(g: Phaser.GameObjects.Graphics, chainTargets?: Array<{ x: number; y: number }>): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        // Electric burst
        g.fillStyle(0x66ccff, 0.7);
        g.fillCircle(0, 0, 14);
        g.fillStyle(0xaaddff, 0.9);
        g.fillCircle(0, 0, 7);
        // Lightning ring
        g.lineStyle(2, 0x88eeff, 0.8);
        g.strokeCircle(0, 0, 18);

        // Chain lightning arcs (visual only, drawn relative to first target)
        if (chainTargets && chainTargets.length > 1) {
            for (let i = 0; i < chainTargets.length - 1; i++) {
                const from = chainTargets[i];
                const to = chainTargets[i + 1];
                this.createChainLightningArc(from.x, from.y, to.x, to.y);
            }
        }
    }

    public createChainLightningArc(fromX: number, fromY: number, toX: number, toY: number): void {
        const arc = this.scene.add.graphics();
        arc.setDepth(8002);
        arc.setBlendMode(Phaser.BlendModes.ADD);

        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.hypot(dx, dy);
        const segments = Math.max(3, Math.floor(dist / 30));

        arc.lineStyle(3, 0x66ccff, 0.9);
        arc.beginPath();
        arc.moveTo(fromX, fromY);

        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const x = fromX + dx * t + (Math.random() - 0.5) * 20;
            const y = fromY + dy * t + (Math.random() - 0.5) * 20;
            arc.lineTo(x, y);
        }
        arc.lineTo(toX, toY);
        arc.strokePath();

        // Bright core
        arc.lineStyle(1, 0xffffff, 0.8);
        arc.beginPath();
        arc.moveTo(fromX, fromY);
        arc.lineTo(toX, toY);
        arc.strokePath();

        this.scene.tweens.add({
            targets: arc,
            alpha: 0,
            duration: 150,
            onComplete: () => arc.destroy()
        });
    }

    private drawDecayImpact(g: Phaser.GameObjects.Graphics): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        // Decay burst
        g.fillStyle(0x446622, 0.6);
        g.fillCircle(0, 0, 16);
        g.fillStyle(0x88aa44, 0.7);
        g.fillCircle(0, 0, 10);
        // Armor crack effect (lines radiating out)
        g.lineStyle(2, 0xccaa66, 0.8);
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const len = 12 + Math.random() * 8;
            g.lineBetween(4, 0, Math.cos(angle) * len, Math.sin(angle) * len);
        }
        // Broken armor shard
        g.fillStyle(0xaaaaaa, 0.6);
        g.fillTriangle(-8, -6, -4, -10, -2, -4);
    }

    private drawSunCrystalImpact(g: Phaser.GameObjects.Graphics): void {
        g.setBlendMode(Phaser.BlendModes.ADD);
        // Radiant burst
        g.fillStyle(0xffff88, 0.6);
        g.fillCircle(0, 0, 20);
        g.fillStyle(0xffffcc, 0.8);
        g.fillCircle(0, 0, 12);
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(0, 0, 6);
        // Sunray flare
        g.lineStyle(2, 0xffdd44, 0.8);
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            g.lineBetween(8, 0, Math.cos(angle) * 24, Math.sin(angle) * 24);
        }
    }

    public createVineThornEffect(x: number, y: number): void {
        const thorn = this.scene.add.graphics();
        thorn.setDepth(8000);
        thorn.setPosition(x, y);

        // Green thorn spikes
        thorn.fillStyle(0x228822, 0.9);
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 10 + Math.random() * 15;
            const size = 3 + Math.random() * 3;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist;
            thorn.fillTriangle(
                tx, ty - size,
                tx - size * 0.5, ty + size * 0.5,
                tx + size * 0.5, ty + size * 0.5
            );
        }

        // Blood splatter
        thorn.fillStyle(0xcc2222, 0.7);
        for (let i = 0; i < 4; i++) {
            const ox = (Math.random() - 0.5) * 20;
            const oy = (Math.random() - 0.5) * 20;
            thorn.fillCircle(ox, oy, 2 + Math.random() * 2);
        }

        this.scene.tweens.add({
            targets: thorn,
            alpha: 0,
            y: y - 10,
            duration: 400,
            onComplete: () => thorn.destroy()
        });
    }

    public createAoEIndicator(x: number, y: number, radius: number, color: number): void {
        const indicator = this.scene.add.graphics();
        indicator.setDepth(7800);
        indicator.setPosition(x, y);
        indicator.lineStyle(2, color, 0.6);
        indicator.strokeCircle(0, 0, radius);
        indicator.fillStyle(color, 0.15);
        indicator.fillCircle(0, 0, radius);

        this.scene.tweens.add({
            targets: indicator,
            alpha: 0,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 300,
            onComplete: () => indicator.destroy()
        });
    }

    private cleanupProjectile(proj: ActiveProjectile): void {
        proj.container.destroy();
        proj.trail.forEach(t => t.destroy());
    }

    public destroy(): void {
        this.activeProjectiles.forEach(p => this.cleanupProjectile(p));
        this.activeProjectiles = [];
        this.activeBeams.forEach(b => b.destroy());
        this.activeBeams.clear();
    }
}
