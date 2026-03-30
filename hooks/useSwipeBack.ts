/**
 * @file useSwipeBack.ts
 * @description Hook that enables iOS-style swipe-from-left-edge gesture
 * to navigate back in the browser history. Detects touch events starting
 * from the left 100px (or 20%) of the screen, requires a horizontal swipe
 * of at least 100px with less than 100px vertical movement, and calls
 * `navigate(-1)` unless the user is already at the root route.
 */

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Hook that adds swipe-from-left-edge back navigation.
 *
 * Registers `touchstart` and `touchend` listeners on the document.
 * A valid back-swipe requires:
 * 1. Touch starts within the left 100px or 20% of the viewport
 * 2. Horizontal delta > 100px (rightward)
 * 3. Vertical delta < 100px (prevents triggering during vertical scrolls)
 * 4. Current route is not `'/'` (prevents navigating out of the app)
 *
 * Uses a ref for the current location to avoid stale closures.
 */
export const useSwipeBack = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);
    const locationRef = useRef(location);
    locationRef.current = location;

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            // Only trigger if starting from the left edge (first 100px or 20% of screen)
            const isLeftEdge = e.touches[0].clientX < 100 || e.touches[0].clientX < window.innerWidth * 0.20;

            if (isLeftEdge) {
                touchStartRef.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
            } else {
                touchStartRef.current = null;
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!touchStartRef.current) return;

            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;

            const deltaX = touchEndX - touchStartRef.current.x;
            const deltaY = Math.abs(touchEndY - touchStartRef.current.y);

            // Conditions for a valid back swipe:
            // 1. Swiped right significantly (> 100px)
            // 2. Mostly horizontal movement (deltaY < 100px)
            if (deltaX > 100 && deltaY < 100) {
                // Don't navigate back if already on root (prevents leaving the app)
                if (locationRef.current.pathname === '/') return;
                navigate(-1);
            }

            touchStartRef.current = null;
        };

        document.addEventListener('touchstart', handleTouchStart);
        document.addEventListener('touchend', handleTouchEnd);

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [navigate]);
};
