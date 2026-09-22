import { Figure } from "@/components/site/figure";
import { RateLimitDemo } from "./rate-limit-demo";

export function RateLimitFigure() {
  return (
    <Figure
      id="1.07"
      caption="fixed window limiter · 5 requests per 10 s · one counter per key"
      reading="Above the dashed line is the browser; below it is the server. Every button press puts a request on the wire and you watch it arrive. The slot boxes are the counter — they fill one at a time and only ever on the server's side — and the thin bar under each key is the window those fills are measured against, sweeping left to right until the window closes and the counter falls back to zero. The colour-coded dots show that each key is counted separately: switch key mid-window and the second counter has not moved."
      whyItMatters="If you ask for rate limiting and get back a check in the frontend that hides the button after five tries, nothing was limited: reloading the page resets it. The thing to ask for is a counter the server keeps, keyed to an identity, with a 429 and a Retry-After header when the allowance runs out. Try Flood 8 on one key, then Advance the clock and switch keys: the refusal belongs to the key, not to you. On sign-in and password reset endpoints this is the difference between guessing a password thousands of times a minute and guessing five."
    >
      <RateLimitDemo />
    </Figure>
  );
}
