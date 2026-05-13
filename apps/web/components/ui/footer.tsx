import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  RiGoogleFill,
  RiFacebookFill,
  RiTwitterXFill,
  RiGithubFill,
} from "@remixicon/react";

const footerLinks = {
  Product: ["Features", "Pricing", "Changelog", "Roadmap"],
  Company: ["About", "Blog", "Careers", "Press"],
  Resources: ["Docs", "API Reference", "Status", "Support"],
  Connect: ["GitHub", "Twitter / X", "Discord", "LinkedIn"],
};

const stats = [
  { value: "142+", label: "PRs reviewed daily" },
  { value: "3×",   label: "faster incident resolution" },
  { value: "99.9%", label: "uptime" },
];

export function Footer() {
  return (
    <footer style={{ background: "#1c1917" }} className="mt-auto">
      {/* Top section */}
      <div className="max-w-6xl mx-auto px-8 pt-14 pb-10">
        <div className="flex flex-col md:flex-row md:items-start gap-10 md:gap-0">
          {/* Brand + stats */}
          <div className="md:w-64 flex-shrink-0">
            <p className="font-serif text-[22px] font-bold text-[#e8ddd5] mb-1">
              DevSentinel
            </p>
            <p className="text-[13px] text-[#a09088] mb-6 leading-relaxed">
              Catch problems before they ship.
              <br />
              Resolve them faster when they do.
            </p>
            {stats.map((s) => (
              <div key={s.label} className="mb-3">
                <span className="text-[22px] font-serif font-bold text-[#e8ddd5]">
                  {s.value}
                </span>
                <span className="text-[12px] text-[#a09088] ml-2">{s.label}</span>
              </div>
            ))}
            {/* Social icons */}
            <div className="flex gap-2 mt-5">
              {[
                { Icon: RiGoogleFill, label: "Google" },
                { Icon: RiFacebookFill, label: "Facebook" },
                { Icon: RiTwitterXFill, label: "Twitter/X" },
                { Icon: RiGithubFill, label: "GitHub" },
              ].map(({ Icon, label }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="icon"
                  aria-label={label}
                  className="border-[#3a3330] bg-transparent text-[#a09088] hover:bg-[#2a2420] hover:text-[#e8ddd5]"
                >
                  <Icon size={16} />
                </Button>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-8 md:pl-16">
            {Object.entries(footerLinks).map(([section, links]) => (
              <div key={section}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#e0d5cc] mb-3">
                  {section}
                </p>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link}>
                      <Link
                        href="#"
                        className="text-[13px] text-[#a09088] hover:text-[#e8ddd5] transition-colors"
                      >
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="border-t px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-2"
        style={{ borderColor: "#2a2420" }}
      >
        <p className="text-[12px] text-[#6b5c54]">
          © 2026 DevSentinel. All rights reserved.
        </p>
        <div className="flex gap-4">
          {["Terms", "Privacy", "Security", "Cookies"].map((item) => (
            <Link
              key={item}
              href="#"
              className="text-[12px] text-[#6b5c54] hover:text-[#a09088] transition-colors"
            >
              {item}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
