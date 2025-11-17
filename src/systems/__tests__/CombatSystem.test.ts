import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatSystem, DamageType } from '../CombatSystem';

// Minimal stubs to avoid pulling Phaser in tests
function createStubScene() {
	const tweens = { add: vi.fn() };
	const group = { add: vi.fn(), remove: vi.fn() };
	return {
		add: {
			group: vi.fn(() => group),
			text: vi.fn(() => ({
				destroy: vi.fn(),
			})),
		},
		tweens,
		events: {
			emit: vi.fn(),
		},
		time: {
			addEvent: vi.fn(() => ({ destroy: vi.fn() })),
		},
	} as unknown as Phaser.Scene;
}

type Vector = { x: number; y: number };

function makeUnit(overrides: Partial<Record<string, unknown>> = {}) {
	let hp = 100;
	const position: Vector = { x: 0, y: 0 };
	let facing = 0; // radians
	const base = {
		getPosition: () => position,
		getFacing: () => facing,
		setFacing: (rad: number) => {
			facing = rad;
		},
		isDead: () => hp <= 0,
		getArmor: () => 0,
		getMass: () => 1,
		getCritChance: () => 0,
		getCritMultiplier: () => 2,
		takeDamage: (dmg: number) => {
			hp -= dmg;
		},
		getHp: () => hp,
		applyImpulse: vi.fn(),
		addStatusEffect: vi.fn(),
		setAttackSpeedMultiplier: vi.fn(),
		setMoveSpeedMultiplier: vi.fn(),
		setFriction: vi.fn(),
		setAccuracy: vi.fn(),
		on: vi.fn(),
	} as unknown as any;
	return Object.assign(base, overrides);
}

describe('CombatSystem', () => {
	let scene: Phaser.Scene;
	let combat: CombatSystem;

	beforeEach(() => {
		scene = createStubScene();
		// UnitManager is not used in dealDamage path; pass stub
		combat = new CombatSystem(scene, { getAllUnits: () => [] } as any);
		vi.spyOn(Math, 'random').mockReturnValue(0.99); // no crits by default
	});

	it('applies armor facing modifiers (front < side < rear)', () => {
		const attacker = makeUnit({ getPosition: () => ({ x: 10, y: 0 }) });
		const target = makeUnit({
			getPosition: () => ({ x: 0, y: 0 }),
			getFacing: () => 0, // facing +X (towards attacker), so attacker is in front
		});

		const before = target.getHp();
		combat.dealDamage(attacker as any, target as any, 100, DamageType.PHYSICAL);
		const frontDamage = before - target.getHp();
		expect(frontDamage).toBe(70); // 100 * 0.7, no armor, rounded

		// side: rotate target to face up, attacker at +x is side
		const sideTarget = makeUnit({
			getPosition: () => ({ x: 0, y: 0 }),
			getFacing: () => Math.PI / 2,
		});
		const before2 = sideTarget.getHp();
		combat.dealDamage(attacker as any, sideTarget as any, 100, DamageType.PHYSICAL);
		const sideDamage = before2 - sideTarget.getHp();
		expect(sideDamage).toBe(100);

		// rear: target faces -X, attacker at +x is rear
		const rearTarget = makeUnit({
			getPosition: () => ({ x: 0, y: 0 }),
			getFacing: () => Math.PI,
		});
		const before3 = rearTarget.getHp();
		combat.dealDamage(attacker as any, rearTarget as any, 100, DamageType.PHYSICAL);
		const rearDamage = before3 - rearTarget.getHp();
		expect(rearDamage).toBe(150);
	});

	it('respects target armor with minimum damage of 1', () => {
		const attacker = makeUnit({ getPosition: () => ({ x: 1, y: 0 }) });
		const target = makeUnit({
			getPosition: () => ({ x: 0, y: 0 }),
			getFacing: () => 0,
			getArmor: () => 69,
		});
		const before = target.getHp();
		combat.dealDamage(attacker as any, target as any, 100, DamageType.PHYSICAL); // front 0.7 -> 70 - 69 = 1
		expect(before - target.getHp()).toBe(1);
	});

	it('applies crit multiplier when random < crit chance', () => {
		const attacker = makeUnit({
			getPosition: () => ({ x: 1, y: 0 }),
			getCritChance: () => 1, // always crit
			getCritMultiplier: () => 3,
		});
		const target = makeUnit({
			getPosition: () => ({ x: 0, y: 0 }),
			getFacing: () => 0,
			getArmor: () => 0,
		});
		const before = target.getHp();
		combat.dealDamage(attacker as any, target as any, 10, DamageType.PHYSICAL); // front 0.7 -> 7 * 3 = 21
		expect(before - target.getHp()).toBe(21);
	});
});


