# Tic-Tac-Toe Ultra

Noughts and crosses with many players on one big field, and many more shapes than X and O. A family project.

Version 1 is the game as it exists: 3×3, two players, X and O, played online and live. The game engine is built for more from the start: a bigger field, more players, "k in a row" and more shapes. The first set of seven shapes is drawn by hand, see [docs/reference/shapes.png](docs/reference/shapes.png).

- **Plan and decisions:** [docs/plan.md](docs/plan.md)
- **Way of working:** [AGENTS.md](AGENTS.md)
- **Planning:** the [milestones](https://github.com/VincentSmedinga/tic-tac-toe-ultra/milestones) and the project board "Tic-Tac-Toe Ultra"

## Local development

You need Node 24 and pnpm 12.

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts the app on http://localhost:5173. `pnpm check` runs everything CI will check; the other commands are in [AGENTS.md](AGENTS.md).
