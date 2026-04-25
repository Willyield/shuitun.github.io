import {
  AboutPage,
  BudgetPage,
  CreateChoicePage,
  CreateTripPage,
  DetailPage,
  ExpensePage,
  HomePage,
  NotFoundPage,
  TripListPage
} from "./pages";
import SettlementView from "./pages/SettlementView";
import { useRoute } from "./lib/router";

export default function App() {
  const route = useRoute();
  const id = route.params.get("id");
  const pages = {
    home: <HomePage />,
    create: <CreateChoicePage />,
    "create-parent": <CreateTripPage mode="parent" />,
    "create-shared": <CreateTripPage mode="shared" />,
    manage: <TripListPage />,
    archive: <TripListPage type="archive" />,
    detail: <DetailPage id={id} />,
    expense: <ExpensePage id={id} />,
    budget: <BudgetPage id={id} />,
    review: <SettlementView id={id} />,
    summary: <SettlementView id={id} summary />,
    about: <AboutPage />
  };
  return <div className="px-5 sm:px-6">{pages[route.name] || <NotFoundPage />}</div>;
}
