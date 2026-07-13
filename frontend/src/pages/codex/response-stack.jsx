import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  animate,
  MotionConfig,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";

const roots = new WeakMap();
const stackData = new WeakMap();
const REVEAL_SECONDS = 0.34;
const SCROLL_ANCHOR_MS = Math.ceil(REVEAL_SECONDS * 1000) + 80;
const THREAD_BOTTOM_THRESHOLD_PX = 24;
const REVEAL_TRANSITION = {
  duration: REVEAL_SECONDS,
  ease: [0.33, 1, 0.68, 1],
};
const REDUCED_TRANSITION = { duration: 0 };

function mountAll(root = document) {
  const scope = root ?? document;
  scope.querySelectorAll?.("[data-codex-response-stack]").forEach(mountResponseStack);
}

function unmountAll(root = document) {
  const scope = root ?? document;
  scope.querySelectorAll?.("[data-codex-response-stack]").forEach((target) => {
    const mountedRoot = roots.get(target);
    if (!mountedRoot) return;
    mountedRoot.unmount();
    roots.delete(target);
    stackData.delete(target);
  });
}

function mountResponseStack(target) {
  const nextSections = sectionsFromTemplates(target);
  let sections = nextSections;
  if (nextSections.length > 0) {
    stackData.set(target, nextSections);
  } else {
    sections = stackData.get(target) ?? [];
  }
  if (sections.length === 0) return;

  let mountedRoot = roots.get(target);
  if (!mountedRoot) {
    mountedRoot = createRoot(target);
    roots.set(target, mountedRoot);
  }

  mountedRoot.render(<ResponseStack sections={sections} />);
}

function sectionsFromTemplates(target) {
  return Array.from(target.querySelectorAll("template[data-codex-response-section-template]"))
    .map((template, index) => {
      const type = template.dataset.codexResponseSectionType ?? "html";
      const key = template.dataset.codexResponseSectionKey ?? `${type}-${index}`;
      if (type === "activity") {
        return {
          type,
          key,
          html: template.innerHTML,
          label: template.dataset.codexActivityLabel ?? "",
          initialOpen: template.dataset.codexActivityInitialState === "open",
        };
      }
      return {
        type,
        key,
        html: template.innerHTML,
      };
    });
}

function ResponseStack({ sections }) {
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? REDUCED_TRANSITION : REVEAL_TRANSITION;
  const [activityOpen, setActivityOpen] = useState(() => initialActivityOpen(sections));

  useLayoutEffect(() => {
    setActivityOpen((current) => reconcileActivityOpen(current, sections));
  }, [sections]);

  const setActivitySectionOpen = useCallback((key, open) => {
    setActivityOpen((current) => {
      if (current[key] === open) return current;
      return { ...current, [key]: open };
    });
  }, []);

  return (
    <MotionConfig transition={transition}>
      <div className="codex-response-stack-content" data-codex-response-stack-content="">
        {sections.map((section) => (
          section.type === "activity"
            ? (
              <ActivitySection
                key={section.key}
                open={Boolean(activityOpen[section.key])}
                reducedMotion={reducedMotion}
                section={section}
                setOpen={(open) => setActivitySectionOpen(section.key, open)}
              />
            )
            : (
              <HTMLSection
                key={section.key}
                section={section}
              />
            )
        ))}
      </div>
    </MotionConfig>
  );
}

function initialActivityOpen(sections) {
  return Object.fromEntries(
    sections
      .filter((section) => section.type === "activity")
      .map((section) => [section.key, section.initialOpen]),
  );
}

function reconcileActivityOpen(current, sections) {
  const next = {};
  let changed = false;
  for (const section of sections) {
    if (section.type !== "activity") continue;
    if (Object.prototype.hasOwnProperty.call(current, section.key)) {
      next[section.key] = current[section.key];
    } else {
      next[section.key] = section.initialOpen;
      changed = true;
    }
  }
  for (const key of Object.keys(current)) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      changed = true;
      break;
    }
  }
  return changed ? next : current;
}

function HTMLSection({ section }) {
  return (
    <motion.div
      className="codex-response-stack-section"
      data-codex-response-section={section.type}
      dangerouslySetInnerHTML={{ __html: section.html }}
    />
  );
}

