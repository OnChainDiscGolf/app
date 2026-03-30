/**
 * @file GuidedTour.tsx
 * @description Interactive guided tour overlay that highlights UI elements
 * with a spotlight cutout and shows tooltips with step-by-step instructions.
 * Completion state is persisted to localStorage so each tour is shown only once.
 * Also exports {@link useTourStatus} and {@link resetTour} helpers.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Configuration for a single step in a guided tour.
 *
 * @property targetId - DOM element ID to spotlight.
 * @property title - Step heading displayed in the tooltip.
 * @property content - Descriptive text for the step.
 * @property position - Preferred tooltip placement relative to the target. Auto-detected if omitted.
 */
export interface TourStep {
    targetId: string;
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Props for the {@link GuidedTour} component.
 *
 * @property tourId - Unique identifier for this tour (used as localStorage key).
 * @property steps - Ordered array of tour steps.
 * @property onComplete - Callback invoked when the tour finishes (all steps or skipped).
 * @property onSkip - Optional callback invoked specifically when the user skips.
 */
interface GuidedTourProps {
    tourId: string;
    steps: TourStep[];
    onComplete: () => void;
    onSkip?: () => void;
}

/** Computed tooltip position and arrow direction. */
interface TooltipPosition {
    top: number;
    left: number;
    arrowPosition: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Full-screen guided tour overlay rendered via React portal.
 *
 * Creates a dark overlay with a spotlight cutout around the current step's
 * target element, a pulsing highlight ring, and a positioned tooltip with
 * navigation controls. Automatically determines the best tooltip placement
 * based on available viewport space. Persists completion to localStorage
 * under `tour_{tourId}_completed`.
 *
 * @param props - {@link GuidedTourProps}
 * @returns A portal-rendered overlay, or `null` if position cannot be calculated.
 */
export const GuidedTour: React.FC<GuidedTourProps> = ({
    tourId,
    steps,
    onComplete,
    onSkip,
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    const step = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;

    const calculatePosition = useCallback(() => {
        if (!step) return;

        const element = document.getElementById(step.targetId);
        if (!element) {
            console.warn(`Tour target element not found: ${step.targetId}`);
            return;
        }

        const rect = element.getBoundingClientRect();
        setTargetRect(rect);

        const tooltipWidth = 280;
        const tooltipHeight = 160;
        const padding = 12;
        const arrowSize = 10;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Determine best position
        let position = step.position || 'bottom';
        let top = 0;
        let left = 0;

        // Auto-detect best position if not specified
        if (!step.position) {
            const spaceAbove = rect.top;
            const spaceBelow = viewportHeight - rect.bottom;
            const spaceLeft = rect.left;
            const spaceRight = viewportWidth - rect.right;

            if (spaceBelow >= tooltipHeight + padding) {
                position = 'bottom';
            } else if (spaceAbove >= tooltipHeight + padding) {
                position = 'top';
            } else if (spaceRight >= tooltipWidth + padding) {
                position = 'right';
            } else if (spaceLeft >= tooltipWidth + padding) {
                position = 'left';
            } else {
                position = 'bottom'; // fallback
            }
        }

        // Calculate position based on direction
        switch (position) {
            case 'bottom':
                top = rect.bottom + padding + arrowSize;
                left = rect.left + rect.width / 2 - tooltipWidth / 2;
                break;
            case 'top':
                top = rect.top - tooltipHeight - padding - arrowSize;
                left = rect.left + rect.width / 2 - tooltipWidth / 2;
                break;
            case 'right':
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
                left = rect.right + padding + arrowSize;
                break;
            case 'left':
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
                left = rect.left - tooltipWidth - padding - arrowSize;
                break;
        }

        // Keep tooltip within viewport
        left = Math.max(padding, Math.min(left, viewportWidth - tooltipWidth - padding));
        top = Math.max(padding, Math.min(top, viewportHeight - tooltipHeight - padding));

        setTooltipPosition({ top, left, arrowPosition: position });
    }, [step]);

    useEffect(() => {
        calculatePosition();

        // Recalculate on resize/scroll
        const handleResize = () => calculatePosition();
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleResize, true);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleResize, true);
        };
    }, [calculatePosition, currentStep]);

