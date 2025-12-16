import Phaser from 'phaser';
import { IFortressCell, IFortressConfig } from '../types/ironwars';
import { IsometricRenderer } from './IsometricRenderer';

export class FortressSystem extends Phaser.Events.EventEmitter {
    private scene: Phaser.Scene;
    private renderer: IsometricRenderer;
    private config: IFortressConfig;
    private cellMap: Map<string, IFortressCell> = new Map();
    private gridGraphics!: Phaser.GameObjects.Graphics;
    private placementGraphics!: Phaser.GameObjects.Graphics;
    private hoverGraphics!: Phaser.GameObjects.Graphics;
    private originX: number;
    private originY: number;
    private cellWidth: number;
    private cellHeight: number;
    private unlockedCells: Set<string> = new Set();

    constructor(
        scene: Phaser.Scene,
        renderer: IsometricRenderer,
        config: IFortressConfig,
        originX = 960,
        originY = 400,
        cellWidth = 64,
        cellHeight = 32
    ) {
        super();
        this.scene = scene;
        this.renderer = renderer;
        this.config = config;
        this.originX = originX;
        this.originY = originY;
        this.cellWidth = cellWidth;
        this.cellHeight = cellHeight;
        config.cells.forEach(cell => {
            // Ensure we start fresh by stripping persistent fields if they leaked into the config
            this.cellMap.set(this.key(cell.x, cell.y), { 
                ...cell,
                occupantId: undefined,
                occupantType: undefined,
                enhancementLevel: 0
            });
        });
        // Default unlocked to all buildable/core until overridden
        const defaults: string[] = [];
        this.cellMap.forEach(cell => {
            if (cell.type !== 'blocked') defaults.push(this.key(cell.x, cell.y));
        });
        this.unlockedCells = new Set(defaults);
    }

    public initialize(): void {
        this.gridGraphics = this.scene.add.graphics();
        this.placementGraphics = this.scene.add.graphics();
        this.hoverGraphics = this.scene.add.graphics();
        this.renderer.addToRenderGroup(this.gridGraphics);
        this.renderer.addToRenderGroup(this.placementGraphics);
        this.renderer.addToRenderGroup(this.hoverGraphics);
        this.drawGrid();
    }

    public getCell(x: number, y: number): IFortressCell | undefined {
        return this.cellMap.get(this.key(x, y));
    }

    public isValidCell(x: number, y: number): boolean {
        const cell = this.getCell(x, y);
        return !!cell && cell.type === 'buildable' && this.isUnlocked(x, y) && !cell.occupantId;
    }

    public isUnlocked(x: number, y: number): boolean {
        return this.unlockedCells.has(this.key(x, y));
    }

    public setUnlockedCells(keys: string[]): void {
        this.unlockedCells = new Set(keys);
        if (this.placementGraphics) {
            this.showPlacementHints();
        }
    }

    public getUnlockedCellKeys(): string[] {
        return Array.from(this.unlockedCells);
    }

    public unlockNextCells(count: number): string[] {
        if (count <= 0) return [];
        const candidates = this.getExpandableCells();
        const added: string[] = [];
        for (const c of candidates) {
            if (added.length >= count) break;
            if (!this.unlockedCells.has(c.key)) {
                this.unlockedCells.add(c.key);
                added.push(c.key);
            }
        }
        if (added.length > 0) {
            if (this.placementGraphics) {
                this.showPlacementHints();
            }
        }
        return added;
    }

    public unlockSpecificCells(cells: { x: number; y: number }[], maxCount?: number): string[] {
        const added: string[] = [];
        for (const c of cells) {
            if (maxCount && added.length >= maxCount) break;
            const key = this.key(c.x, c.y);
            const cell = this.cellMap.get(key);
            if (!cell) continue;
            if (cell.type !== 'buildable') continue;
            if (this.unlockedCells.has(key)) continue;
            this.unlockedCells.add(key);
            added.push(key);
        }
        if (added.length > 0 && this.placementGraphics) {
            this.showPlacementHints();
        }
        return added;
    }

    public occupyCell(x: number, y: number, occupantId: string, occupantType?: string): void {
        const cell = this.getCell(x, y);
        if (!cell) return;
        cell.occupantId = occupantId;
        cell.occupantType = occupantType;
        cell.enhancementLevel = 0;
    }

    public enhanceCell(x: number, y: number): number {
        const cell = this.getCell(x, y);
        if (!cell) return 0;
        cell.enhancementLevel = (cell.enhancementLevel || 0) + 1;
        return cell.enhancementLevel;
    }

    public releaseCellByOccupant(occupantId: string): void {
        let released = false;
        for (const cell of this.cellMap.values()) {
            if (cell.occupantId === occupantId) {
                console.log(`[FortressSystem] Releasing cell (${cell.x}, ${cell.y}) from occupant ${occupantId}`);
                cell.occupantId = undefined;
                cell.occupantType = undefined;
                cell.enhancementLevel = 0;
                released = true;
            }
        }
        if (!released) {
            console.log(`[FortressSystem] No cell found for occupant ${occupantId}`);
        }
    }

