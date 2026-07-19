import { Html, Head, Main, NextScript } from "next/document";

// Keep the id list in sync with THEMES in src/lib/themes.ts — this runs before
// hydration so the saved theme lands before first paint (no flash of default).
const THEME_BOOT = `try{var t=localStorage.getItem("dtc-theme");if(t&&["night-shift","blueprint","day-shift","redline","hi-vis"].indexOf(t)>-1)document.documentElement.dataset.theme=t;}catch(e){}`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
