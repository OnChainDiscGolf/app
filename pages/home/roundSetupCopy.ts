/**
 * Small pure helpers for round setup/player-selection copy.
 * Kept outside React components so UX rules are easy to test.
 */

export const isRoundSetupReady = (courseName: string): boolean => courseName.trim().length > 0;

export const getRoundSetupCourseHelperText = (courseName: string): string => {
    if (isRoundSetupReady(courseName)) return 'Course selected. You can continue to players.';
    return 'Choose a course before continuing.';
};

export const getCardmateFlowHelperText = (cardmateCount: number): string => {
    if (cardmateCount === 0) {
        return 'You can continue solo or invite players to your card.';
    }

    if (cardmateCount === 1) {
        return '1 cardmate added. You can continue or invite more players.';
    }

    return `${cardmateCount} cardmates added. You can continue or invite more players.`;
};
