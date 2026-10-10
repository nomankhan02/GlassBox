import { Figure } from "@/components/site/figure";
import { SessionsTokenDemo } from "./sessions-token-demo";

export function SessionsTokenFigure() {
  return (
    <Figure
      id="1.05"
      caption="two rows · state on the server or on the client · one log-in, one revoke"
      reading="Below is the 1.05 diagram made to move. Switch between Session and Token, press Log in, and watch where the state lands. In session mode a row appears in the server-side sessions table and the client is handed only a random id. In token mode the client is handed a signed token carrying the claims, and the sessions table stays empty — watch it, because that emptiness is the point. Press Make a request: the session is found by a lookup, the token is verified by recomputing its signature. Then press Revoke this login. In session mode the row is deleted and the next request fails on the spot. In token mode nothing is deleted, because there is nothing to delete: the token stays valid until its exp passes, and the only control that helps is advancing the clock past it."
      whyItMatters="Both are memory, and they fail in opposite directions. A session is revoked by one delete and the login ends everywhere at once, but the store is shared state you have to run and scale. A token keeps no per-login record, so it verifies without a lookup and scales cleanly — and it cannot be un-issued, only outlived. What you ask for is an httpOnly, secure, sameSite cookie for sign-in rather than a token in localStorage, a stated expiry, and an answer to how a user logs out of every device at once. If the answer is 'delete the row', that is a session. If it is 'wait for it to expire', say so plainly, because that is the real trade."
    >
      <SessionsTokenDemo />
    </Figure>
  );
}
