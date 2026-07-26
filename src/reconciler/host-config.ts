/**
 * react-reconciler host configuration for pdfnative-react.
 *
 * The host environment is not a DOM — it is an in-memory tree of {@link HostNode}
 * values. We implement the minimal mutation-mode surface required to build and
 * update that tree; rendering to PDF happens afterwards in {@link serialize}.
 *
 * Targets the `react-reconciler@0.31` runtime with `@types/react-reconciler@0.32`
 * typings (React 19 line).
 */

import { createContext } from 'react';
import ReactReconciler, { type HostConfig } from 'react-reconciler';
import { DefaultEventPriority } from 'react-reconciler/constants.js';
import {
    type ElementNode,
    type HostNode,
    type HostTag,
    type RootContainer,
    type TextNode,
    createElementNode,
    createTextNode,
    isElementNode,
} from './nodes.js';

type Props = Record<string, unknown>;
type Container = RootContainer;
type Instance = ElementNode;
type TextInstance = TextNode;
type TransitionStatus = null;

// React's reconciler treats a `null` host context as "no context" and throws
// "Expected host context to exist". We have no real context, so we hand back a
// single stable, frozen sentinel object instead.
const HOST_CONTEXT = /* @__PURE__ */ Object.freeze({});
type HostContext = typeof HOST_CONTEXT;

function appendChild(parent: Instance | Container, child: HostNode): void {
    parent.children.push(child);
}

function removeChild(parent: Instance | Container, child: HostNode): void {
    const index = parent.children.indexOf(child);
    if (index !== -1) parent.children.splice(index, 1);
}

function insertBefore(parent: Instance | Container, child: HostNode, before: HostNode): void {
    const index = parent.children.indexOf(before);
    parent.children.splice(index === -1 ? parent.children.length : index, 0, child);
}

let currentUpdatePriority = DefaultEventPriority;

type Config = HostConfig<
    HostTag, // Type
    Props, // Props
    Container, // Container
    Instance, // Instance
    TextInstance, // TextInstance
    never, // SuspenseInstance
    never, // HydratableInstance
    never, // FormInstance
    Instance, // PublicInstance
    HostContext, // HostContext
    never, // ChildSet
    number, // TimeoutHandle
    number, // NoTimeout
    TransitionStatus // TransitionStatus
>;

const hostConfig: Config = {
    supportsMutation: true,
    supportsPersistence: false,
    supportsHydration: false,
    isPrimaryRenderer: false,
    noTimeout: -1,

    createInstance(type, props) {
        return createElementNode(type, props);
    },
    createTextInstance(text) {
        return createTextNode(text);
    },

    appendInitialChild(parent, child) {
        appendChild(parent, child);
    },
    appendChild,
    appendChildToContainer(container, child) {
        appendChild(container, child);
    },
    insertBefore,
    insertInContainerBefore(container, child, before) {
        insertBefore(container, child, before);
    },
    removeChild,
    removeChildFromContainer(container, child) {
        removeChild(container, child);
    },

    finalizeInitialChildren() {
        return false;
    },
    commitUpdate(instance, _type, _prevProps, nextProps) {
        instance.props = nextProps;
    },
    commitTextUpdate(textInstance, _oldText, newText) {
        textInstance.text = newText;
    },
    shouldSetTextContent() {
        return false;
    },
    clearContainer(container) {
        container.children.length = 0;
    },

    getRootHostContext() {
        return HOST_CONTEXT;
    },
    getChildHostContext() {
        return HOST_CONTEXT;
    },
    getPublicInstance(instance) {
        return instance as Instance;
    },

    prepareForCommit() {
        return null;
    },
    resetAfterCommit() {
        /* serialization is performed explicitly by the caller */
    },
    preparePortalMount() {
        /* no-op */
    },

    scheduleTimeout: setTimeout,
    cancelTimeout: clearTimeout,

    supportsMicrotasks: true,
    scheduleMicrotask:
        typeof queueMicrotask === 'function'
            ? queueMicrotask
            : (cb: () => void): void => void Promise.resolve().then(cb),

    getInstanceFromNode() {
        return null;
    },
    beforeActiveInstanceBlur() {
        /* no-op */
    },
    afterActiveInstanceBlur() {
        /* no-op */
    },
    prepareScopeUpdate() {
        /* no-op */
    },
    getInstanceFromScope() {
        return null;
    },
    detachDeletedInstance() {
        /* no-op */
    },

    // ── Transition / priority surface (react-reconciler 0.31+) ──────────────
    NotPendingTransition: null,
    // `/* @__PURE__ */` matters here: a bare call inside this object literal is
    // a side effect a bundler cannot prove away, which pins the entire
    // `hostConfig` — and with it the whole reconciler — into any bundle that
    // imports *anything* from the package, including `version` or `schema()`.
    HostTransitionContext: /* @__PURE__ */ createContext<TransitionStatus>(
        null,
    ) as unknown as Config['HostTransitionContext'],
    setCurrentUpdatePriority(newPriority) {
        currentUpdatePriority = newPriority;
    },
    getCurrentUpdatePriority() {
        return currentUpdatePriority;
    },
    resolveUpdatePriority() {
        return currentUpdatePriority || DefaultEventPriority;
    },
    resetFormInstance() {
        /* no-op */
    },
    requestPostPaintCallback() {
        /* no-op */
    },
    shouldAttemptEagerTransition() {
        return false;
    },
    trackSchedulerEvent() {
        /* no-op */
    },
    resolveEventType() {
        return null;
    },
    resolveEventTimeStamp() {
        return -1.1;
    },

    // ── Suspense-on-commit surface (unused: we never suspend) ───────────────
    maySuspendCommit() {
        return false;
    },
    preloadInstance() {
        return true;
    },
    startSuspendingCommit() {
        /* no-op */
    },
    suspendInstance() {
        /* no-op */
    },
    waitForCommitToBeReady() {
        return null;
    },
};

// `/* @__PURE__ */` so a bundler may drop this when nothing imports the
// reconciler. Without it, every consumer — including one importing only
// `version` or `validateSpec` — pays for the whole React renderer.
export const reconciler = /* @__PURE__ */ ReactReconciler(hostConfig);

export { isElementNode };
