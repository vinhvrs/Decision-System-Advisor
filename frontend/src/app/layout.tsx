import "./globals.css";

export const metadata = {
  title: {
    default: "DSA | Market Research & Decision Support",
    template: "%s | DSA",
  },
  description:
    "Market research, rankings, fundamentals, indicators, news, and transparent data context in one workspace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="dsa-shell" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
