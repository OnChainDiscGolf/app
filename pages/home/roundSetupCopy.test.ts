import { describe, expect, it } from 'vitest';
import { getCardmateFlowHelperText, getRoundSetupCourseHelperText, isRoundSetupReady } from './roundSetupCopy';

describe('round setup copy helpers', () => {
    it('requires a non-empty course before setup can continue', () => {
        expect(isRoundSetupReady('')).toBe(false);
        expect(isRoundSetupReady('   ')).toBe(false);
        expect(isRoundSetupReady('Creekside Park')).toBe(true);
    });

    it('returns clear course helper text for invalid and valid setup states', () => {
        expect(getRoundSetupCourseHelperText('')).toBe('Choose a course before continuing.');
        expect(getRoundSetupCourseHelperText('Solitude')).toBe('Course selected. You can continue to players.');
    });

    it('returns solo and multiplayer cardmate helper copy', () => {
        expect(getCardmateFlowHelperText(0)).toBe('You can continue solo or invite players to your card.');
        expect(getCardmateFlowHelperText(1)).toBe('1 cardmate added. You can continue or invite more players.');
        expect(getCardmateFlowHelperText(3)).toBe('3 cardmates added. You can continue or invite more players.');
    });
});
