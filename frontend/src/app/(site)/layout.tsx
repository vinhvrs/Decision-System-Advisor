import "@/src/new-terminal/styles.css";
import "@/src/new-terminal/company-snapshot.css";
import TerminalShell from "@/src/new-terminal/shell/TerminalShell";
import CompanyRadarEnhancer from "@/src/new-terminal/CompanyRadarEnhancer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TerminalShell>{children}</TerminalShell>
      <CompanyRadarEnhancer />
    </>
  );
}
