import Link from "next/link";
import { Github, Twitter, Linkedin, Mail, Globe } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: "Platform",
      links: [
        { name: "Dashboard", href: "#dashboard" },
        { name: "Market Heatmap", href: "/analyze" },
        { name: "Indicators & Strategy", href: "/indicators" },
      ],
    },
    {
      title: "Resources",
      links: [
        { name: "Market News", href: "/news" },
        { name: "Documentation", href: "/document" },
        { name: "Help Center", href: "/contact" },
        { name: "Community", href: "#" },
      ],
    },
    {
      title: "Legal",
      links: [
        { name: "Privacy Policy", href: "#" },
        { name: "Terms of Service", href: "#" },
        { name: "Risk Disclosure", href: "#" },
      ],
    },
  ];

  return (
    <footer className="bg-[#0b1220] border-t border-white/5 pt-10 pb-6 phone:pt-12 tablet:pt-16 tablet:pb-8 px-4 phone:px-5 tablet:px-6">
      <div className="max-w-screen-xl mx-auto">
        <div className="grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-5 gap-8 tablet:gap-10 laptop:gap-12 mb-8 tablet:mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="text-xl font-bold flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs">DSA</span>
              </div>
              Decision Stocks Advisor
            </Link>
            <p className="mt-3 tablet:mt-4 text-white/50 text-xs phone:text-sm leading-relaxed max-w-sm">
              Empowering investors with real-time analytics, institutional-grade indicators,
              and data-driven market context. Stay ahead of the curve with DSA.
            </p>
            <div className="flex gap-4 mt-6">
              <a href="#" className="text-white/40 hover:text-blue-400 transition-colors"><Twitter size={20} /></a>
              <a href="#" className="text-white/40 hover:text-blue-400 transition-colors"><Github size={20} /></a>
              <a href="#" className="text-white/40 hover:text-blue-400 transition-colors"><Linkedin size={20} /></a>
              <a href="mailto:ITITIU21345@hcmiu.edu.vn" className="text-white/40 hover:text-blue-400 transition-colors"><Mail size={20} /></a>
            </div>
          </div>

          {/* Links Columns */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-white/40 hover:text-white text-sm transition-colors">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-y border-white/5 py-6 tablet:py-8 mb-6 tablet:mb-8 text-center tablet:text-left">
          <p className="text-[10px] phone:text-[11px] text-white/30 leading-relaxed uppercase tracking-tighter">
            <span className="text-orange-500/60 font-bold mr-1 italic">RISK DISCLOSURE:</span> 
            Investing in stocks involves significant risk. The information provided on DSA is for educational purposes only 
            and does not constitute financial advice. Decision Stocks Advisor (DSA) is an academic project.
          </p>
        </div>

        <div className="flex flex-col tablet:flex-row justify-between items-center gap-3 tablet:gap-4 text-white/30 text-[11px] phone:text-[12px]">
          <p>© {currentYear} DSA Team. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <Globe size={14} />
            <span>English (US)</span>
            <span className="mx-2">•</span>
            <span>Server Status: Operational</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1"></div>
          </div>
        </div>
      </div>
    </footer>
  );
}