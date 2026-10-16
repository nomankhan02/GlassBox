import { Masthead } from "@/components/site/masthead";
import { LayerRail } from "@/components/site/layer-rail";
import { Colophon } from "@/components/site/colophon";

/*
  The content pages share one frame: the masthead across the top, the layer
  index down the left margin, the page in the column beside it, and the
  colophon at the foot. The homepage does not use this layout — it opens on a
  hero instead — which is why the frame lives here rather than in the root.

  The measure lives here too, now that the root layout no longer carries it: the
  1280px column and its gutters, tighter on phones so text stays off the literal
  edge. The homepage declares the same measure inside its own hero.
*/
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-3.5 sm:px-5 md:px-6 lg:px-7">
      <Masthead />

      <div className="lg:grid lg:grid-cols-[148px_minmax(0,1fr)] xl:grid-cols-[168px_minmax(0,1fr)]">
        <LayerRail />
        {/* The rule on this edge is the only vertical line on the site: it
            separates the layer index from the layer's contents. */}
        <main
          id="content"
          className="min-w-0 pt-8 pb-20 lg:border-l lg:border-rule lg:pt-12 lg:pl-8 xl:pl-11"
        >
          {children}
        </main>
      </div>

      <Colophon />
    </div>
  );
}
