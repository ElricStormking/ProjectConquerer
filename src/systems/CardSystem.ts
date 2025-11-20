import Phaser from 'phaser';
import { CardType, ICardPlacementPayload } from '../types/ironwars';
import { DeckSystem } from './DeckSystem';
import { GameStateManager } from './GameStateManager';
import { FortressSystem } from './FortressSystem';
import { UnitManager } from './UnitManager';
import { toUnitConfig } from '../data/ironwars/unitAdapter';

export class CardSystem {
    private buildingBuffs: Array<{ type: 'armor_shop' | 'overclock'; gridX: number; gridY: number }> = [];
    private cannonTowers: Array<{
        x: number;
        y: number;
        hp: number;
        maxHp: number;
        lastShotTime: number;
        range: number;
        body: Phaser.GameObjects.Graphics;
        hpBg: Phaser.GameObjects.Graphics;
        hpBar: Phaser.GameObjects.Graphics;
    }> = [];

    constructor(
        private scene: Phaser.Scene,
        private deckSystem: DeckSystem,
        private gameState: GameStateManager,
        private fortressSystem: FortressSystem,
        private unitManager: UnitManager
    ) {}

    public update(now: number, _deltaSeconds: number): void {
        this.updateCannonTowers(now);
    }

    public resolveCardPlacement(payload: ICardPlacementPayload): boolean {
        const { card, gridX, gridY } = payload;
        const state = this.gameState.getState();
        if (state.phase !== 'PREPARATION') {
            return false;
        }

        const cell = this.fortressSystem.getCell(gridX, gridY);
        if (!cell || cell.type === 'blocked' || cell.type === 'core' || cell.occupantId) {
            return false;
        }

        if (!this.gameState.spendResource(card.cost)) {
            return false;
        }

        let success = false;
        switch (card.type) {
            case CardType.UNIT:
                success = this.spawnUnitCard(card.unitId, gridX, gridY);
                break;
            case CardType.SPELL:
                success = this.castSpell(card.spellEffectId, gridX, gridY);
                break;
            default:
                success = false;
        }

        if (!success) {
            this.gameState.gainResource(card.cost);
            return false;
        }

        this.deckSystem.discard(card.id);
        return true;
    }

    private spawnUnitCard(unitId: string | undefined, gridX: number, gridY: number): boolean {
        if (!unitId) return false;
        const starter = this.gameState.getStarterData();
        if (!starter) return false;
        const unitConfig = starter.units[unitId];
        if (!unitConfig) return false;

        const worldPos = this.fortressSystem.gridToWorld(gridX, gridY);
        // Summon three units of this type in a small formation within the
        // same fortress grid, with minimal overlap.
        const offsets = [
            { x: -20, y: -10 },
            { x:  20, y: -10 },
            { x:   0, y:  12 }
        ];

        const spawned: any[] = [];
        offsets.forEach(offset => {
            const config = toUnitConfig(unitConfig, 1, worldPos.x + offset.x, worldPos.y + offset.y);
            const unit = this.unitManager.spawnUnit(config);
            if (unit) {
                spawned.push(unit);
            }
        });

        if (spawned.length === 0) {
            return false;
        }

        // Mark the cell as occupied using the first unit; all three share
        // this fortress grid tile.
        this.fortressSystem.occupyCell(gridX, gridY, spawned[0].getId());
        return true;
    }

    private castSpell(effectId: string | undefined, gridX: number, gridY: number): boolean {
        if (!effectId) return false;
        const worldPos = this.fortressSystem.gridToWorld(gridX, gridY);

        switch (effectId) {
            case 'barrier_field':
                this.createBarrierField(worldPos.x, worldPos.y);
                this.buildingBuffs.push({ type: 'armor_shop', gridX, gridY });
                return true;
            case 'overclock':
                this.applyOverclock(worldPos.x, worldPos.y);
                this.buildingBuffs.push({ type: 'overclock', gridX, gridY });
                return true;
            case 'cannon_tower':
                this.createCannonTower(worldPos.x, worldPos.y, gridX, gridY);
                return true;
            default:
                return false;
        }
    }

