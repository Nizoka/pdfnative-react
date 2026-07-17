/**
 * Nested lists sample — all three authoring forms.
 *
 * Run with: npx tsx samples/text/nested-lists.tsx
 * Writes `nested-lists.pdf` to the current directory.
 */

import React from 'react';
import {
    Document,
    Heading,
    Item,
    List,
    Paragraph,
    renderToFile,
} from '../../src/index.js';

const doc = (
    <Document title="Nested lists">
        <Heading level={1}>Three ways to nest</Heading>

        <Paragraph>1. HTML-shaped: a child list inside an item.</Paragraph>
        <List>
            <Item>
                Fruits
                <List>
                    <Item>Apple</Item>
                    <Item>Pear</Item>
                </List>
            </Item>
            <Item>Vegetables</Item>
        </List>

        <Paragraph>2. Direct nesting: items inside an item.</Paragraph>
        <List ordered>
            <Item>
                Prepare
                <Item>Install dependencies</Item>
                <Item>Configure the project</Item>
            </Item>
            <Item>Ship</Item>
        </List>

        <Paragraph>3. Data form: `items` with nested objects.</Paragraph>
        <List
            items={[
                { text: 'Europe', items: ['France', { text: 'Spain', items: ['Madrid'] }] },
                'Asia',
            ]}
        />
    </Document>
);

await renderToFile(doc, 'nested-lists.pdf');
console.log('Wrote nested-lists.pdf');
