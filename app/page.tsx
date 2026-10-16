import Header from "@/components/header";
import IntakeForm from "@/components/intake-form";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-3xl mx-auto">
            <div className="bg-brand-purple/10 border border-brand-purple/20 rounded-lg p-4 md:p-6 mb-8">
              <p className="text-brand-ink text-sm md:text-base leading-relaxed text-center">
                Fill up this form to add your task in Shantanu&apos;s queue. Shantanu will review the requirements with Sujay and plan it in accordance with other priority items.
              </p>
            </div>
            <IntakeForm />
          </div>
        </div>
      </main>
    </>
  );
}
