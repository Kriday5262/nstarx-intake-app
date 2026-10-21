import { Metadata } from "next";
import Header from "@/components/header";
import IntakeForm from "@/components/intake-form";

export const metadata: Metadata = {
  title: "Project Intake Form · NStarX",
  description: "Submit a request to Shantanu's queue.",
};

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6 md:py-10">
          <div className="max-w-3xl mx-auto">
            <div className="bg-brand-purple/10 rounded-[4px] p-3 md:p-5 mb-6 md:mb-8">
              <p className="text-brand-ink text-sm md:text-base leading-relaxed text-left">
                Welcome! Use this form to submit your project request. Once submitted, Shantanu will review it with Sujay and plan it alongside other priority work. You&apos;ll receive an email confirmation with your reference number.
              </p>
            </div>
            <IntakeForm />
          </div>
        </div>
      </main>
    </>
  );
}
