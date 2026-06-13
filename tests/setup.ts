/**
 * Vitest global setup.
 *
 * Ensures React Testing Library unmounts components and clears the jsdom DOM
 * between tests so object URLs and effects do not leak across cases.
 */

import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom does not implement object URLs; provide deterministic stubs so the
// browser hooks/components can be exercised under test.
if (typeof URL.createObjectURL !== 'function') {
    let counter = 0;
    URL.createObjectURL = vi.fn(() => `blob:pdfnative-react/${++counter}`);
    URL.revokeObjectURL = vi.fn();
}

afterEach(() => {
    cleanup();
});
