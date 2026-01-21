export const getPreludeSlides = (): string[] => [
    'story_begining_01_prelude'
];

export const getFinalSlides = (): string[] => [
    'story_begining_01_final'
];

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
