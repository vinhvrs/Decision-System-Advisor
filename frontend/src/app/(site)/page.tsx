import TradingChart from "../../components/charts/page";
import ChatBox from "../../components/chatbox/page";
import Header from "../../components/header/page";

export default function HomePage() {
  return (
    <>
      <header className="mb-8 sticky top-0 z-50">
        <Header />
      </header>
      <main className="px-6 py-10">

        <h1 className="text-3xl font-bold mb-4">
          Trading Dashboard
        </h1>

        <p className="text-gray-300 mb-6">
          Welcome to the Decision System Advisor – Real-time market chart.
        </p>

        <TradingChart />
        <ChatBox />
      </main>
    </>
  );
}
