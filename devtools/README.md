# Dev-only preview pages

These are **not part of the product** and are deliberately kept OUT of `src/pages/` so Next never
compiles them into a production build.

`tree-pilot.tsx` imports the tree JSON directly — **including `faultSeeds`, the answer key** for
the live diagnostic cases. A `getStaticProps` 404 guard is NOT sufficient protection: Next still
emits the page's JS chunk to `/_next/static/chunks/pages/`, and that chunk is publicly fetchable
(the build manifest lists it). The only safe answer is for the file not to be a page at all.

## To use one locally

```bash
cp devtools/tree-pilot.tsx src/pages/     # or gear-pilot.tsx
npm run dev                               # visit /tree-pilot
rm src/pages/tree-pilot.tsx               # REMOVE BEFORE COMMITTING
```
