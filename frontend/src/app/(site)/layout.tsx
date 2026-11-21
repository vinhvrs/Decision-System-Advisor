import "@/src/new-terminal/styles.css";
import TerminalShell from "@/src/new-terminal/shell/TerminalShell";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <TerminalShell>{children}</TerminalShell>;
}
