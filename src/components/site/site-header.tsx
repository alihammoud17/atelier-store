import Link from "next/link";
import { BagIcon, SearchIcon, UserIcon } from "@/components/ui/icons";
import { mainNav } from "@/lib/navigation";
import { MobileMenu } from "./mobile-menu";

const iconButton =
  "inline-flex size-10 items-center justify-center text-lg transition-opacity hover:opacity-60";

export function SiteHeader() {
  return (
    <>
      <p className="text-label bg-ink px-gutter py-2 text-center text-canvas">
        Complimentary shipping and returns on all orders
      </p>
      {/* Solid background: a backdrop-filter here would trap the fixed mobile menu inside the header. */}
      <header className="sticky top-0 z-40 border-b bg-canvas">
        <div className="container-page grid h-header grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center gap-1 lg:gap-8">
            <MobileMenu />
            <nav aria-label="Main" className="hidden lg:block">
              <ul role="list" className="flex gap-7">
                {mainNav.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-label link-reveal">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <Link href="/search" aria-label="Search" className={`${iconButton} lg:hidden`}>
              <SearchIcon />
            </Link>
          </div>

          <Link
            href="/"
            className="font-serif text-xl tracking-[0.3em] uppercase sm:text-2xl sm:tracking-[0.35em]"
          >
            Atelier
          </Link>

          <div className="flex items-center justify-end gap-1">
            <Link href="/search" aria-label="Search" className={`${iconButton} hidden lg:inline-flex`}>
              <SearchIcon />
            </Link>
            <Link href="/account" aria-label="Account" className={iconButton}>
              <UserIcon />
            </Link>
            <Link href="/bag" aria-label="Shopping bag, 0 items" className={iconButton}>
              <BagIcon />
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
