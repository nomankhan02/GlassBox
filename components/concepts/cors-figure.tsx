import { Figure } from "@/components/site/figure";
import { CorsDemo } from "./cors-demo";

export function CorsFigure() {
  return (
    <Figure
      id="1.08"
      caption="two origins · one server · the header decides who may read"
      reading="Below is the 1.08 diagram made to move. Pick an origin and a server config, then press Send request. Two panels fill in every time, and the difference between them is the whole lesson. The left panel is the server's response: it arrives on every run, whatever the origin, with whatever Access-Control-Allow-Origin you configured. The right panel is what the page's script may actually read. With Allow-Origin: yourdomain.com and your own origin, the data renders. Switch the origin to attacker-site.com and the response still arrives — a 200, with the data — but the browser withholds it and you get a blocked-by-CORS message instead of the fields. Now set the header to *. The other origin reads the response too. That is not an error being fixed; it is the protection being removed."
      whyItMatters="CORS is a rule the browser enforces about which origins may read a response, not access control for your API. The server was never blocking anyone: anything calling from a script, a terminal or another server ignores it completely. That is why the same call succeeds in curl and fails from a page, and why 'add Allow-Origin: *' is the wrong fix the moment the endpoint returns a signed-in visitor's data — you have just let every site read it. What you ask for is an allow-list of the exact origins you use, no wildcard on anything authenticated, and a note on which requests trigger a preflight."
    >
      <CorsDemo />
    </Figure>
  );
}
