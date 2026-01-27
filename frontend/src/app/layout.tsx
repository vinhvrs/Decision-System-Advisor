import "./globals.css";

export const metadata = {
  title: "Stock Advisor Page",
  description: "Get stock advice and insights from our expert advisors.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0B1220] text-[#E5E7EB]">
        {children}
      </body>
    </html>
  );
}
