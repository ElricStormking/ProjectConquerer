export const getPreludeSlides = (): string[] => [
    'story_begining_01_prelude'
];

export const getFinalSlides = (): string[] => [
    'story_begining_01_final'
];

export const STORY_SLIDE_PATHS: Record<string, string> = {
    story_begining_01_prelude: 'assets/StorySlides/begining_01_prelude.png',
    story_begining_01_stage1: 'assets/StorySlides/begining_01_stage1.png',
    story_begining_01_stage3: 'assets/StorySlides/begining_01_stage3.png',
    story_begining_01_stage4: 'assets/StorySlides/begining_01_stage4.png',
    story_begining_01_final: 'assets/StorySlides/begining_01_final.png',
    story_ending_01_stage1: 'assets/StorySlides/ending_01_stage1.png',
    story_ending_01_stage2: 'assets/StorySlides/ending_01_stage2.png',
    story_ending_01_stage3: 'assets/StorySlides/ending_01_stage3.png',
    story_ending_01_stage4: 'assets/StorySlides/ending_01_stage4.png',
    story_ending_01_stage5: 'assets/StorySlides/ending_01_stage5.png'
};

export const getStorySlidePath = (key: string): string | undefined => STORY_SLIDE_PATHS[key];

const STAGE_INTRO_SLIDES: Record<number, string[]> = {
    0: ['story_begining_01_stage1'],
    2: ['story_begining_01_stage3'],
    3: ['story_begining_01_stage4']
};

const STAGE_OUTRO_SLIDES: Record<number, string[]> = {
    0: ['story_ending_01_stage1'],
    1: ['story_ending_01_stage2'],
    2: ['story_ending_01_stage3'],
    3: ['story_ending_01_stage4'],
    4: ['story_ending_01_stage5']
};

export const getStageIntroSlides = (stageIndex: number): string[] =>
    STAGE_INTRO_SLIDES[stageIndex] ?? [];

export const getStageOutroSlides = (stageIndex: number): string[] =>
    STAGE_OUTRO_SLIDES[stageIndex] ?? [];
