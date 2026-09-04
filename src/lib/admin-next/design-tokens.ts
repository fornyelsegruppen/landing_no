export const adminNextDarkThemeCss = `
  @keyframes admin-feedback-reveal {
    to { opacity: 1; }
  }

  .admin-next-theme {
    color-scheme: dark;
    --an-canvas: #080c11;
    --an-sidebar: #0b1118;
    --an-surface: #101821;
    --an-elevated: #151f2a;
    --an-soft: #1a2531;
    --an-border: #263443;
    --an-border-strong: #394b5f;
    --an-text: #f5f7fa;
    --an-muted: #9aa8b8;
    --an-subtle: #8293a6;
    --an-amber: #f4b63f;
    --an-amber-strong: #ffc44d;
    --an-amber-ink: #171108;
    --an-amber-soft: rgba(244, 182, 63, .12);
    --an-danger: #ff7171;
    --an-danger-soft: rgba(255, 113, 113, .11);
    --an-success: #67d9aa;
    --an-success-soft: rgba(103, 217, 170, .10);
    --an-info: #6fb5e8;
    --an-info-soft: rgba(111, 181, 232, .11);
    --an-focus: #ffd166;
    --an-shadow: 0 18px 52px rgba(0, 0, 0, .28);
    --an-surface-base: var(--an-surface);
    --an-surface-raised: var(--an-elevated);
    --an-surface-soft: var(--an-soft);
    --an-text-primary: var(--an-text);
    --an-text-muted: var(--an-muted);
    --an-text-subtle: var(--an-subtle);
    --an-action: var(--an-amber);
    --an-action-hover: var(--an-amber-strong);
    --an-action-ink: var(--an-amber-ink);
    --an-action-soft: var(--an-amber-soft);
    background: var(--an-canvas);
    color: var(--an-text);
  }

  .admin-next-theme * {
    scrollbar-color: var(--an-border-strong) var(--an-canvas);
  }

  .admin-next-theme :focus-visible {
    outline: 2px solid var(--an-focus);
    outline-offset: 3px;
  }

  .admin-next-theme ::selection {
    background: rgba(244, 182, 63, .35);
    color: var(--an-text);
  }

  .admin-next-theme .an-surface {
    border-color: var(--an-border);
    background: var(--an-surface);
    color: var(--an-text);
    box-shadow: var(--an-shadow);
  }

  .admin-next-theme .an-elevated {
    border-color: var(--an-border);
    background: var(--an-elevated);
    color: var(--an-text);
  }

  .admin-next-theme .an-muted { color: var(--an-muted); }
  .admin-next-theme .an-subtle { color: var(--an-subtle); }

  .admin-next-theme .an-cta {
    background: var(--an-amber);
    color: var(--an-amber-ink);
  }

  .admin-next-theme .an-cta:hover { background: var(--an-amber-strong); }

  .admin-next-theme .an-disabled {
    border-color: var(--an-border);
    background: var(--an-soft);
    color: var(--an-subtle);
  }

  .admin-next-theme .an-danger {
    border-color: rgba(255, 113, 113, .38);
    background: var(--an-danger-soft);
    color: var(--an-danger);
  }

  .admin-next-theme .an-success {
    border-color: rgba(103, 217, 170, .32);
    background: var(--an-success-soft);
    color: var(--an-success);
  }

  @media (prefers-reduced-motion: reduce) {
    .admin-next-theme *,
    .admin-next-theme *::before,
    .admin-next-theme *::after {
      scroll-behavior: auto !important;
      animation-duration: .01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .01ms !important;
    }
  }

  @media (forced-colors: active) {
    .admin-next-theme {
      --an-border: CanvasText;
      --an-border-strong: CanvasText;
      --an-text: CanvasText;
      --an-muted: CanvasText;
      --an-subtle: CanvasText;
      --an-action: Highlight;
      --an-action-ink: HighlightText;
      --an-danger: Mark;
      --an-success: LinkText;
      --an-info: LinkText;
      forced-color-adjust: auto;
    }
  }
`;
