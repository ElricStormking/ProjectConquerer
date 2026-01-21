import Phaser from 'phaser';

interface StorySlidesSceneData {
    slideKeys: string[];
    returnSceneKey?: string;
    nextSceneKey?: string;
    nextSceneData?: Record<string, unknown>;
    onComplete?: () => void;
}

export class StorySlidesScene extends Phaser.Scene {
    private slideKeys: string[] = [];
    private slideIndex = 0;
    private slideImage?: Phaser.GameObjects.Image;
    private hintText?: Phaser.GameObjects.Text;
    private returnSceneKey?: string;
    private nextSceneKey?: string;
    private nextSceneData?: Record<string, unknown>;
    private onComplete?: () => void;

    constructor() {
        super({ key: 'StorySlidesScene' });
    }

    create(data: StorySlidesSceneData): void {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(0x000000);

        this.slideKeys = (data.slideKeys ?? []).filter(key => this.textures.exists(key));
        this.returnSceneKey = data.returnSceneKey;
        this.nextSceneKey = data.nextSceneKey;
        this.nextSceneData = data.nextSceneData;
        this.onComplete = data.onComplete;

        if (this.slideKeys.length === 0) {
            this.finishSlides();
            return;
        }

        this.slideImage = this.add.image(width / 2, height / 2, this.slideKeys[0]);
        this.slideImage.setDisplaySize(width, height);
        this.slideImage.setInteractive({ useHandCursor: true });
        this.slideImage.on('pointerup', () => this.advanceSlide());

        this.hintText = this.add.text(width - 24, height - 24, 'Click to continue', {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: '#f0dba5'
        }).setOrigin(1);
    }

    private advanceSlide(): void {
        this.slideIndex += 1;
        if (this.slideIndex >= this.slideKeys.length) {
            this.finishSlides();
            return;
        }
        if (this.slideImage) {
            this.slideImage.setTexture(this.slideKeys[this.slideIndex]);
        }
    }

    private finishSlides(): void {
        if (this.onComplete) {
            this.onComplete();
        }

        if (this.returnSceneKey) {
            if (this.scene.isPaused(this.returnSceneKey)) {
                this.scene.resume(this.returnSceneKey);
            }
        }

        if (this.nextSceneKey) {
            this.scene.start(this.nextSceneKey, this.nextSceneData);
        }

        this.scene.stop();
    }
}
