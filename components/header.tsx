import Image from "next/image";

export default function Header() {
  return (
    <header className="bg-white border-b border-brand-zebra sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/nstarx-logo-horizontal.png"
            alt="NStarX logo"
            width={160}
            height={40}
            priority
            className="h-8 md:h-10 w-auto"
          />
          <span className="hidden sm:inline-block h-6 w-px bg-brand-ink/20"></span>
          <span className="font-heading font-black text-brand-ink text-lg md:text-xl">
            Project Intake Form
          </span>
        </div>
      </div>
    </header>
  );
}
