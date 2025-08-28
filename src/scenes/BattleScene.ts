import Phaser from 'phaser';
import { IsometricRenderer } from '../systems/IsometricRenderer';
import { PhysicsManager } from '../systems/PhysicsManager';
import { UnitManager } from '../systems/UnitManager';
import { CombatSystem } from '../systems/CombatSystem';
import { DeploymentSystem } from '../systems/DeploymentSystem';
import { UnitFactory, UnitType } from '../data/UnitTypes';
import { LevelUpSystem } from '../systems/LevelUpSystem';
import { SkillManager } from '../data/Skills';
import { ProjectileSystem } from '../systems/ProjectileSystem';

export class BattleScene extends Phaser.Scene {
    private isometricRenderer!: IsometricRenderer;
    private physicsManager!: PhysicsManager;
    private unitManager!: UnitManager;
    private combatSystem!: CombatSystem;
    private deploymentSystem!: DeploymentSystem;
    private levelUpSystem!: LevelUpSystem;
    private skillManager!: SkillManager;
    private projectileSystem!: ProjectileSystem;
    
    // Victory system
    private battleEnded: boolean = false;
    private battlefield = { centerX: 960, centerY: 540, width: 1720, height: 880 };
    private victoryOverlay!: Phaser.GameObjects.Graphics;
    private victoryText!: Phaser.GameObjects.Text;
    
    constructor() {
        super({ key: 'BattleScene' });
    }

    create() {
        this.setupSystems();
        // Ensure SkillSelectionScene is running so its display list exists
        if (!this.scene.isActive('SkillSelectionScene')) {
            this.scene.launch('SkillSelectionScene');
        }
        // World background
        const bg = this.add.image(960, 540, 'world_bg');
        bg.setDepth(-10000);
        bg.setDisplaySize(1920, 1080);
        this.setupCamera();
        this.createTestEnvironment();
        this.setupDeploymentZones();
        this.setupTestUnits();
        this.setupEventListeners();
    }

    private setupSystems() {
        this.isometricRenderer = new IsometricRenderer(this);
        this.physicsManager = new PhysicsManager(this);
        this.unitManager = new UnitManager(this, this.physicsManager);
        this.combatSystem = new CombatSystem(this, this.unitManager);
        this.deploymentSystem = new DeploymentSystem(this.unitManager);
        this.levelUpSystem = new LevelUpSystem(this, this.unitManager);
        this.skillManager = new SkillManager();
        this.projectileSystem = new ProjectileSystem(this);

        // Create physical walls matching the green frame battlefield (100,100, 1720x880)
        // Add a small inward padding so unit centers never cross the visible line
        this.physicsManager.setBattlefieldBounds(100, 100, 1720, 880, 5, 5);
    }

