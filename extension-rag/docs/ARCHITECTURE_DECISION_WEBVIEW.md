# Architecture Decision: Webview UI Approach

**Date:** 2026-01-29
**Status:** Approved
**Decision:** Use native VS Code CSS instead of @vscode/webview-ui-toolkit
**Context:** VS Code extension for RAG MCP Server interaction

## Context

During the development of the RAG MCP VS Code extension, we needed to decide on the UI approach for Webview panels. The initial plan (T6.3) specified installing `vscode-webview-ui-toolkit`, but research revealed:

1. **Correct package name:** `@vscode/webview-ui-toolkit` (official Microsoft package)
2. **Current implementation:** Simple HTML + native VS Code CSS via `var(--vscode-*)`
3. **Project goals:** Stable, maintainable, low-complexity v1 extension

## Decision Drivers

### 1. Project Stage

- **Current:** v0.1.0 initial setup
- **Focus:** Core functionality over rich UI
- **Risk:** Early complexity could hinder stability

### 2. UI Requirements

- **Dashboard:** Status display, refresh buttons, project lists
- **Query interface:** Search input, results list, file opening
- **Control panels:** Simple forms, progress indicators
- **No need for:** Complex components, data grids, charts (v1)

### 3. Technical Considerations

- **Dependencies:** Minimize external packages for stability
- **Coupling:** Avoid tight coupling to specific UI framework
- **Maintenance:** Native CSS is simpler to maintain
- **Performance:** Lightweight approach for extension startup

## Options Considered

### Option A: @vscode/webview-ui-toolkit

**Pros:**

- Native VS Code look and feel
- Pre-built components (buttons, checkboxes, tables)
- Automatic theme support (dark/light)
- Official Microsoft maintenance

**Cons:**

- Additional dependency (coupling)
- Learning curve for team
- Potentially overkill for simple UI
- Migration effort if requirements change

### Option B: Native VS Code CSS (`var(--vscode-*)`)

**Pros:**

- Zero external dependencies
- Simple and lightweight
- Full control over HTML/CSS
- Easy to understand and maintain
- Stable across VS Code versions

**Cons:**

- Manual styling required
- Basic UI components only
- More work for complex UI

### Option C: Other UI Framework (React, Svelte, etc.)

**Pros:**

- Rich component ecosystems
- Developer familiarity
- Reusable patterns

**Cons:**

- Heavyweight for extension
- Bundle size concerns
- Complex build configuration
- Over-engineering for v1

## Decision

**Use Native VS Code CSS (`var(--vscode-*)`) for v1.0**

### Rationale

1. **Simplicity Principle:** "Avoid complexity too early" - the extension's primary value is MCP integration, not UI richness.
2. **Stability Focus:** Fewer dependencies = fewer breaking changes.
3. **Development Speed:** Faster iteration without framework constraints.
4. **Migration Path:** We can migrate to `@vscode/webview-ui-toolkit` in v2.x if UI requirements become more complex.

### Implementation Guidelines

#### CSS Usage

```css
/* Use VS Code theme tokens */
body {
  font-family: var(--vscode-font-family);
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  padding: 20px;
}

.button {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 8px 16px;
}

.input {
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
}
```

#### HTML Structure

```html
<div class="container">
  <h1>RAG MCP Dashboard</h1>
  <div class="status-section">
    <p>Connected: <span class="status-indicator">✅</span></p>
    <button class="button refresh-btn">Refresh</button>
  </div>
</div>
```

#### File Organization

```
extension-rag/
├── src/
│   ├── views/
│   │   ├── DashboardView.ts
│   │   ├── QueryView.ts
│   │   └── styles.css    # Shared CSS tokens
│   └── ...
└── docs/
    └── ARCHITECTURE_DECISION_WEBVIEW.md
```

## Consequences

### Positive

- ✅ **Reduced complexity:** Fewer dependencies, simpler build
- ✅ **Faster development:** No framework learning curve
- ✅ **Better performance:** Smaller bundle size
- ✅ **Easier maintenance:** Pure HTML/CSS is straightforward
- ✅ **Flexibility:** Can mix native and custom styling

### Negative

- ⚠️ **More manual work:** Need to style components manually
- ⚠️ **Basic UI only:** Limited to simple components
- ⚠️ **Theme consistency:** Must manually ensure VS Code theme compliance

## Migration Strategy

If UI requirements evolve in v2.x:

1. **Assessment:** Evaluate if @vscode/webview-ui-toolkit provides needed components
2. **Incremental migration:** Replace individual components, not entire UI
3. **Backwards compatibility:** Maintain CSS fallbacks during transition
4. **Testing:** Ensure theme compatibility across VS Code versions

## Related Decisions

- **T6.3:** Updated to "UI Webview minimaliste et stable" (CSS native)
- **T8.x:** Dashboard implementation using native CSS
- **Future:** Potential v2.x migration to @vscode/webview-ui-toolkit

## Notes

> **Architectural Principle:** "A system rarely dies from lack of features. It dies from excessive complexity too early."

This decision aligns with our goal of delivering a stable, maintainable v1 extension that focuses on core MCP integration functionality while keeping the door open for UI enhancements in future versions.
