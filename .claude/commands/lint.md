# /lint

Lint and type-check the Optia extension. **This project uses ESLint only — there is no Prettier.**

## Usage

```
/lint
```

## Steps (all run from `app/`)

1. **Lint**
   ```bash
   cd app && pnpm lint
   ```
2. **Auto-fix** what's mechanically fixable
   ```bash
   cd app && pnpm lint:fix
   ```
3. **Type-check** (no emit)
   ```bash
   cd app && pnpm tsc --noEmit
   ```

## Notes

- ESLint config is `app/eslint.config.js` (flat config: `@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`).
- Do **not** run `pnpm prettier` — Prettier is not a dependency and there is no Prettier config.
- Build scripts (`app/scripts/*.mjs`) are covered by a Node-globals override in the ESLint config.
