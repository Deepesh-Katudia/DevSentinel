import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  RiTwitterXFill,
  RiGithubFill,
  RiLinkedinFill,
  RiDiscordFill,
} from "@remixicon/react";

const GITHUB_URL = "https://github.com/Deepesh-Katudia/DevSentinel";
const LINKEDIN_URL = "https://www.linkedin.com/in/deepeshkatudia/";

type FooterLink = { label: string; href: string; external?: boolean };

const footerSections: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Changelog", href: "/changelog" },
      { label: "Roadmap", href: "/roadmap" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "API Reference", href: "/api-reference" },
      { label: "Status", href: "/status" },
      { label: "Support", href: "/support" },
    ],
  },
  {
    title: "Connect",
    links: [
      { label: "GitHub", href: GITHUB_URL, external: true },
      { label: "Twitter / X", href: "/coming-soon?name=Twitter" },
      { label: "Discord", href: "/coming-soon?name=Discord" },
      { label: "LinkedIn", href: LINKEDIN_URL, external: true },
    ],
  },
];

const stats = [
  { value: "GitHub", label: "PR review" },
  { value: "Sentry", label: "incident triage" },
  { value: "Teams", label: "quality reports" },
];

const socialIcons = [
  { Icon: RiGithubFill, label: "GitHub", href: GITHUB_URL, external: true },
  {
    Icon: RiTwitterXFill,
    label: "Twitter/X",
    href: "/coming-soon?name=Twitter",
    external: false,
  },
  {
    Icon: RiDiscordFill,
    label: "Discord",
    href: "/coming-soon?name=Discord",
    external: false,
  },
  { Icon: RiLinkedinFill, label: "LinkedIn", href: LINKEDIN_URL, external: true },
];

export function Footer() {
  return (
    <footer style={{ background: "#1c1917" }} className="mt-auto">
      <div className="mx-auto max-w-6xl px-8 pb-10 pt-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:gap-0">
          <div className="flex-shrink-0 md:w-64">
            <p className="mb-1 font-serif text-[22px] font-bold text-[#e8ddd5]">
              DevSentinel
            </p>
            <p className="mb-6 text-[13px] leading-relaxed text-[#a09088]">
              Review risky PRs before they become incidents.
              <br />
              Add structure when production still breaks.
            </p>
            {stats.map((s) => (
              <div key={s.label} className="mb-3">
                <span className="font-serif text-[22px] font-bold text-[#e8ddd5]">
                  {s.value}
                </span>
                <span className="ml-2 text-[12px] text-[#a09088]">
                  {s.label}
                </span>
              </div>
            ))}
            <div className="mt-5 flex gap-2">
              {socialIcons.map(({ Icon, label, href, external }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="icon"
                  aria-label={label}
                  className="border-[#3a3330] bg-transparent text-[#a09088] hover:bg-[#2a2420] hover:text-[#e8ddd5]"
                  asChild
                >
                  {external ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      <Icon size={16} />
                    </a>
                  ) : (
                    <Link href={href}>
                      <Icon size={16} />
                    </Link>
                  )}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-8 md:grid-cols-4 md:pl-16">
            {footerSections.map(({ title, links }) => (
              <div key={title}>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#e0d5cc]">
                  {title}
                </p>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] text-[#a09088] transition-colors hover:text-[#e8ddd5]"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-[13px] text-[#a09088] transition-colors hover:text-[#e8ddd5]"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="flex flex-col items-center justify-between gap-2 border-t px-8 py-4 md:flex-row"
        style={{ borderColor: "#2a2420" }}
      >
        <p className="text-[12px] text-[#6b5c54]">
          (c) 2026 DevSentinel. All rights reserved.
        </p>
        <div className="flex gap-4">
          {["Terms", "Privacy", "Security", "Cookies"].map((item) => (
            <Link
              key={item}
              href={`/coming-soon?name=${item}`}
              className="text-[12px] text-[#6b5c54] transition-colors hover:text-[#a09088]"
            >
              {item}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
