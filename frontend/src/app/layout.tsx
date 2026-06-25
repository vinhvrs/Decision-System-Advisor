import "./globals.css";

export const metadata = {
  title: "Decision Support Advisor",
  description: "Market rankings, fundamentals, indicators, and news in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#0B1220] text-[#E5E7EB]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
