import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { IconContext } from '@phosphor-icons/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { route as routeFn } from 'ziggy-js';
import { initializeTheme } from './hooks/use-appearance';

declare global {
    const route: typeof routeFn;
}

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        // Every icon is drawn solid unless it asks for another weight...
        root.render(
            <IconContext.Provider value={{ weight: 'fill', size: 24 }}>
                <App {...props} />
            </IconContext.Provider>,
        );
    },
    progress: {
        color: '#a5b4fc',
    },
});

// This will set light / dark mode on load...
initializeTheme();
