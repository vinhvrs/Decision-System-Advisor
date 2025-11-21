import "./globals.css";

export const metadata = {
  title: "Stock Advisor Page",
  description: "Get stock advice and insights from our expert advisors.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en"> 
      <body>
        {children}
      </body>
    </html>
  );
}
