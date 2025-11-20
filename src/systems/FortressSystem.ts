import Phaser from 'phaser';
import { IFortressCell, IFortressConfig } from '../types/ironwars';
import { IsometricRenderer } from './IsometricRenderer';

export class FortressSystem extends Phaser.Events.EventEmitter {
    private scene: Phaser.Scene;
    private renderer: IsometricRenderer;
    private config: IFortressConfig;
    private cellMap: Map<string, IFortressCell> = new Map();
    private gridGraphics!: Phaser.GameObjects.Graphics;
    private hoverGraphics!: Phaser.GameObjects.Graphics;
    private originX: number;
    private originY: number;
    private cellWidth: number;
    private cellHeight: number;

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
            this.cellMap.set(this.key(cell.x, cell.y), { ...cell });
        });
    }

    public initialize(): void {
        this.gridGraphics = this.scene.add.graphics();
        this.hoverGraphics = this.scene.add.graphics();
        this.renderer.addToRenderGroup(this.gridGraphics);
        this.renderer.addToRenderGroup(this.hoverGraphics);
        this.drawGrid();
    }

    public getCell(x: number, y: number): IFortressCell | undefined {
        return this.cellMap.get(this.key(x, y));
    }

    public isValidCell(x: number, y: number): boolean {
        const cell = this.getCell(x, y);
        return !!cell && cell.type === 'buildable' && !cell.occupantId;
    }

    public occupyCell(x: number, y: number, occupantId: string): void {
        const cell = this.getCell(x, y);
        if (!cell) return;
        cell.occupantId = occupantId;
    }

    public releaseCellByOccupant(occupantId: string): void {
        for (const cell of this.cellMap.values()) {
            if (cell.occupantId === occupantId) {
                cell.occupantId = undefined;
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
        this.hoverGraphics.lineStyle(3, color, 0.9);
        this.hoverGraphics.strokePoints(points, true);
    }

    public clearHover(): void {
        this.hoverGraphics.clear();
    }

    private drawGrid(): void {
        this.gridGraphics.clear();
        this.gridGraphics.lineStyle(1.5, 0xffffff, 0.25);
        this.config.cells.forEach(cell => {
            if (cell.type === 'blocked') return;
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

    private key(x: number, y: number): string {
        return `${x},${y}`;
    }
}
