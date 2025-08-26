import Phaser from 'phaser';

export class PhysicsManager {
    private scene: Phaser.Scene;
    private world: MatterJS.World;
    private activeBodies: Set<MatterJS.BodyType>;
    private readonly MAX_BODIES = 160;
    private readonly CRITICAL_BODIES = 240;
    
    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.world = scene.matter.world.localWorld;
        this.activeBodies = new Set();
        
        this.setupPhysicsSettings();
    }
    
    private setupPhysicsSettings() {
        this.world.gravity.x = 0;
        this.world.gravity.y = 0;
        
        this.scene.matter.world.setBounds(0, 0, 2048, 2048);
        
        this.scene.matter.config.constraintIterations = 2;
        this.scene.matter.config.positionIterations = 6;
        this.scene.matter.config.velocityIterations = 4;
        
        this.scene.matter.world.on('collisionstart', this.handleCollisionStart, this);
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
            if (body.speed < 0.01 && !body.isSleeping) {
                this.scene.matter.body.setVelocity(body, { x: 0, y: 0 });
            }
            
            if (body.speed > 0.1) {
                const damping = 0.95;
                this.scene.matter.body.setVelocity(body, {
                    x: body.velocity.x * damping,
                    y: body.velocity.y * damping
                });
            }
        });
    }
}