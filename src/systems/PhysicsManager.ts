import Phaser from 'phaser';

type Vector2 = { x: number; y: number };

export interface KinematicBody {
    position: Vector2;
    velocity: Vector2;
    radius: number;
    mass: number;
    friction: number;
    frictionAir: number;
    sleepThreshold: number;
    isStatic: boolean;
    isSensor: boolean;
    speed: number;
    gameObject?: Phaser.Events.EventEmitter;
    movementVelocity: Vector2;
    impulseVelocity: Vector2;
}

interface BattlefieldBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export class PhysicsManager {
    private readonly activeBodies: Set<KinematicBody>;
    private battlefieldBounds?: BattlefieldBounds;
    private readonly MAX_BODIES = 160;
    private readonly CRITICAL_BODIES = 240;

    constructor(_scene: Phaser.Scene) {
        this.activeBodies = new Set();
    }

    public setBattlefieldBounds(
        x: number,
        y: number,
        width: number,
        height: number,
        paddingX: number = 0,
        paddingY: number = 0
    ): void {
        const minX = x + paddingX;
        const minY = y + paddingY;
        const maxX = minX + Math.max(0, width - paddingX * 2);
        const maxY = minY + Math.max(0, height - paddingY * 2);
        this.battlefieldBounds = { minX, minY, maxX, maxY };
    }

    public createCircleBody(x: number, y: number, radius: number, options: Record<string, unknown> = {}): KinematicBody {
        if (this.activeBodies.size >= this.CRITICAL_BODIES) {
            console.warn('Critical body limit reached!');
            return null as any;
        }

        const mass = Number(options.mass);
        const friction = Number(options.friction);
        const frictionAir = Number(options.frictionAir);
        const sleepThreshold = Number(options.sleepThreshold);

        const body: KinematicBody = {
            position: { x, y },
            velocity: { x: 0, y: 0 },
            radius,
            mass: Number.isFinite(mass) && mass > 0 ? mass : 1,
            friction: Number.isFinite(friction) ? friction : 0.2,
            frictionAir: Number.isFinite(frictionAir) ? frictionAir : 0.05,
            sleepThreshold: Number.isFinite(sleepThreshold) ? sleepThreshold : 60,
            isStatic: Boolean(options.isStatic),
            isSensor: Boolean(options.isSensor),
            speed: 0,
            movementVelocity: { x: 0, y: 0 },
            impulseVelocity: { x: 0, y: 0 }
        };

        this.activeBodies.add(body);

        if (this.activeBodies.size > this.MAX_BODIES) {
            console.warn(`[PhysicsManager] High body count: ${this.activeBodies.size}`);
        }

        this.clampBodyToBounds(body);
        return body;
    }

    public removeBody(body: KinematicBody): void {
        if (body) {
            this.activeBodies.delete(body);
        }
    }

    public setMoveVelocity(body: KinematicBody, velocity: Vector2): void {
        if (!body || body.isStatic) return;
        body.movementVelocity.x = velocity.x;
        body.movementVelocity.y = velocity.y;
    }

    public setVelocity(body: KinematicBody, velocity: Vector2): void {
        if (!body || body.isStatic) return;
        body.movementVelocity.x = 0;
        body.movementVelocity.y = 0;
        body.impulseVelocity.x = velocity.x;
        body.impulseVelocity.y = velocity.y;
        body.velocity.x = velocity.x;
        body.velocity.y = velocity.y;
        body.speed = Math.hypot(velocity.x, velocity.y);
    }

    public setPosition(body: KinematicBody, position: Vector2): void {
        if (!body) return;
        body.position.x = position.x;
        body.position.y = position.y;
        this.clampBodyToBounds(body);
    }

    public applyImpulse(body: KinematicBody, force: Vector2): void {
        if (!body || body.isStatic) return;

        const mass = Math.max(1, body.mass);
        const knockbackScale = 180;
        body.impulseVelocity.x += (force.x / mass) * knockbackScale;
        body.impulseVelocity.y += (force.y / mass) * knockbackScale;
    }