    private createBarrierField(x: number, y: number) {
        // Armor Shop building (formerly "Barrier Field") – visible structure on
        // the fortress diamond plus a subtle protective aura.
        const shop = this.scene.add.graphics();
        shop.setDepth(4020);

        const baseHalfW = 64;
        const baseHalfH = 32;
        shop.fillStyle(0x444444, 0.28);
        shop.lineStyle(2, 0x888888, 0.9);
        shop.beginPath();
        shop.moveTo(x, y - baseHalfH);
        shop.lineTo(x + baseHalfW, y);
        shop.lineTo(x, y + baseHalfH);
        shop.lineTo(x - baseHalfW, y);
        shop.closePath();
        shop.fillPath();
        shop.strokePath();

        const bodyWidth = 72;
        const bodyHeight = 30;
        const wallBottomY = y - 6;
        const wallTopY = wallBottomY - bodyHeight;

        shop.fillStyle(0x555555, 0.98);
        shop.fillRect(x - bodyWidth / 2, wallTopY, bodyWidth, bodyHeight);

        shop.fillStyle(0x777777, 1);
        shop.beginPath();
        shop.moveTo(x - bodyWidth / 2 - 4, wallTopY);
        shop.lineTo(x, wallTopY - 18);
        shop.lineTo(x + bodyWidth / 2 + 4, wallTopY);
        shop.closePath();
        shop.fillPath();

        shop.fillStyle(0xc0c0c0, 1);
        const signRadius = 9;
        const signY = wallTopY + bodyHeight / 2;
        shop.fillCircle(x, signY, signRadius);
        shop.lineStyle(2, 0xffffff, 0.9);
        shop.strokeCircle(x, signY, signRadius);

        shop.lineStyle(2, 0x294f7d, 0.9);
        shop.beginPath();
        shop.moveTo(x - 4, signY - 5);
        shop.lineTo(x - 4, signY + 5);
        shop.moveTo(x + 4, signY - 5);
        shop.lineTo(x + 4, signY + 5);
        shop.strokePath();

        this.scene.tweens.add({
            targets: shop,
            alpha: { from: 1, to: 0.7 },
            duration: 900,
            yoyo: true,
            repeat: -1
        });

        const circle = this.scene.add.graphics();
        circle.setDepth(3900);
        circle.lineStyle(2, 0x66ccff, 0.55);
        circle.strokeCircle(x, y, 90);
        this.scene.tweens.add({
            targets: circle,
            alpha: 0,
            duration: 1200,
            onComplete: () => circle.destroy()
        });
    }

    private applyOverclock(x: number, y: number) {
        this.createOverclockStable(x, y);
        const ring = this.scene.add.graphics();
        ring.lineStyle(2, 0xffcc33, 0.8);
        ring.strokeCircle(x, y, 120);
        this.scene.tweens.add({ targets: ring, alpha: 0, duration: 800, onComplete: () => ring.destroy() });
    }

    private createOverclockStable(x: number, y: number) {
        const g = this.scene.add.graphics();
        g.setDepth(4050);

        const baseHalfW = 64;
        const baseHalfH = 32;
        g.fillStyle(0x5c3b1a, 0.28);
        g.lineStyle(2, 0x8b5a2b, 0.9);
        g.beginPath();
        g.moveTo(x, y - baseHalfH);
        g.lineTo(x + baseHalfW, y);
        g.lineTo(x, y + baseHalfH);
        g.lineTo(x - baseHalfW, y);
        g.closePath();
        g.fillPath();
        g.strokePath();

        const stableWidth = 80;
        const stableHeight = 32;
        const wallBottomY = y - 4;
        const wallTopY = wallBottomY - stableHeight;

        g.fillStyle(0x8b4513, 0.95);
        g.fillRect(x - stableWidth / 2, wallTopY, stableWidth, stableHeight);

        g.fillStyle(0xc27b43, 0.98);
        g.beginPath();
        g.moveTo(x - stableWidth / 2 - 6, wallTopY);
        g.lineTo(x, wallTopY - 20);
        g.lineTo(x + stableWidth / 2 + 6, wallTopY);
        g.closePath();
        g.fillPath();

        g.fillStyle(0x3b1f0f, 1);
        const doorWidth = 22;
        const doorHeight = 22;
        g.fillRect(x - doorWidth / 2, wallBottomY - doorHeight, doorWidth, doorHeight);

        g.lineStyle(1.5, 0xd9b38c, 0.9);
        g.beginPath();
        g.moveTo(x - stableWidth / 2 + 6, wallBottomY - 10);
        g.lineTo(x - baseHalfW + 10, y + baseHalfH - 6);
        g.moveTo(x + stableWidth / 2 - 6, wallBottomY - 10);
        g.lineTo(x + baseHalfW - 10, y + baseHalfH - 6);
        g.strokePath();

        this.scene.tweens.add({
            targets: g,
            alpha: { from: 1, to: 0.7 },
            duration: 900,
            yoyo: true,
            repeat: -1
        });
    }

