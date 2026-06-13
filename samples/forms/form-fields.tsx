/**
 * Form-field sample — interactive AcroForm widgets.
 *
 * Run with: npx tsx samples/forms/form-fields.tsx
 * Writes `form-fields.pdf` to the current directory.
 *
 * Field types: text, multilineText, checkbox, radio, dropdown, listbox.
 */

import React from 'react';
import { Document, FormField, Heading, Spacer, renderToFile } from '../../src/index.js';

const doc = (
    <Document title="Registration form">
        <Heading level={1}>Registration</Heading>
        <Spacer height={8} />

        <FormField fieldType="text" name="fullName" label="Full name" placeholder="Jane Doe" />
        <FormField fieldType="text" name="email" label="Email" placeholder="jane@example.com" required />
        <FormField fieldType="multilineText" name="bio" label="Bio" height={64} />
        <FormField fieldType="checkbox" name="newsletter" label="Subscribe to newsletter" checked />
        <FormField
            fieldType="dropdown"
            name="plan"
            label="Plan"
            options={['Free', 'Pro', 'Enterprise']}
            value="Pro"
        />
        <FormField
            fieldType="listbox"
            name="interests"
            label="Interests"
            options={['PDF', 'React', 'TypeScript']}
        />
    </Document>
);

await renderToFile(doc, 'form-fields.pdf');
console.log('Wrote form-fields.pdf');
