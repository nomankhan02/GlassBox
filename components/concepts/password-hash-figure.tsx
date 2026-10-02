import { Figure } from "@/components/site/figure";
import { PasswordHashDemo } from "./password-hash-demo";

export function PasswordHashFigure() {
  return (
    <Figure
      id="1.06"
      caption="SHA-256 in the browser · salted and unsalted · two accounts, one password"
      reading="Above the dashed line is the browser, where every hash on this screen is actually computed. Sign up with a password and the database cell below shows two columns for each account: what the password would be if stored as typed, and what is actually written down. Try Salt: off, then sign up again: Alex and Jordan chose the same password, and with nothing added first the two stored rows are byte-for-byte identical. Turn salt on and they diverge. Simulate a leak to see which column an attacker can read. Then log in with the right password, then with one character wrong, and watch the four server steps resolve in order: the comparison is the last of them."
      whyItMatters="The argument for hashing is not that a hash cannot be reversed in principle; it is that reversing it costs more than the password is worth. A fast hash and a slow one look the same in a demo and behave nothing alike under attack: SHA-256 can be tried billions of times a second on one graphics card, while bcrypt at a sensible cost gets through a small fraction of that. What you ask for is a salted, deliberately slow algorithm, verified with a constant-time comparison, and never written to a log. This demo uses SHA-256 only so the step is quick enough to watch, and says so."
    >
      <PasswordHashDemo />
    </Figure>
  );
}