    public resetAllEnhancements(): void {
        for (const cell of this.cellMap.values()) {
            if (cell.enhancementLevel && cell.enhancementLevel > 0) {
                console.log(`[FortressSystem] Resetting enhancement for cell (${cell.x}, ${cell.y}) from level ${cell.enhancementLevel} to 0`);
                cell.enhancementLevel = 0;
            }
        }
    }

    public gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
        const isoX = (gridX - gridY) * (this.cellWidth / 2);
        const isoY = (gridX + gridY) * (this.cellHeight / 2);
        return {
            x: this.originX + isoX,
            y: this.originY + isoY
        };
    }

    public worldToGrid(worldX: number, worldY: number): { x: number; y: number } {
        const cartX = (worldX - this.originX) / (this.cellWidth / 2);
        const cartY = (worldY - this.originY) / (this.cellHeight / 2);
        const gridX = Math.round((cartX + cartY) / 2);
        const gridY = Math.round((cartY - cartX) / 2);
        return { x: gridX, y: gridY };
    }

    public setHoverCell(gridX: number, gridY: number, isValid: boolean): void {
        this.hoverGraphics.clear();
        const cell = this.getCell(gridX, gridY);
        if (!cell) return;
        const color = isValid ? 0xa6ff00 : 0xff4d4d;
        const points = this.getDiamondPoints(gridX, gridY);
        this.hoverGraphics.lineStyle(3, color, 0.95);
        this.hoverGraphics.strokePoints(points, true);
        this.hoverGraphics.fillStyle(color, 0.14);
        this.hoverGraphics.fillPoints(points, true);
    }

    public clearHover(): void {
        this.hoverGraphics.clear();
    }

    public showPlacementHints(): void {
        this.placementGraphics.clear();
        this.config.cells.forEach(cell => {
            if (cell.type === 'blocked' || cell.type === 'core') {
                this.drawInvalidCellMarker(cell.x, cell.y);
                return;
            }
            if (!this.isUnlocked(cell.x, cell.y)) {
                this.drawLockedCellMarker(cell.x, cell.y);
                return;
            }
            const valid = this.isValidCell(cell.x, cell.y);
            if (valid) {
                const points = this.getDiamondPoints(cell.x, cell.y);
                this.placementGraphics.lineStyle(2, 0x66ff99, 0.8);
                this.placementGraphics.strokePoints(points, true);
                this.placementGraphics.fillStyle(0x33ff66, 0.08);
                this.placementGraphics.fillPoints(points, true);
            } else {
                this.drawInvalidCellMarker(cell.x, cell.y);
            }
        });
    }

    public clearPlacementHints(): void {
        this.placementGraphics.clear();
    }

    public getCellDimensions(): { width: number; height: number } {
        return { width: this.cellWidth, height: this.cellHeight };
    }

    public getFortressId(): string {
        return this.config.id;
    }

    private drawGrid(): void {
        this.gridGraphics.clear();
        this.gridGraphics.lineStyle(1.5, 0xffffff, 0.25);
        this.config.cells.forEach(cell => {
            if (cell.type === 'blocked') return;
            if (cell.type !== 'core' && !this.isUnlocked(cell.x, cell.y)) return;
            const points = this.getDiamondPoints(cell.x, cell.y);
            this.gridGraphics.strokePoints(points, true);
            if (cell.type === 'core') {
                this.gridGraphics.fillStyle(0xffcc33, 0.08);
                this.gridGraphics.fillPoints(points, true);
            }
        });
    }

    private getDiamondPoints(gridX: number, gridY: number): Phaser.Geom.Point[] {
        const { x, y } = this.gridToWorld(gridX, gridY);
        const halfW = this.cellWidth / 2;
        const halfH = this.cellHeight / 2;
        return [
            new Phaser.Geom.Point(x, y - halfH),
            new Phaser.Geom.Point(x + halfW, y),
            new Phaser.Geom.Point(x, y + halfH),
            new Phaser.Geom.Point(x - halfW, y)
        ];
    }

    private drawInvalidCellMarker(gridX: number, gridY: number): void {
        const points = this.getDiamondPoints(gridX, gridY);
        this.placementGraphics.lineStyle(2, 0xff4d4d, 0.8);
        this.placementGraphics.strokePoints(points, true);
        this.placementGraphics.fillStyle(0xff4d4d, 0.12);
        this.placementGraphics.fillPoints(points, true);
    }

    private drawLockedCellMarker(gridX: number, gridY: number): void {
        const points = this.getDiamondPoints(gridX, gridY);
        this.placementGraphics.lineStyle(2, 0x777777, 0.6);
        this.placementGraphics.strokePoints(points, true);
        this.placementGraphics.fillStyle(0x555555, 0.12);
        this.placementGraphics.fillPoints(points, true);
    }

    private getExpandableCells(): { key: string; dist: number }[] {
        const centerX = Math.floor(this.config.gridWidth / 2);
        const centerY = Math.floor(this.config.gridHeight / 2);
        return Array.from(this.cellMap.values())
            .filter(c => c.type === 'buildable' && !this.unlockedCells.has(this.key(c.x, c.y)))
            .map(c => ({ key: this.key(c.x, c.y), dist: Math.abs(c.x - centerX) + Math.abs(c.y - centerY) }))
            .sort((a, b) => a.dist - b.dist);
    }

    private key(x: number, y: number): string {
        return `${x},${y}`;
    }
}
