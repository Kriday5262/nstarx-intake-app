import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <section className="max-w-2xl mx-auto text-center space-y-6">
          <h1 className="text-3xl md:text-5xl font-black text-brand-purple tracking-tight">
            NStarX Intake
          </h1>
          <p className="text-base md:text-lg text-brand-ink/80 font-body">
            A branded intake experience built with Next.js 14, Tailwind CSS, and shadcn/ui.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button className="bg-brand-purple hover:bg-brand-purple-dark text-white">
              Get started
            </Button>
            <Button
              variant="outline"
              className="border-brand-purple text-brand-purple hover:bg-brand-purple/10"
            >
              Learn more
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
          <Card className="border-t-4 border-t-brand-lime">
            <CardHeader>
              <CardTitle className="text-brand-ink">Lime accent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-brand-ink/70">
                A token-powered card using the NStarX lime accent.
              </p>
            </CardContent>
          </Card>
          <Card className="border-t-4 border-t-brand-sky">
            <CardHeader>
              <CardTitle className="text-brand-ink">Sky accent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-brand-ink/70">
                A token-powered card using the NStarX sky accent.
              </p>
            </CardContent>
          </Card>
          <Card className="border-t-4 border-t-brand-amber sm:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-brand-ink">Amber accent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-brand-ink/70">
                A token-powered card using the NStarX amber accent.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
