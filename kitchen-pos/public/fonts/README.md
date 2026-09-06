# Fonts

The UI is set in **Programme**, loaded from `Programme-Regular.woff2` in this
directory by `app/layout.tsx`.

## Using a different typeface

`next/font/local` resolves this path at build time, so a fork that swaps the
font has to change both the file and the reference — deleting the `.woff2`
without editing `layout.tsx` fails the build rather than falling back.

1. Drop your `.woff2` in this directory.
2. Point the `src` path in `app/layout.tsx` at it, and rename the `localFont`
   variable and its `--font-programme` CSS variable to match.

To use a Google font instead, replace the `next/font/local` import with
`next/font/google` and delete the file here:

```ts
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-programme" });
```

Keeping the CSS variable name means `globals.css` needs no change. The
`fallback` list in `layout.tsx` (`system-ui`, Arial, sans-serif) is what
renders before the webfont loads or if it fails.

## Licensing

Check that your font's license permits redistribution before committing the
file — a webfont committed to a public repo is being redistributed to everyone
who clones it. Fonts served from Google Fonts avoid the question entirely.

If you have the face in TTF/OTF, convert it with
[transfonter.org](https://transfonter.org/) or
[cloudconvert](https://cloudconvert.com/ttf-to-woff2).
