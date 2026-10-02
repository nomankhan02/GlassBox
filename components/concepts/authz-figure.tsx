import { Figure } from "@/components/site/figure";
import { AuthzDemo } from "./authz-demo";

export function AuthzFigure() {
  return (
    <Figure
      id="1.04"
      caption="two gates in order · authentication then authorization · one record, four identities"
      reading="The chain below is the 1.04 diagram made to move: a request enters gate 1, resolves, and only then reaches gate 2. Pick an identity and press Send request. Not signed in stops at gate 1 with a 401. Signed in as Jordan passes gate 1 and stops at gate 2 with a 403, because knowing who you are is not the same as being allowed. Signed in as Alex and signed in as an admin both reach the record and its content, for two different reasons, and the explanation under the chain names which gate decided what. Nothing moves until you click, and the record content stays withheld until both gates have opened."
      whyItMatters="A sign-in flow answers the first question and stops. That is why an app can know exactly who you are and still let you read somebody else's records: gate 1 was built, gate 2 was never wired up. What you ask for is the second check, on the server, per request, against the specific row being touched, plus an explicit rule for any role that is allowed to bypass ownership. The admin rule here is printed on the page rather than hidden, because a permission that lives only in the code is a permission nobody can review."
    >
      <AuthzDemo />
    </Figure>
  );
}