    private createCannonTower(x: number, y: number, gridX: number, gridY: number): void {
        // Occupy this fortress grid with a unique tower occupant id so no
        // other buildings/units can be placed here.
        const occupantId = `cannon_tower_${this.cannonTowers.length}`;
        this.fortressSystem.occupyCell(gridX, gridY, occupantId);

        const body = this.scene.add.graphics();
        const hpBg = this.scene.add.graphics();
        const hpBar = this.scene.add.graphics();

        // Draw stone tower base diamond.
        const baseHalfW = 64;
        const baseHalfH = 32;
        body.fillStyle(0x22252e, 0.95);
        body.lineStyle(2, 0xa0a8b8, 0.9);
        body.beginPath();
        body.moveTo(x, y - baseHalfH);
        body.lineTo(x + baseHalfW, y);
        body.lineTo(x, y + baseHalfH);
        body.lineTo(x - baseHalfW, y);
        body.closePath();
        body.fillPath();
        body.strokePath();

        // Tower shaft.
        const towerWidth = 40;
        const towerHeight = 70;
        const towerBottomY = y - 6;
        const towerTopY = towerBottomY - towerHeight;
        body.fillStyle(0x3a4252, 1);
        body.fillRect(x - towerWidth / 2, towerTopY, towerWidth, towerHeight);

        // Cannon housing and barrel on top.
        const turretY = towerTopY - 10;
        body.fillStyle(0x4b5568, 1);
        body.fillRoundedRect(x - 24, turretY - 10, 48, 20, 6);

        // Barrel pointing toward the battlefield center (to the right).
        body.lineStyle(5, 0xc7cedd, 1);
        body.beginPath();
        body.moveTo(x + 8, turretY - 2);
        body.lineTo(x + 40, turretY - 2);
        body.strokePath();

        body.fillStyle(0x1c222c, 1);
        body.fillCircle(x - 10, turretY - 2, 5);

        // Depth so the tower appears above nearby units.
        body.setDepth(y + 3600);

        // HP bar above the tower.
        const maxHp = 200;
        const hpWidth = 50;
        const hpHeight = 4;
        const hpY = towerTopY - 16;
        hpBg.clear();
        hpBg.fillStyle(0x000000, 0.7);
        hpBg.fillRect(x - hpWidth / 2, hpY, hpWidth, hpHeight);
        hpBg.setDepth(y + 3601);

        hpBar.clear();
        hpBar.fillStyle(0x00ff00, 1);
        hpBar.fillRect(x - hpWidth / 2, hpY, hpWidth, hpHeight);
        hpBar.setDepth(y + 3602);

        this.cannonTowers.push({
            x,
            y,
            hp: maxHp,
            maxHp,
            lastShotTime: 0,
            range: (this.scene.cameras.main.width || 1920) * (2 / 3),
            body,
            hpBg,
            hpBar
        });
    }

    private getAdjacentFortressCells(gridX: number, gridY: number): Array<{ x: number; y: number }> {
        const candidates = [
            { x: gridX, y: gridY },
            { x: gridX + 1, y: gridY },
            { x: gridX - 1, y: gridY },
            { x: gridX, y: gridY + 1 },
            { x: gridX, y: gridY - 1 }
        ];
        return candidates.filter(c => !!this.fortressSystem.getCell(c.x, c.y));
    }

    public applyBuildingBuffsAtBattleStart(): void {
        if (this.buildingBuffs.length === 0) return;

        const allies = this.unitManager.getUnitsByTeam(1);

        this.buildingBuffs.forEach(buff => {
            const affectedCells = this.getAdjacentFortressCells(buff.gridX, buff.gridY);
            allies.forEach(unit => {
                const pos = unit.getPosition();
                const uGrid = this.fortressSystem.worldToGrid(pos.x, pos.y);
                const inArea = affectedCells.some(c => c.x === uGrid.x && c.y === uGrid.y);
                if (!inArea) return;

                switch (buff.type) {
                    case 'armor_shop':
                        unit.heal(30);
                        break;
                    case 'overclock':
                        unit.setAttackSpeedMultiplier(1.5);
                        this.scene.time.delayedCall(5000, () => unit.setAttackSpeedMultiplier(1));
                        break;
                }

                // Mark unit as buffed for UI (yellow square next to name)
                (unit as any).markBuildingBuff?.();
            });
        });
    }

    private updateCannonTowers(now: number): void {
        if (this.gameState.getState().phase !== 'BATTLE') return;

        const enemies = this.unitManager.getUnitsByTeam(2);
        if (enemies.length === 0) return;

        const COOLDOWN_MS = 2000;
        const DAMAGE = 40;

        this.cannonTowers.forEach(tower => {
            if (now - tower.lastShotTime < COOLDOWN_MS) {
                return;
            }

            let closest: any = null;
            let closestDist = tower.range;

            enemies.forEach(enemy => {
                if (enemy.isDead()) return;
                const pos = enemy.getPosition();
                const dist = Phaser.Math.Distance.Between(tower.x, tower.y, pos.x, pos.y);
                if (dist <= tower.range && dist < closestDist) {
                    closestDist = dist;
                    closest = enemy;
                }
            });

            if (!closest) {
                return;
            }

            tower.lastShotTime = now;

            const targetPos = closest.getPosition();

            // Simple cannon shot: draw a bright line toward the target and
            // apply direct damage (no knockback/armor for now).
            const shot = this.scene.add.graphics();
            shot.setDepth(8000);
            shot.lineStyle(3, 0xfff3b0, 1);
            shot.beginPath();
            const muzzleY = tower.y - 40;
            shot.moveTo(tower.x + 20, muzzleY);
            shot.lineTo(targetPos.x, targetPos.y);
            shot.strokePath();

            this.scene.tweens.add({
                targets: shot,
                alpha: 0,
                duration: 180,
                onComplete: () => shot.destroy()
            });

            (closest as any).takeDamage(DAMAGE);
        });
    }
}
