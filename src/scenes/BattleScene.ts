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
    private victoryOverlay!: Phaser.GameObjects.Graphics;
    private victoryText!: Phaser.GameObjects.Text;
    
    constructor() {
        super({ key: 'BattleScene' });
    }

    create() {
        this.setupSystems();
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
        this.levelUpSystem = new LevelUpSystem(this);
        this.skillManager = new SkillManager();
        this.projectileSystem = new ProjectileSystem(this);
    }

    private setupCamera() {
        const camera = this.cameras.main;
        
        // Set camera to show exactly 1920x1080 battlefield at 1:1 scale
        camera.setZoom(1.0);
        
        // Center camera on the battlefield center and lock it
        camera.centerOn(960, 540);
        
        // Set fixed bounds - no scrolling beyond battlefield
        camera.setBounds(0, 0, 1920, 1080);
        
        // Disable camera panning - fixed battlefield view
        // Remove pointer drag functionality to keep battlefield fixed
        
        // Optional: Allow minimal zoom for tactical overview
        this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
            const zoom = camera.zoom;
            camera.zoom = Phaser.Math.Clamp(zoom - deltaY * 0.001, 0.8, 1.2);
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
        boundaryGraphics.strokeRect(100, 100, 1720, 880);
        
        // Add environmental objects (trees and bushes)
        this.createEnvironmentalObjects();
    }

    private setupDeploymentZones() {
        // Position deployment zones within 1920x1080 battlefield
        // Zone 1 on the left side, Zone 2 on the right side
        this.deploymentSystem.createDeploymentZone(1, 350, 540, 350, 400);
        this.deploymentSystem.createDeploymentZone(2, 1570, 540, 350, 400);
        
        this.visualizeDeploymentZones();
    }

    private visualizeDeploymentZones() {
        const zone1 = this.deploymentSystem.getDeploymentZone(1);
        const zone2 = this.deploymentSystem.getDeploymentZone(2);
        
        if (zone1) {
            const graphics1 = this.add.graphics();
            graphics1.lineStyle(2, 0x4444ff, 0.3);
            graphics1.fillStyle(0x4444ff, 0.1);
            graphics1.fillRect(zone1.centerX - zone1.width/2, zone1.centerY - zone1.height/2, zone1.width, zone1.height);
            graphics1.strokeRect(zone1.centerX - zone1.width/2, zone1.centerY - zone1.height/2, zone1.width, zone1.height);
        }
        
        if (zone2) {
            const graphics2 = this.add.graphics();
            graphics2.lineStyle(2, 0xff4444, 0.3);
            graphics2.fillStyle(0xff4444, 0.1);
            graphics2.fillRect(zone2.centerX - zone2.width/2, zone2.centerY - zone2.height/2, zone2.width, zone2.height);
            graphics2.strokeRect(zone2.centerX - zone2.width/2, zone2.centerY - zone2.height/2, zone2.width, zone2.height);
        }
    }

    private setupTestUnits() {
        const team1Units = [];
        const team2Units = [];
        
        // Create exactly 8 units for each of the 6 unit classes = 48 units per team
        const unitTypes = [UnitType.CHRONOTEMPORAL, UnitType.SNIPER, UnitType.DARK_MAGE, UnitType.WARRIOR, UnitType.NINJA, UnitType.SHOTGUNNER];
        
        unitTypes.forEach(unitType => {
            for (let i = 0; i < 8; i++) {
                team1Units.push(UnitFactory.createUnit(unitType, 1, 0, 0, 1));
                team2Units.push(UnitFactory.createUnit(unitType, 2, 0, 0, 1));
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
            
            // Battlefield bounds (with 50px margin from edges)
            const bounds = {
                minX: 50,
                maxX: 1870,
                minY: 50,
                maxY: 1030
            };
            
            // If unit is outside bounds, push it back towards center
            if (currentPos.x < bounds.minX || currentPos.x > bounds.maxX || 
                currentPos.y < bounds.minY || currentPos.y > bounds.maxY) {
                
                const centerX = 960;
                const centerY = 540;
                const direction = {
                    x: centerX - currentPos.x,
                    y: centerY - currentPos.y
                };
                
                const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
                if (magnitude > 0) {
                    direction.x /= magnitude;
                    direction.y /= magnitude;
                    unit.move(direction);
                }
                return; // Don't pursue enemies when out of bounds
            }
            
            const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
            if (enemies.length === 0) return;
            
            // Find closest enemy
            let closestEnemy = null;
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
                let direction = {
                    x: targetPos.x - currentPos.x,
                    y: targetPos.y - currentPos.y
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
            if (unit.isDead() || !unit.canAttack(currentTime)) return;
            
            const enemies = this.unitManager.getUnitsByTeam(unit.getTeam() === 1 ? 2 : 1);
            
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
                    // Melee attack with swing animation and 1-second cooldown
                    unit.performMeleeAttack(targetEnemy, currentTime);
                }
                
                unit.setLastAttackTime(currentTime);
            }
        });
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
                speed = 400; // Medium speed pellets
                break;
            case UnitType.DARK_MAGE:
                speed = 200; // Slow magic orb
                break;
            case UnitType.CHRONOTEMPORAL:
                speed = 250; // Medium magic
                break;
        }
        
        this.projectileSystem.createProjectile({
            startX: attackerPos.x,
            startY: attackerPos.y,
            targetX: targetPos.x,
            targetY: targetPos.y,
            unitType: unitType,
            damage: attackerUnit.getDamage(),
            speed: speed
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