    const handleNext = () => {
        if (isLastStep) {
            localStorage.setItem(`tour_${tourId}_completed`, 'true');
            onComplete();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleSkip = () => {
        localStorage.setItem(`tour_${tourId}_completed`, 'true');
        onSkip?.();
        onComplete();
    };

    if (!step || !tooltipPosition || !targetRect) {
        return null;
    }

    // Arrow styles based on position
    const getArrowStyles = (): React.CSSProperties => {
        const arrowSize = 10;
        const base: React.CSSProperties = {
            position: 'absolute',
            width: 0,
            height: 0,
            borderStyle: 'solid',
        };

        switch (tooltipPosition.arrowPosition) {
            case 'bottom': // Arrow points UP (tooltip is below target)
                return {
                    ...base,
                    top: -arrowSize,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
                    borderColor: 'transparent transparent rgb(30 41 59) transparent',
                };
            case 'top': // Arrow points DOWN (tooltip is above target)
                return {
                    ...base,
                    bottom: -arrowSize,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
                    borderColor: 'rgb(30 41 59) transparent transparent transparent',
                };
            case 'right': // Arrow points LEFT (tooltip is to the right)
                return {
                    ...base,
                    left: -arrowSize,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
                    borderColor: 'transparent rgb(30 41 59) transparent transparent',
                };
            case 'left': // Arrow points RIGHT (tooltip is to the left)
                return {
                    ...base,
                    right: -arrowSize,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
                    borderColor: 'transparent transparent transparent rgb(30 41 59)',
                };
            default:
                return base;
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100]">
            {/* Overlay with spotlight cutout */}
            <svg className="absolute inset-0 w-full h-full">
                <defs>
                    <mask id="spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        <rect
                            x={targetRect.left - 4}
                            y={targetRect.top - 4}
                            width={targetRect.width + 8}
                            height={targetRect.height + 8}
                            rx="12"
                            fill="black"
                        />
                    </mask>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.75)"
                    mask="url(#spotlight-mask)"
                />
            </svg>

            {/* Highlight ring around target */}
            <div
                className="absolute border-2 border-brand-primary rounded-xl pointer-events-none animate-pulse"
                style={{
                    top: targetRect.top - 4,
                    left: targetRect.left - 4,
                    width: targetRect.width + 8,
                    height: targetRect.height + 8,
                    boxShadow: '0 0 20px rgba(45, 212, 191, 0.4)',
                }}
            />

            {/* Tooltip */}
            <div
                className="absolute bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4 animate-in zoom-in-95 fade-in duration-200"
                style={{
                    top: tooltipPosition.top,
                    left: tooltipPosition.left,
                    width: 280,
                    zIndex: 101,
                }}
            >
                {/* Arrow */}
                <div style={getArrowStyles()} />

                {/* Step indicator */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-400 font-medium">
                        Step {currentStep + 1} of {steps.length}
                    </span>
                    <div className="flex space-x-1">
                        {steps.map((_, idx) => (
                            <div
                                key={idx}
                                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                    idx === currentStep
                                        ? 'bg-brand-primary'
                                        : idx < currentStep
                                        ? 'bg-brand-primary/50'
                                        : 'bg-slate-600'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-white font-bold text-lg mb-2">{step.title}</h3>

                {/* Content */}
                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                    {step.content}
                </p>

                {/* Actions */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={handleSkip}
                        className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        Skip tour
                    </button>
                    <button
                        onClick={handleNext}
                        className="px-4 py-2 bg-brand-primary text-black font-bold text-sm rounded-lg hover:bg-brand-primary/90 transition-colors flex items-center space-x-1"
                    >
                        <span>{isLastStep ? "Let's Play!" : 'Next'}</span>
                        {!isLastStep && (
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

/**
 * Hook to check whether a specific guided tour should be shown.
 *
 * Reads `tour_{tourId}_completed` from localStorage. Returns `true` if the
 * tour has NOT been completed yet.
 *
 * @param tourId - Unique tour identifier.
 * @returns `true` if the tour should be displayed to the user.
 */
export const useTourStatus = (tourId: string): boolean => {
    const [shouldShow, setShouldShow] = useState(false);

    useEffect(() => {
        const completed = localStorage.getItem(`tour_${tourId}_completed`);
        setShouldShow(!completed);
    }, [tourId]);

    return shouldShow;
};

/**
 * Reset a guided tour's completion state so it will be shown again.
 * Useful for development and testing.
 *
 * @param tourId - Unique tour identifier to reset.
 */
export const resetTour = (tourId: string): void => {
    localStorage.removeItem(`tour_${tourId}_completed`);
};














