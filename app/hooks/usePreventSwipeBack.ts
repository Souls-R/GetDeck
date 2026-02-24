'use client';

import { useEffect } from 'react';

/**
 * Prevents mobile swipe-back from leaving the SPA when there's no prior history.
 * Pushes a guard state entry; on popstate, re-pushes to trap the user in-app.
 */
export function usePreventSwipeBack() {
    useEffect(() => {
        const guard = { __guard: true };

        if (!history.state?.__guard) {
            history.pushState(guard, '');
        }

        const onPop = () => {
            if (!history.state?.__guard) {
                history.pushState(guard, '');
            }
        };

        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);
}
