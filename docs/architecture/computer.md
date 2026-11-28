# The computer player

Read this before changing how the computer plays, or the screen against it.
The decisions are in [docs/plan.md](../plan.md), Against the computer.

## Where it lives

- `chooseMove(state, player, bot, random)` (`shared/game/bot.ts`) answers with a cell, or null when it isn't that player's turn.
- It is pure like the rest of the engine, only returns a move `applyMove` accepts, and asks the engine who wins (`completesLine`, through `tactics.ts`, which the analysis of a game uses too).
- It takes its chance from the generator it is given: the same position and numbers give the same move.
- It spends a fixed number of positions, never a time, so a slow device plays the same game as a fast one.
- It runs in the app, in a Web Worker (`src/play/think.ts`, `bot.worker.ts`), with the page itself as the fallback; the room server doesn't use it yet.
- `src/play/ComputerGame.tsx` is the screen at `/computer`; the game itself is `LocalPlay.tsx`, the same as on `/samen`.
- `useComputerMove.ts` asks for a move when it is the computer's turn and plays it after a pause (`thinkingPause`: 0.6 to 1 second on nine cells, 0.9 to 1.3 elsewhere).
- While it is the computer's turn the board is not interactive.
- The status line says where the computer played, for who can't see the board.
- Nothing of a game against the computer is saved: it is not in the played games or the statistics.

## Levels: how well it plays

| Level    | Its own win            | A win of somebody else      | Otherwise                                                                                                 |
| -------- | ---------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `easy`   | takes it 8 times in 10 | blocks it half of the times | half of the time any cell near the marks, else one of the five its character likes best                   |
| `medium` | takes it               | blocks it                   | one of the three cells its character likes best, mostly the best                                          |
| `hard`   | takes it               | blocks it                   | solves a small position, finds a win by threats, or looks ahead; with more than two players the best cell |

- "A win of somebody else" is that of the first player in turn order who has one.
- `hard` solves a position of two players with at most 36 cells and 12 empty ones, so it can't be beaten on 3 × 3 (`bot.test.ts` plays every game against it).
- Otherwise, with two players, it looks for a forced win by threats, searches a few moves ahead (alpha-beta over the best cells) and avoids handing the other a forced win.

## Characters: what it likes to do

- A character is only weights on what a cell is worth (`TASTES` in `bot-value.ts`): its own lines, the lines of others, a threat, and the marks of others next to the cell.
- `balanced` (Gewoon) weighs its own and other lines about evenly.
- `defender` (Verdediger) cares most about cutting off other lines.
- `attacker` (Aanvaller) cares most about its own lines.
- `wild` (Wildebras) attacks, likes a move that threatens to win at once, and likes to sit next to your marks.
- Taking and blocking a win belong to the level, so every character does what its level does there.
- There is no choice of character on a field of nine cells or fewer (`hasCharacters`); the computer is `balanced` there.
- A new character is a name in `BOT_CHARACTERS`, its weights, its texts, and a test with a position in which it picks the cell that suits it.

## What it was measured against

Computer against computer on 2026-11-28, each side starting half of the games; wins, losses and draws are those of the first named.

| Field              | medium – easy | hard – medium |
| ------------------ | ------------- | ------------- |
| 3 × 3 (200 games)  | 131 – 0 – 69  | 1 – 0 – 199   |
| 7 × 7, five (40)   | 39 – 0 – 1    | 7 – 0 – 33    |
| 15 × 15, five (20) | 20 – 0 – 0    | 19 – 0 – 1    |

| 15 × 15, five       | medium (100 games) | hard (12)  |
| ------------------- | ------------------ | ---------- |
| balanced – defender | 43 – 15 – 42       | 0 – 5 – 7  |
| balanced – attacker | 54 – 44 – 2        | 10 – 2 – 0 |
| balanced – wild     | 62 – 28 – 10       | 1 – 11 – 0 |
| defender – attacker | 36 – 46 – 18       | 6 – 6 – 0  |
| defender – wild     | 33 – 32 – 35       | 9 – 0 – 3  |
| attacker – wild     | 47 – 52 – 1        | 6 – 6 – 0  |

- The levels stay in order with every character (`bot.test.ts`).
- The characters are not equally strong, and which is strongest changes with the level.
- In positions where nobody has to win or block, two characters picked different cells in 32 to 55 % of them at `medium` and 15 to 43 % at `hard`; `attacker` and `wild` are the closest at `hard`.
- A move of `hard` on 19 × 19 took about 0.1 second, at most 0.4, on an Apple silicon Mac; the slowest was 0.8, solving a 5 × 5. Phones were not measured.
- Not measured: people playing against it.
