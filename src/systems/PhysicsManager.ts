import Phaser from 'phaser';

export class PhysicsManager {
    private scene: Phaser.Scene;
    private world: MatterJS.World;
    private activeBodies: Set<MatterJS.BodyType>;
    private readonly MAX_BODIES = 160;
    private readonly CRITICAL_BODIES = 240;
    private battlefieldWalls: MatterJS.BodyType[] = [];
    
    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.world = scene.matter.world.localWorld;
        this.activeBodies = new Set();
        
        this.setupPhysicsSettings();
    }
    
    private setupPhysicsSettings() {
        this.world.gravity.x = 0;
        this.world.gravity.y = 0;
        
        // Broad world bounds; collision walls are set explicitly via
        // setBattlefieldBounds to match the visible battlefield rectangle
        this.scene.matter.world.setBounds(0, 0, 2048, 2048);
        
        this.scene.matter.config.constraintIterations = 2;
        this.scene.matter.config.positionIterations = 6;
        this.scene.matter.config.velocityIterations = 4;
        
        this.scene.matter.world.on('collisionstart', this.handleCollisionStart, this);
    }

    /**
     * Create solid, static Matter walls around the visible battlefield
     * so units cannot exit the green rectangle.
     */
    public setBattlefieldBounds(x: number, y: number, width: number, height: number, paddingX: number = 0, paddingY: number = 0): void {
        // Remove previous walls if any
        if (this.battlefieldWalls.length > 0) {
            this.battlefieldWalls.forEach(w => this.scene.matter.world.remove(w));
            this.battlefieldWalls = [];
        }
        const thickness = 60; // generous thickness to avoid tunneling
        const halfT = thickness / 2;
        const ix = x + paddingX;
        const iy = y + paddingY;
        const iw = Math.max(0, width - paddingX * 2);
        const ih = Math.max(0, height - paddingY * 2);
        const wallMaterial = { isStatic: true, restitution: 0.95, friction: 0.0001, frictionStatic: 0.0001 } as const;
        const left   = this.scene.matter.bodies.rectangle(ix - halfT, iy + ih / 2, thickness, ih + thickness, wallMaterial as any);
        const right  = this.scene.matter.bodies.rectangle(ix + iw + halfT, iy + ih / 2, thickness, ih + thickness, wallMaterial as any);
        const top    = this.scene.matter.bodies.rectangle(ix + iw / 2, iy - halfT, iw + thickness, thickness, wallMaterial as any);
        const bottom = this.scene.matter.bodies.rectangle(ix + iw / 2, iy + ih + halfT, iw + thickness, thickness, wallMaterial as any);
        this.scene.matter.world.add([left, right, top, bottom]);
        this.battlefieldWalls = [left, right, top, bottom];
    }
    
    public createCircleBody(x: number, y: number, radius: number, options: any = {}): MatterJS.BodyType {
        if (this.activeBodies.size >= this.CRITICAL_BODIES) {
            console.warn('Critical body limit reached!');
            return null as any;
        }
        
        const body = this.scene.matter.bodies.circle(x, y, radius, {
            frictionAir: 0.05,
            friction: 0.2,
            restitution: 0.3,
            sleepThreshold: 60,
            ...options
        });
        
        // Add body to the world
        this.scene.matter.world.add(body);
        
        this.activeBodies.add(body);
        
        if (this.activeBodies.size > this.MAX_BODIES) {
            this.optimizePhysics();
        }
        
        return body;
    }
    
    public removeBody(body: MatterJS.BodyType): void {
        if (body && this.activeBodies.has(body)) {
            this.scene.matter.world.remove(body);
            this.activeBodies.delete(body);
        }
    }
    
    private handleCollisionStart(event: any): void {
        const pairs = event.pairs;
        
        for (const pair of pairs) {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;
            
            if (bodyA.gameObject && bodyB.gameObject) {
                bodyA.gameObject.emit('collision', bodyB.gameObject);
                bodyB.gameObject.emit('collision', bodyA.gameObject);
            }
        }
    }
    
    private optimizePhysics(): void {
        const sleepingBodies = Array.from(this.activeBodies).filter(body => 
            body.isSleeping || body.speed < 0.1
        );
        
        sleepingBodies.forEach(body => {
            body.sleepThreshold = 20;
            body.frictionAir = 0.1;
        });
    }
    
    public applyImpulse(body: MatterJS.BodyType, force: { x: number; y: number }): void {
        if (body && !body.isStatic) {
            this.scene.matter.body.applyForce(body, body.position, force);
        }
    }
    
    public applyBlastWave(
        epicenter: { x: number; y: number }, 
        maxRadius: number, 
        maxForce: number
    ): void {
        this.activeBodies.forEach(body => {
            if (body.isStatic) return;
            
            const dx = body.position.x - epicenter.x;
            const dy = body.position.y - epicenter.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < maxRadius && distance > 0) {
                const falloff = 1 / (distance * distance);
                const force = Math.min(maxForce * falloff, maxForce);
                
                const angle = Math.atan2(dy, dx);
                const impulse = {
                    x: Math.cos(angle) * force,
                    y: Math.sin(angle) * force
                };
                
                this.applyImpulse(body, impulse);
            }
        });
    }
    
    public getActiveBodyCount(): number {
        return this.activeBodies.size;
    }
    
    public update(_deltaTime: number): void {
        const activeBodiesArray = Array.from(this.activeBodies);
        
        activeBodiesArray.forEach(body => {
            // Keep bodies from jittering when nearly stopped, but don't over-damp
            if (body.speed < 0.01 && !body.isSleeping) {
                this.scene.matter.body.setVelocity(body, { x: 0, y: 0 });
            }
            
            // Light damping only; allow energetic reflections on walls
            if (body.speed > 0.1) {
                const damping = 0.985;
                this.scene.matter.body.setVelocity(body, {
                    x: body.velocity.x * damping,
                    y: body.velocity.y * damping
                });
            }
        });
    }
}