    public applyBlastWave(epicenter: Vector2, maxRadius: number, maxForce: number): void {
        this.activeBodies.forEach(body => {
            if (body.isStatic) return;

            const dx = body.position.x - epicenter.x;
            const dy = body.position.y - epicenter.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < maxRadius && distance > 0) {
                const falloff = 1 / (distance * distance);
                const force = Math.min(maxForce * falloff, maxForce);
                const angle = Math.atan2(dy, dx);
                this.applyImpulse(body, {
                    x: Math.cos(angle) * force,
                    y: Math.sin(angle) * force
                });
            }
        });
    }

    public getActiveBodyCount(): number {
        return this.activeBodies.size;
    }

    public update(deltaTime: number): void {
        if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
            return;
        }

        const bodies = Array.from(this.activeBodies);

        bodies.forEach(body => {
            if (body.isStatic) return;

            const totalVelocity = {
                x: body.movementVelocity.x + body.impulseVelocity.x,
                y: body.movementVelocity.y + body.impulseVelocity.y
            };

            body.velocity.x = totalVelocity.x;
            body.velocity.y = totalVelocity.y;
            body.speed = Math.hypot(totalVelocity.x, totalVelocity.y);

            body.position.x += totalVelocity.x * deltaTime;
            body.position.y += totalVelocity.y * deltaTime;
            this.clampBodyToBounds(body);

            const damping = Phaser.Math.Clamp(
                1 - (body.frictionAir * 2.5 + body.friction * 0.05) * deltaTime * 60,
                0.55,
                0.98
            );
            body.impulseVelocity.x *= damping;
            body.impulseVelocity.y *= damping;

            if (Math.abs(body.impulseVelocity.x) < 1) body.impulseVelocity.x = 0;
            if (Math.abs(body.impulseVelocity.y) < 1) body.impulseVelocity.y = 0;

            body.movementVelocity.x = 0;
            body.movementVelocity.y = 0;
        });

        this.resolveOverlaps();
    }

    private resolveOverlaps(): void {
        const bodies = Array.from(this.activeBodies).filter(body => !body.isStatic && !body.isSensor);

        for (let i = 0; i < bodies.length; i++) {
            const bodyA = bodies[i];
            for (let j = i + 1; j < bodies.length; j++) {
                const bodyB = bodies[j];
                const dx = bodyB.position.x - bodyA.position.x;
                const dy = bodyB.position.y - bodyA.position.y;
                const minDistance = bodyA.radius + bodyB.radius;
                const distance = Math.sqrt(dx * dx + dy * dy) || 0.0001;

                if (distance >= minDistance) {
                    continue;
                }

                const overlap = minDistance - distance;
                const nx = dx / distance;
                const ny = dy / distance;
                const inverseMassA = 1 / Math.max(1, bodyA.mass);
                const inverseMassB = 1 / Math.max(1, bodyB.mass);
                const totalInverseMass = inverseMassA + inverseMassB;

                const pushA = overlap * (inverseMassA / totalInverseMass);
                const pushB = overlap * (inverseMassB / totalInverseMass);

                bodyA.position.x -= nx * pushA;
                bodyA.position.y -= ny * pushA;
                bodyB.position.x += nx * pushB;
                bodyB.position.y += ny * pushB;

                this.clampBodyToBounds(bodyA);
                this.clampBodyToBounds(bodyB);

                bodyA.gameObject?.emit?.('collision', bodyB.gameObject);
                bodyB.gameObject?.emit?.('collision', bodyA.gameObject);
            }
        }
    }

    private clampBodyToBounds(body: KinematicBody): void {
        if (!this.battlefieldBounds) return;

        const minX = this.battlefieldBounds.minX + body.radius;
        const maxX = this.battlefieldBounds.maxX - body.radius;
        const minY = this.battlefieldBounds.minY + body.radius;
        const maxY = this.battlefieldBounds.maxY - body.radius;

        const clampedX = Phaser.Math.Clamp(body.position.x, minX, maxX);
        const clampedY = Phaser.Math.Clamp(body.position.y, minY, maxY);

        if (clampedX !== body.position.x) {
            body.position.x = clampedX;
            body.impulseVelocity.x = 0;
        }

        if (clampedY !== body.position.y) {
            body.position.y = clampedY;
            body.impulseVelocity.y = 0;
        }
    }
}
