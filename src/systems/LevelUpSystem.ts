import Phaser from 'phaser';
import { Skill } from '../data/Skills';
import type { UnitManager } from './UnitManager';

export interface XPOrb {
    id: string;
    x: number;
    y: number;
    value: number;
    sprite: Phaser.GameObjects.Sprite;
    magnet: boolean;
    collectorTeam: number;
}

export class LevelUpSystem {
    private scene: Phaser.Scene;
    private unitManager?: UnitManager;
    private currentXP: number = 0;
    private currentLevel: number = 1;
    private xpOrbs: Map<string, XPOrb> = new Map();
    private orbIdCounter: number = 0;
    
    // XP requirements for each level (exponential growth)
    private xpRequirements: number[] = [
        0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250,
        3850, 4500, 5200, 5950, 6750, 7600, 8500, 9450, 10450, 11500
    ];
    
    private magnetRange: number = 80;
    private magnetSpeed: number = 300;
    
    constructor(scene: Phaser.Scene, unitManager?: UnitManager) {
        this.scene = scene;
        this.unitManager = unitManager;
    }
    
    public spawnXPOrb(x: number, y: number, value: number = 5, collectorTeam: number = 1): void {
        const orbId = `xp_orb_${this.orbIdCounter++}`;
        
        // Create visual representation
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(0x00ffff, 1);
        graphics.fillCircle(0, 0, 3);
        graphics.generateTexture(`xp_orb_${orbId}`, 6, 6);
        graphics.destroy();
        
        const sprite = this.scene.add.sprite(x, y, `xp_orb_${orbId}`);
        sprite.setScale(1 + value * 0.1); // Larger orbs for more XP
        
        // Add glowing effect
        sprite.postFX.addGlow(0x00ffff, 2);
        
        const orb: XPOrb = {
            id: orbId,
            x,
            y,
            value,
            sprite,
            magnet: false,
            collectorTeam
        };
        
        this.xpOrbs.set(orbId, orb);
        
        // Auto-collect after 30 seconds
        this.scene.time.delayedCall(30000, () => {
            this.collectOrb(orbId);
        });
    }
    
    public update(playerPosition?: { x: number; y: number }): void {
        
        this.xpOrbs.forEach(orb => {
            // Determine target position for this orb
            let target = playerPosition;
            if (!target && this.unitManager) {
                const candidates = this.unitManager.getUnitsByTeam(orb.collectorTeam).filter(u => !u.isDead());
                if (candidates.length > 0) {
                    // choose nearest unit
                    let best = candidates[0];
                    let bestDist = Phaser.Math.Distance.Between(orb.x, orb.y, best.getPosition().x, best.getPosition().y);
                    for (let i = 1; i < candidates.length; i++) {
                        const p = candidates[i].getPosition();
                        const d = Phaser.Math.Distance.Between(orb.x, orb.y, p.x, p.y);
                        if (d < bestDist) { best = candidates[i]; bestDist = d; }
                    }
                    target = best.getPosition();
                }
            }
            if (!target) {
                const camera = this.scene.cameras.main;
                target = { x: camera.scrollX + camera.width / 2, y: camera.scrollY + camera.height / 2 };
            }
            const distance = Phaser.Math.Distance.Between(
                orb.x, orb.y,
                target!.x, target!.y
            );
            
            // Start magnet effect when close enough
            if (distance < this.magnetRange && !orb.magnet) {
                orb.magnet = true;
            }
            
            if (orb.magnet) {
                // Move orb toward player
                const angle = Phaser.Math.Angle.Between(orb.x, orb.y, target!.x, target!.y);
                
                const speed = this.magnetSpeed * (1 / Math.max(1, distance * 0.01));
                orb.x += Math.cos(angle) * speed * (1/60); // 60 FPS assumption
                orb.y += Math.sin(angle) * speed * (1/60);
                
                orb.sprite.x = orb.x;
                orb.sprite.y = orb.y;
                
                // Collect when very close
                if (distance < 20) {
                    this.collectOrb(orb.id);
                }
            }
        });
    }
    
    private collectOrb(orbId: string): void {
        const orb = this.xpOrbs.get(orbId);
        if (!orb) return;
        
        // Add XP
        this.gainXP(orb.value);
        
        // Visual effect
        this.scene.tweens.add({
            targets: orb.sprite,
            scale: 2,
            alpha: 0,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                orb.sprite.destroy();
            }
        });
        
        this.xpOrbs.delete(orbId);
    }
    
    private gainXP(amount: number): void {
        this.currentXP += amount;
        
        // Check for level up
        const requiredXP = this.getXPRequiredForLevel(this.currentLevel + 1);
        if (requiredXP > 0 && this.currentXP >= requiredXP) {
            this.levelUp();
        }
        
        // Emit XP gain event
        this.scene.events.emit('xp-gained', {
            amount,
            currentXP: this.currentXP,
            currentLevel: this.currentLevel
        });
    }
    
    private levelUp(): void {
        this.currentLevel++;
        
        // Pause game and show skill selection
        this.scene.scene.pause();
        this.showSkillSelection();
        
        // Visual/audio feedback
        this.scene.events.emit('level-up', {
            newLevel: this.currentLevel,
            currentXP: this.currentXP
        });
    }
    
    private showSkillSelection(): void {
        // This will trigger the skill selection UI
        const uiScene = this.scene.scene.get('UIScene');
        if (uiScene) {
            uiScene.events.emit('show-skill-selection', {
                level: this.currentLevel
            });
        }
    }
    
    public onSkillSelected(skill: Skill): void {
        // Apply skill effect (will be implemented with skills)
        console.log(`Skill selected: ${skill.name} (Rank ${skill.currentRank})`);
        
        // Resume game
        this.scene.scene.resume();
        
        this.scene.events.emit('skill-selected', skill);
    }
    
    public getXPRequiredForLevel(level: number): number {
        if (level <= 0 || level >= this.xpRequirements.length) return -1;
        return this.xpRequirements[level - 1];
    }
    
    public getXPProgressToNextLevel(): { current: number; required: number; percentage: number } {
        const currentLevelXP = this.getXPRequiredForLevel(this.currentLevel);
        const nextLevelXP = this.getXPRequiredForLevel(this.currentLevel + 1);
        
        if (nextLevelXP === -1) {
            return { current: 0, required: 1, percentage: 100 };
        }
        
        const progress = this.currentXP - currentLevelXP;
        const required = nextLevelXP - currentLevelXP;
        const percentage = Math.min(100, (progress / required) * 100);
        
        return { current: progress, required, percentage };
    }
    
    // Public getters
    public getCurrentLevel(): number { return this.currentLevel; }
    public getCurrentXP(): number { return this.currentXP; }
    public getOrbCount(): number { return this.xpOrbs.size; }
}