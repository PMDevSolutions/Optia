# /test

Run the Optia test suite (Vitest + React Testing Library + jsdom). All commands run from `app/`.

## Usage

```
/test
```

## Steps (from `app/`)

1. **Run all tests:**
   ```bash
   cd app && pnpm test          # vitest run
   ```
2. **Watch mode** (interactive):
   ```bash
   cd app && pnpm test:watch
   ```
3. **Coverage** (`@vitest/coverage-v8` is installed):
   ```bash
   cd app && pnpm vitest run --coverage
   ```
4. **A single file or pattern:**
   ```bash
   cd app && pnpm vitest run src/lib/scoring.test.ts
   cd app && pnpm vitest run -t "renders score label"
   ```

## Notes

- Config: `app/vitest.config.ts` (jsdom environment). `chrome.*` is hand-mocked in `app/src/test/setup.ts`.
- This project has **no** Storybook, Playwright, or E2E tests — Vitest only.
- For chrome / service-worker / OpenAI-SDK mocking patterns and the import-order rule, see the **testing-chrome-extension** skill.
