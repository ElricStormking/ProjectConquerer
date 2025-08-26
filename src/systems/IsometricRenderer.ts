import Phaser from 'phaser';

export class IsometricRenderer {
    private scene: Phaser.Scene;
    private renderGroup: Phaser.GameObjects.Group;
    
    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.renderGroup = scene.add.group();
    }
    
    public cartesianToIsometric(x: number, y: number): { x: number; y: number } {
        return {
            x: (x - y) * 16,
            y: (x + y) * 8
        };
    }
    
    public isometricToCartesian(isoX: number, isoY: number): { x: number; y: number } {
        return {
            x: (isoX / 16 + isoY / 8) / 2,
            y: (isoY / 8 - isoX / 16) / 2
        };
    }
    
    public addToRenderGroup(gameObject: Phaser.GameObjects.GameObject): void {
        this.renderGroup.add(gameObject);
    }
    
    public removeFromRenderGroup(gameObject: Phaser.GameObjects.GameObject): void {
        this.renderGroup.remove(gameObject);
    }
    
    public update(): void {
        this.performYSort();
    }
    
    private performYSort(): void {
        const children = this.renderGroup.getChildren();
        children.sort((a: any, b: any) => {
            const depthA = a.y + (a.z || 0);
            const depthB = b.y + (b.z || 0);
            return depthA - depthB;
        });
        
        children.forEach((child, index) => {
            (child as any).setDepth(index);
        });
    }
    
    public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
        const camera = this.scene.cameras.main;
        const worldX = (screenX - camera.centerX) / camera.zoom + camera.scrollX;
        const worldY = (screenY - camera.centerY) / camera.zoom + camera.scrollY;
        return this.isometricToCartesian(worldX, worldY);
    }
    
    public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
        const iso = this.cartesianToIsometric(worldX, worldY);
        const camera = this.scene.cameras.main;
        return {
            x: (iso.x - camera.scrollX) * camera.zoom + camera.centerX,
            y: (iso.y - camera.scrollY) * camera.zoom + camera.centerY
        };
    }
}