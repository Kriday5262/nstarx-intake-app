import Link from "next/link";
import Header from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Request Submitted — NStarX Project Intake Form",
};

export default function SuccessPage({
  searchParams,
}: {
  searchParams?: { ref?: string };
}) {
  const ref = searchParams?.ref ?? "";

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-xl mx-auto border-t-4 border-t-brand-lime shadow">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-lime/20 text-brand-lime">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <CardTitle className="text-2xl md:text-3xl font-black text-brand-ink">
                Request Submitted
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-brand-ink/80">
                Welcome! Your project request has been submitted. Shantanu will review it with Sujay and plan it alongside other priority work. You&apos;ll receive an email confirmation with your reference number.
              </p>
              {ref ? (
                <div className="bg-brand-zebra rounded-lg p-5 border border-brand-purple/20">
                  <p className="text-sm text-brand-ink/70 mb-1">
                    Your reference number
                  </p>
                  <p className="text-2xl md:text-3xl font-black text-brand-purple tracking-tight break-all">
                    {ref}
                  </p>
                  <p className="text-xs text-brand-ink/60 mt-2">
                    Save this number to check the status of your request.
                  </p>
                </div>
              ) : null}
              <Button
                asChild
                className="bg-brand-purple hover:bg-brand-purple-dark text-white min-h-11"
              >
                <Link href="/">Submit another request</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