    private setupCamera() {
        const camera = this.cameras.main;
        
        // Lock camera to the battlefield rectangle, not the entire world
        const left = this.battlefield.centerX - this.battlefield.width / 2;
        const top = this.battlefield.centerY - this.battlefield.height / 2;
        
        camera.setZoom(1);
        camera.setBounds(left, top, this.battlefield.width, this.battlefield.height);
        camera.centerOn(this.battlefield.centerX, this.battlefield.centerY);
        camera.roundPixels = true;
        
        // Fixed battlefield view (no dragging), allow limited zoom without showing empty space
        this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
            const zoom = camera.zoom;
            // Prevent zooming out below 1 to avoid exposing empty space around the battlefield
            camera.zoom = Phaser.Math.Clamp(zoom - deltaY * 0.001, 1, 1.2);
        });
    }

    private createTestEnvironment() {
        // Create grid for 1920x1080 battlefield at 1:1 zoom
        const gridSize = 40;
        const tileWidth = 32;
        const tileHeight = 16;
        
        // Create isometric battlefield grid
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                const isoX = (x - y) * (tileWidth / 2);
                const isoY = (x + y) * (tileHeight / 2);
                
                const graphics = this.add.graphics();
                graphics.lineStyle(1, 0x444444, 0.15); // Very transparent grid
                graphics.strokeRect(isoX + 960 - tileWidth/2, isoY + 540 - tileHeight/2, tileWidth, tileHeight);
            }
        }
        
        // Add battlefield boundary (visible edges of play area)
        const boundaryGraphics = this.add.graphics();
        boundaryGraphics.lineStyle(3, 0x00ff00, 0.5);
        const left = this.battlefield.centerX - this.battlefield.width / 2;
        const top = this.battlefield.centerY - this.battlefield.height / 2;
        boundaryGraphics.strokeRect(left, top, this.battlefield.width, this.battlefield.height);
        
        // Add environmental objects (trees and bushes)
        this.createEnvironmentalObjects();
    }

    private setupDeploymentZones() {
        // Position deployment zones within centered battlefield
        const left = this.battlefield.centerX - this.battlefield.width / 2;
        const zoneWidth = 350;
        const zoneHeight = 400;
        const sideOffset = 250; // distance from border to zone center
        const zone1CenterX = left + sideOffset;
        const zone2CenterX = left + this.battlefield.width - sideOffset;
        const zoneCenterY = this.battlefield.centerY;
        this.deploymentSystem.createDeploymentZone(1, zone1CenterX, zoneCenterY, zoneWidth, zoneHeight);
        this.deploymentSystem.createDeploymentZone(2, zone2CenterX, zoneCenterY, zoneWidth, zoneHeight);
        
        this.visualizeDeploymentZones();
    }

    private visualizeDeploymentZones() {
        const zone1 = this.deploymentSystem.getDeploymentZone(1);
        const zone2 = this.deploymentSystem.getDeploymentZone(2);
        
        const drawThreeColumns = (zone: any, team: number) => {
            const x0 = zone.centerX - zone.width/2;
            const y0 = zone.centerY - zone.height/2;
            // Match columns used in DeploymentSystem: 3/2/1 distribution
            const totalCols = 6;
            const frontCols = 3, middleCols = 2, backCols = 1;
            const colW = zone.width / totalCols;
            // rows increased in DeploymentSystem for capacity; we don't slice horizontally here
            const colors = {
                front: 0xffcc33,   // amber
                middle: 0x66ccff,  // cyan
                back: 0xcc99ff     // purple
            };
            // Determine visual spans per section
            const sections = team === 1
                ? [ { key: 'back', span: backCols }, { key: 'middle', span: middleCols }, { key: 'front', span: frontCols } ]
                : [ { key: 'front', span: frontCols }, { key: 'middle', span: middleCols }, { key: 'back', span: backCols } ];
            let cursor = 0;
            sections.forEach(sec => {
                const g = this.add.graphics();
                const color = (colors as any)[sec.key];
                g.lineStyle(2, color, 0.6);
                g.fillStyle(color, 0.15);
                // For back column, give a slightly darker fill to emphasize area but height remains full; vertical capacity increased via rows
                g.fillRect(x0 + cursor * colW, y0, sec.span * colW, zone.height);
                g.strokeRect(x0 + cursor * colW, y0, sec.span * colW, zone.height);
                // Label
                const label = this.add.text(x0 + (cursor + sec.span/2) * colW, y0 - 12, sec.key.toUpperCase(), {
                    fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 2
                }).setOrigin(0.5, 1);
                label.setAlpha(0.7);
                cursor += sec.span;
            });
            // Outline whole zone lightly
            const outline = this.add.graphics();
            outline.lineStyle(2, team === 1 ? 0x4444ff : 0xff4444, 0.3);
            outline.strokeRect(x0, y0, zone.width, zone.height);
        };

        if (zone1) drawThreeColumns(zone1, 1);
        if (zone2) drawThreeColumns(zone2, 2);
    }

    private setupTestUnits() {
        const team1Units = [] as any[];
        const team2Units = [] as any[];
        
        const counts: Array<{ type: UnitType; count: number }> = [
            { type: UnitType.WARRIOR, count: 10 },
            { type: UnitType.NINJA, count: 6 },
            { type: UnitType.SNIPER, count: 6 },
            { type: UnitType.DARK_MAGE, count: 4 },
            { type: UnitType.SHOTGUNNER, count: 4 },
            { type: UnitType.CHRONOTEMPORAL, count: 4 }
        ];
        
        counts.forEach(({ type, count }) => {
            for (let i = 0; i < count; i++) {
                team1Units.push(UnitFactory.createUnit(type, 1, 0, 0, 1));
                team2Units.push(UnitFactory.createUnit(type, 2, 0, 0, 1));
            }
        });
        
        console.log(`Created ${team1Units.length} units for Team 1 and ${team2Units.length} units for Team 2`);
        
        team1Units.forEach(unit => this.deploymentSystem.queueUnit(1, unit));
        team2Units.forEach(unit => this.deploymentSystem.queueUnit(2, unit));
    }

    private createEnvironmentalObjects() {
        // Create trees and bushes within 1920x1080 battlefield
        // Avoid placement in deployment zones and center combat area
        
        const numTrees = 25;
        const numBushes = 35;
        
        // Define exclusion zones (deployment areas and central combat zone)
        const exclusionZones = [
            { x: 175, y: 340, width: 350, height: 400 },  // Zone 1 area
            { x: 1395, y: 340, width: 350, height: 400 }, // Zone 2 area
            { x: 760, y: 440, width: 400, height: 200 }   // Central combat area
        ];
        
        // Create trees within battlefield bounds
        for (let i = 0; i < numTrees; i++) {
            let x, y;
            let attempts = 0;
            
            // Find valid position within battlefield bounds
            do {
                x = Phaser.Math.Between(150, 1770);
                y = Phaser.Math.Between(150, 930);
                attempts++;
            } while (attempts < 50 && this.isInExclusionZone(x, y, exclusionZones));
            
            if (attempts < 50) {
                this.createTree(x, y);
            }
        }
        
        // Create bushes within battlefield bounds
        for (let i = 0; i < numBushes; i++) {
            let x, y;
            let attempts = 0;
            
            // Find valid position within battlefield bounds
            do {
                x = Phaser.Math.Between(150, 1770);
                y = Phaser.Math.Between(150, 930);
                attempts++;
            } while (attempts < 50 && this.isInExclusionZone(x, y, exclusionZones));
            
            if (attempts < 50) {
                this.createBush(x, y);
            }
        }
    }
    
    private isInExclusionZone(x: number, y: number, zones: Array<{x: number, y: number, width: number, height: number}>): boolean {
        return zones.some(zone => 
            x >= zone.x && x <= zone.x + zone.width &&
            y >= zone.y && y <= zone.y + zone.height
        );
    }
    
    private createTree(x: number, y: number) {
        // Create tree using graphics
        const tree = this.add.graphics();
        
        // Tree trunk
        tree.fillStyle(0x8B4513, 1); // Brown
        tree.fillRect(x - 4, y - 8, 8, 16);
        
        // Tree canopy (multiple green circles for natural look)
        tree.fillStyle(0x228B22, 0.8); // Forest green
        tree.fillCircle(x, y - 20, 16);
        tree.fillStyle(0x32CD32, 0.7); // Lime green
        tree.fillCircle(x - 8, y - 15, 12);
        tree.fillCircle(x + 8, y - 15, 12);
        tree.fillStyle(0x006400, 0.6); // Dark green
        tree.fillCircle(x, y - 10, 10);
        
        // Add to isometric renderer for proper depth sorting
        this.isometricRenderer.addToRenderGroup(tree);
    }
    
    private createBush(x: number, y: number) {
        // Create bush using graphics
        const bush = this.add.graphics();
        
        // Bush body (multiple overlapping circles)
        bush.fillStyle(0x228B22, 0.7); // Forest green
        bush.fillCircle(x, y, 8);
        bush.fillStyle(0x32CD32, 0.6); // Lime green
        bush.fillCircle(x - 6, y + 2, 6);
        bush.fillCircle(x + 6, y + 2, 6);
        bush.fillStyle(0x006400, 0.5); // Dark green
        bush.fillCircle(x, y + 4, 5);
        
        // Add to isometric renderer for proper depth sorting
        this.isometricRenderer.addToRenderGroup(bush);
    }

    private setupEventListeners() {
        const uiScene = this.scene.get('UIScene');
        
        uiScene.events.on('deploy-units', () => {
            this.deploymentSystem.deployUnits(1);
            this.deploymentSystem.deployUnits(2);
            
            this.time.delayedCall(1000, () => {
                this.startBattle();
            });
        });
        
        this.events.on('damage-dealt', (event: any) => {
            console.log(`Damage dealt: ${event.damage} (${event.armorFacing})`);
        });

        // Handle Dark Mage projectile explosion AoE damage
        this.events.on('dark-mage-explosion', (payload: { x: number; y: number; radius: number; damage: number; attackerTeam?: number }) => {
            const { x, y, radius, damage, attackerTeam } = payload;
            const units = this.unitManager.getAllUnits();
            units.forEach(unit => {
                if (unit.isDead()) return;
                const pos = unit.getPosition();
                const dist = Phaser.Math.Distance.Between(x, y, pos.x, pos.y);
                if (dist <= radius) {
                    // Apply damage only to opposing teams if attackerTeam provided
                    if (attackerTeam && unit.getTeam() === attackerTeam) return;
                    this.combatSystem.dealDamage(unit, unit, damage);
                }
            });
        });
        
        // Unit death -> spawn XP orb  
        this.events.on('unit-death', (unit: any) => {
            const xpValue = Math.floor(5 + unit.getMaxHealth() / 20);
            this.levelUpSystem.spawnXPOrb(
                unit.getPosition().x,
                unit.getPosition().y,
                xpValue
            );
        });
        
        // Level up -> show skill selection
        this.events.on('level-up', (data: any) => {
            const choices = this.skillManager.generateSkillChoices(data.newLevel);
            const skillScene = this.scene.get('SkillSelectionScene') as any;
            // Make sure the selection UI is above everything
            if (this.scene.isActive('SkillSelectionScene')) {
                this.scene.bringToTop('SkillSelectionScene');
            }
            skillScene.showSkillSelection(choices, data.newLevel);
        });
        
        // Skill selection handling
        const skillScene = this.scene.get('SkillSelectionScene');
        skillScene.events.on('skill-selected', (skill: any) => {
            this.skillManager.selectSkill(skill);
            this.levelUpSystem.onSkillSelected(skill);
            this.applySkillEffects();
        });
    }

    private startBattle() {
        console.log('Battle started! Units:', this.unitManager.getUnitCount());
        
        // Create a repeating timer for unit AI
        this.time.addEvent({
            delay: 100,
            callback: () => this.updateUnitAI(),
            loop: true
        });
    }
    
    private updateUnitAI() {
        const units = this.unitManager.getAllUnits();
        
        units.forEach(unit => {
            if (unit.isDead()) return;
            
            const currentPos = unit.getPosition();
            
            // Battlefield bounds (based on centered battlefield)
            const bfLeft = this.battlefield.centerX - this.battlefield.width / 2;
            const bfTop = this.battlefield.centerY - this.battlefield.height / 2;
            const bounds = {
                minX: bfLeft + 5,
                maxX: bfLeft + this.battlefield.width - 5,
                minY: bfTop + 5,
                maxY: bfTop + this.battlefield.height - 5
            };
            
            // If unit is outside bounds, push it back towards center
            if (currentPos.x < bounds.minX || currentPos.x > bounds.maxX || 
                currentPos.y < bounds.minY || currentPos.y > bounds.maxY) {
                // Teleport back to nearest edge point and zero velocity
                const clampedX = Phaser.Math.Clamp(currentPos.x, bounds.minX, bounds.maxX);
                const clampedY = Phaser.Math.Clamp(currentPos.y, bounds.minY, bounds.maxY);
                (unit as any).teleportTo(clampedX, clampedY);
                return; // Skip AI this tick
            }
            
            const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
            if (enemies.length === 0) return;
            
            // Find closest enemy
            let closestEnemy: any = null;
            let closestDistance = Infinity;
            
            enemies.forEach(enemy => {
                if (!enemy.isDead()) {
                    const distance = Phaser.Math.Distance.Between(
                        unit.getPosition().x, unit.getPosition().y,
                        enemy.getPosition().x, enemy.getPosition().y
                    );
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestEnemy = enemy;
                    }
                }
            });
            
            if (closestEnemy) {
                const targetPos = closestEnemy.getPosition();
                const dxToTarget = targetPos.x - currentPos.x;
                const dyToTarget = targetPos.y - currentPos.y;
                const distanceToTarget = Math.sqrt(dxToTarget * dxToTarget + dyToTarget * dyToTarget);
                
                // Ranged units stop advancing once in range
                const unitConfig = unit.getConfig();
                if (this.isRangedUnit(unitConfig.unitType) && distanceToTarget <= unit.getRange()) {
                    return; // hold position and let combat system handle firing
                }

                // Ninja jump: quick gap close if within medium range and off cooldown
                if (unitConfig.unitType === UnitType.NINJA) {
                    const jumped = (unit as any).attemptNinjaJump(targetPos, this.time.now);
                    if (jumped) {
                        return; // let the jump carry for this tick
                    }
                }
                
                let direction = {
                    x: dxToTarget,
                    y: dyToTarget
                };
                
                // Check if moving towards target would take unit out of bounds
                const nextX = currentPos.x + direction.x * 0.1; // Small step to test
                const nextY = currentPos.y + direction.y * 0.1;
                
                if (nextX < bounds.minX || nextX > bounds.maxX || 
                    nextY < bounds.minY || nextY > bounds.maxY) {
                    
                    // Adjust direction to stay within bounds
                    if (nextX < bounds.minX) direction.x = Math.max(0, direction.x);
                    if (nextX > bounds.maxX) direction.x = Math.min(0, direction.x);
                    if (nextY < bounds.minY) direction.y = Math.max(0, direction.y);
                    if (nextY > bounds.maxY) direction.y = Math.min(0, direction.y);
                }
                
                const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
                if (magnitude > 0) {
                    direction.x /= magnitude;
                    direction.y /= magnitude;
                    unit.move(direction);
                }
            }
        });
    }

    update(_time: number, delta: number) {
        const deltaSeconds = delta / 1000;
        
        this.physicsManager.update(deltaSeconds);
        this.unitManager.update(deltaSeconds);
        this.combatSystem.update(deltaSeconds);
        this.projectileSystem.update(deltaSeconds);
        this.isometricRenderer.update();
        this.levelUpSystem.update();
        
        this.checkCombat();
        this.checkVictoryCondition();
    }

    private checkCombat() {
        const currentTime = this.time.now;
        const units = this.unitManager.getAllUnits();
        
        units.forEach(unit => {
            if (unit.isDead()) return;
            // Chronotemporal heal pulses should not depend on attack cooldown
            if (unit.getConfig().unitType === UnitType.CHRONOTEMPORAL) {
                this.pulseChronoHeal(unit as any, currentTime);
            }
            if (!unit.canAttack(currentTime)) return;
            
            const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
            // allies variable removed (no direct use here)
            
            // Find enemies in range
            let targetEnemy = null;
            let closestDistance = unit.getRange();
            
            enemies.forEach(enemy => {
                if (enemy.isDead()) return;
                
                const distance = Phaser.Math.Distance.Between(
                    unit.getPosition().x, unit.getPosition().y,
                    enemy.getPosition().x, enemy.getPosition().y
                );
                
                if (distance <= unit.getRange() && distance < closestDistance) {
                    closestDistance = distance;
                    targetEnemy = enemy;
                }
            });
            
            if (targetEnemy) {
                const unitConfig = unit.getConfig();
                
                // Check if this is a ranged unit that should fire projectiles
                if (this.isRangedUnit(unitConfig.unitType)) {
                    this.createProjectileAttack(unit, targetEnemy, unitConfig.unitType);
                } else if (this.isMeleeUnit(unitConfig.unitType)) {
                    // Melee attack with swing animation and sector damage
                    unit.performMeleeAttack(targetEnemy, currentTime, this.unitManager as any, this.combatSystem as any);
                }
                
                unit.setLastAttackTime(currentTime);
            }
        });
    }

    private pulseChronoHeal(unit: any, currentTime: number): void {
        // Trigger roughly every 2s
        if (currentTime % 2000 >= 60) return;
        const center = unit.getPosition();
        const healRadius = 220;
        const healAmount = 8;
        const allies = this.unitManager.getUnitsByTeam(unit.getTeam());
        allies.forEach(a => {
            if (a.isDead()) return;
            const p = a.getPosition();
            const d = Phaser.Math.Distance.Between(center.x, center.y, p.x, p.y);
            if (d <= healRadius) {
                (a as any).heal(healAmount);
                // Green cross effect above healed ally
                const cross = this.add.graphics();
                cross.setDepth(5001);
                cross.setBlendMode(Phaser.BlendModes.ADD);
                const cx = p.x;
                const cy = p.y - 30;
                cross.setPosition(cx, cy);
                cross.fillStyle(0x00ff66, 1);
                // Draw relative to (0,0) so tweening y actually moves it
                cross.fillRect(-3, -10, 6, 20);
                cross.fillRect(-10, -3, 20, 6);
                this.tweens.add({ targets: cross, alpha: 0, y: cy - 16, duration: 400, onComplete: () => cross.destroy() });
            }
        });
        // Healing circle visuals
        const g = this.add.graphics();
        g.setDepth(4000);
        g.setBlendMode(Phaser.BlendModes.ADD);
        g.setPosition(center.x, center.y);
        g.fillStyle(0x00ffcc, 0.06);
        g.fillCircle(0, 0, healRadius);
        g.lineStyle(2, 0x00ffcc, 0.5);
        g.strokeCircle(0, 0, healRadius);
        const ring = this.add.graphics();
        ring.setDepth(4001);
        ring.setBlendMode(Phaser.BlendModes.ADD);
        ring.setPosition(center.x, center.y);
        ring.lineStyle(2, 0x66ffe6, 0.6);
        ring.strokeCircle(0, 0, healRadius * 0.7);
        // Scale around its own position instead of world origin by keeping drawing at (0,0)
        ring.setScale(1);
        this.tweens.add({ targets: ring, alpha: 0, scaleX: 1.35, scaleY: 1.35, duration: 320, onComplete: () => ring.destroy() });
        this.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() });
    }
    
    private applySkillEffects(): void {
        const activeSkills = this.skillManager.getActiveSkills();
        const units = this.unitManager.getAllUnits();
        
        // Apply skill effects to all units
        units.forEach(unit => {
            activeSkills.forEach(skill => {
                skill.effects.forEach(effect => {
                    const value = effect.baseValue + (effect.perRank * (skill.currentRank - 1));
                    this.applyEffectToUnit(unit, effect.stat, value, effect.isMultiplier);
                });
            });
        });
    }
    
    private applyEffectToUnit(unit: any, stat: string, value: number, isMultiplier: boolean): void {
        // This would apply the effect to the unit based on the stat type
        // For now, just log it
        console.log(`Applied ${stat}: ${value}${isMultiplier ? '%' : ''} to unit ${unit.getId()}`);
    }
    
    private isRangedUnit(unitType: UnitType): boolean {
        return unitType === UnitType.SNIPER || 
               unitType === UnitType.DARK_MAGE || 
               unitType === UnitType.CHRONOTEMPORAL;
    }
    
    private isMeleeUnit(unitType: UnitType): boolean {
        return unitType === UnitType.WARRIOR || 
               unitType === UnitType.NINJA || 
               unitType === UnitType.SHOTGUNNER;
    }
    
    private createProjectileAttack(attackerUnit: any, targetUnit: any, unitType: UnitType): void {
        const attackerPos = attackerUnit.getPosition();
        const targetPos = targetUnit.getPosition();
        
        // Calculate projectile speed based on unit type
        let speed = 300; // Default speed
        switch (unitType) {
            case UnitType.SNIPER:
                speed = 600; // Fast bullet
                break;
            case UnitType.SHOTGUNNER:
                speed = 450; // Slightly faster pellets
                break;
            case UnitType.DARK_MAGE:
                speed = 200; // Slow magic orb
                break;
            case UnitType.CHRONOTEMPORAL:
                speed = 250; // Medium magic
                break;
        }
        
        // For shotgunner, draw a 90° cone toward nearest enemy for feedback
        if (unitType === UnitType.SHOTGUNNER) {
            const start = attackerPos;
            const target = targetPos;
            const angle = Phaser.Math.Angle.Between(start.x, start.y, target.x, target.y);
            const arc = Phaser.Math.DegToRad(90);
            const radius = 140;
            const uiScene = this.scene.get('UIScene');
            const sector = uiScene ? (uiScene as any).add.graphics() : this.add.graphics();
            sector.setBlendMode(Phaser.BlendModes.ADD);
            sector.setDepth(4500);
            sector.setPosition(start.x, start.y);
            sector.fillStyle(0xffaa33, 0.35);
            sector.beginPath();
            sector.moveTo(0, 0);
            sector.arc(0, 0, radius, angle - arc/2, angle + arc/2, false);
            sector.closePath();
            sector.fillPath();
            const tw = uiScene ? (uiScene as any).tweens : this.tweens;
            tw.add({ targets: sector, alpha: 0, duration: 250, onComplete: () => sector.destroy() });
        }

        this.projectileSystem.createProjectile({
            startX: attackerPos.x,
            startY: attackerPos.y,
            targetX: targetPos.x,
            targetY: targetPos.y,
            unitType: unitType,
            damage: attackerUnit.getDamage(),
            speed: speed,
            attackerTeam: attackerUnit.getTeam()
        });
        
        // Schedule damage to be dealt when projectile hits
        const distance = Phaser.Math.Distance.Between(
            attackerPos.x, attackerPos.y,
            targetPos.x, targetPos.y
        );
        const travelTime = (distance / speed) * 1000; // Convert to milliseconds
        
        this.time.delayedCall(travelTime, () => {
            if (!targetUnit.isDead()) {
                this.combatSystem.dealDamage(attackerUnit, targetUnit, attackerUnit.getDamage());
            }
        });
    }
    
    private checkVictoryCondition(): void {
        if (this.battleEnded) return;
        
        const team1Units = this.unitManager.getUnitsByTeam(1).filter(unit => !unit.isDead());
        const team2Units = this.unitManager.getUnitsByTeam(2).filter(unit => !unit.isDead());
        
        if (team1Units.length === 0 && team2Units.length > 0) {
            this.endBattle(2); // Red team wins
        } else if (team2Units.length === 0 && team1Units.length > 0) {
            this.endBattle(1); // Blue team wins
        }
    }
    
    private endBattle(winningTeam: number): void {
        this.battleEnded = true;
        
        // Stop unit AI
        this.time.removeAllEvents();
        
        // Create victory UI after a short delay
        this.time.delayedCall(1000, () => {
            this.showVictoryScreen(winningTeam);
        });
    }
    
    private showVictoryScreen(winningTeam: number): void {
        const centerX = 960;
        const centerY = 540;
        
        // Create semi-transparent overlay
        this.victoryOverlay = this.add.graphics();
        this.victoryOverlay.fillStyle(0x000000, 0.7);
        this.victoryOverlay.fillRect(0, 0, 1920, 1080);
        this.victoryOverlay.setDepth(1000); // Ensure it's on top
        
        // Determine victory message and color
        const isBlueWin = winningTeam === 1;
        const victoryMessage = isBlueWin ? "Blue Team Wins!" : "Red Team Wins!";
        const textColor = isBlueWin ? '#4444ff' : '#ff4444';
        
        // Create victory text
        this.victoryText = this.add.text(centerX, centerY - 50, victoryMessage, {
            fontSize: '72px',
            color: textColor,
            fontStyle: 'bold',
            stroke: '#ffffff',
            strokeThickness: 4,
            shadow: {
                offsetX: 3,
                offsetY: 3,
                color: '#000000',
                blur: 5,
                fill: true
            }
        });
        this.victoryText.setOrigin(0.5, 0.5);
        this.victoryText.setDepth(1001);
        
        // Add subtitle text
        const subtitleText = this.add.text(centerX, centerY + 30, "Battle Complete", {
            fontSize: '36px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        });
        subtitleText.setOrigin(0.5, 0.5);
        subtitleText.setDepth(1001);
        
        // Add animated effects
        this.tweens.add({
            targets: this.victoryText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Power2'
        });
        
        // Add restart instruction
        const restartText = this.add.text(centerX, centerY + 100, "Press R to restart battle", {
            fontSize: '24px',
            color: '#cccccc',
            fontStyle: 'italic'
        });
        restartText.setOrigin(0.5, 0.5);
        restartText.setDepth(1001);
        
        // Add keyboard input for restart
        this.input.keyboard?.on('keydown-R', () => {
            this.scene.restart();
        });
    }
}