function ActivitySection({ open, reducedMotion, section, setOpen }) {
  const buttonRef = useRef(null);
  const contentRef = useRef(null);
  const detailsRef = useRef(null);
  const firstRenderRef = useRef(true);
  const animationTokenRef = useRef(0);
  const animationsRef = useRef([]);
  const revealProgress = useMotionValue(section.initialOpen ? 1 : 0);
  const hiddenOffset = useMotionValue(0);
  const clipPath = useTransform(
    revealProgress,
    (value) => `inset(0 0 ${Math.max(0, Math.min(100, 100 - (value * 100)))}% 0)`,
  );
  const marginBottom = useTransform(hiddenOffset, (value) => `${value}px`);
  const [contentMounted, setContentMounted] = useState(section.initialOpen);

  useLayoutEffect(() => {
    if (detailsRef.current) detailsRef.current.dataset.state = open ? "open" : "closed";
  }, [open]);

  useLayoutEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      revealProgress.set(open ? 1 : 0);
      hiddenOffset.set(0);
      return undefined;
    }

    stopAnimations(animationsRef.current);
    const token = animationTokenRef.current + 1;
    animationTokenRef.current = token;

    if (reducedMotion) {
      revealProgress.set(open ? 1 : 0);
      hiddenOffset.set(0);
      if (contentMounted !== open) setContentMounted(open);
      return undefined;
    }

    if (open && !contentMounted) {
      setContentMounted(true);
      return undefined;
    }

    if (open) {
      const height = contentRef.current?.scrollHeight ?? 0;
      revealProgress.set(0);
      hiddenOffset.set(-height);
      animationsRef.current = [
        animate(revealProgress, 1, REVEAL_TRANSITION),
        animate(hiddenOffset, 0, REVEAL_TRANSITION),
      ];
      return () => stopAnimations(animationsRef.current);
    }

    if (!contentMounted) {
      revealProgress.set(0);
      hiddenOffset.set(0);
      return undefined;
    }

    const height = contentRef.current?.scrollHeight ?? 0;
    revealProgress.set(1);
    hiddenOffset.set(0);
    const revealAnimation = animate(revealProgress, 0, REVEAL_TRANSITION);
    const offsetAnimation = animate(hiddenOffset, -height, REVEAL_TRANSITION);
    animationsRef.current = [revealAnimation, offsetAnimation];

    Promise.all([revealAnimation.finished, offsetAnimation.finished])
      .then(() => {
        if (animationTokenRef.current !== token) return;
        flushSync(() => setContentMounted(false));
        revealProgress.set(0);
        hiddenOffset.set(0);
      })
      .catch(() => {});

    return () => stopAnimations(animationsRef.current);
  }, [contentMounted, hiddenOffset, open, reducedMotion, revealProgress]);

  const toggle = useCallback(() => {
    preserveScrollDuringToggle(detailsRef.current, buttonRef.current);
    if (!open && !contentMounted) {
      flushSync(() => {
        setContentMounted(true);
        setOpen(true);
      });
      return;
    }
    setOpen(!open);
  }, [contentMounted, open, setOpen]);

  return (
    <motion.div
      className="codex-response-stack-section"
      data-codex-response-section="activity"
    >
      <div className="flex flex-col" data-codex-turn-process="">
        <div className="text-size-chat text-token-text-secondary codex-turn-activity">
          <div
            ref={detailsRef}
            className="codex-turn-activity-details"
            data-state={open ? "open" : "closed"}
            data-codex-activity-label={section.label}
            data-codex-activity-initial-state={section.initialOpen ? "open" : "closed"}
            data-codex-turn-activity=""
          >
            <ActivityHeader
              buttonRef={buttonRef}
              label={section.label}
              open={open}
              onToggle={toggle}
            />
            <ActivityDivider />
            {contentMounted ? (
              <motion.div
                ref={contentRef}
                className="codex-turn-activity-collapsible codex-response-activity-content"
                aria-hidden={open ? "false" : "true"}
                data-codex-turn-activity-content=""
                style={{ clipPath, marginBottom }}
              >
                <ActivityGap />
                <div dangerouslySetInnerHTML={{ __html: section.html }} />
              </motion.div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function stopAnimations(animations) {
  for (const animation of animations) animation.stop();
}

function ActivityHeader({ buttonRef, label, open, onToggle }) {
  const iconHTML = window.CodexIcons?.svg?.(
    "chevronRight",
    `codex-turn-activity-chevron icon-2xs text-token-conversation-summary-trailing transition-transform duration-basic ${open ? "rotate-90" : "rotate-0"}`,
  ) ?? "";

  return (
    <div className="text-size-chat text-token-text-secondary">
      <button
        ref={buttonRef}
        type="button"
        className="text-size-chat hover:bg-token-bg-subtle inline-flex items-center gap-1 rounded-md border border-transparent focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:outline-none"
        aria-expanded={open}
        data-codex-turn-activity-toggle=""
        onClick={onToggle}
      >
        <span><span className="text-token-conversation-body">{label}</span></span>
        <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconHTML }} />
      </button>
    </div>
  );
}

function ActivityDivider() {
  return (
    <div className="text-size-chat pt-1 text-token-text-secondary">
      <div className="w-full border-t border-token-border" />
    </div>
  );
}

function ActivityGap() {
  return (
    <div
      aria-hidden="true"
      className="codex-turn-activity-gap w-full"
    />
  );
}

function preserveScrollDuringToggle(activity, toggle) {
  const scroll = activity?.closest?.("[data-thread-scroll]");
  if (!scroll || !toggle) return;

  if (isScrollNearBottom(scroll)) {
    preserveBottomDistance(scroll);
    return;
  }

  preserveToggleTop(scroll, toggle);
}

function preserveBottomDistance(scroll) {
  const distanceFromBottom = Math.max(0, scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight);
  const startedAt = performance.now();
  const tick = () => {
    if (scroll.isConnected === false) return;
    scroll.scrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight - distanceFromBottom);
    if (performance.now() - startedAt < SCROLL_ANCHOR_MS) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function preserveToggleTop(scroll, toggle) {
  const top = toggle.getBoundingClientRect().top;
  let frame = 0;
  const adjust = () => {
    if (!toggle.isConnected) return;
    scroll.scrollTop += toggle.getBoundingClientRect().top - top;
  };
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      adjust();
    });
  };
  schedule();
  setTimeout(() => {
    if (frame) cancelAnimationFrame(frame);
  }, SCROLL_ANCHOR_MS);
}

function isScrollNearBottom(scroll) {
  return scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= THREAD_BOTTOM_THRESHOLD_PX;
}

window.CodexResponseStack = {
  mountAll,
  unmountAll,
};
