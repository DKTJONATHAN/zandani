import { Navigate, useParams } from "react-router-dom";

const CATEGORY_TO_SECTION: Record<string, string> = {
  news: "/news",
  politics: "/news",
  opinions: "/news",
  showbiz: "/entertainment",
  entertainment: "/entertainment",
  gossip: "/entertainment",
  sports: "/sports",
  business: "/business",
  lifestyle: "/lifestyle",
};

/** /category/* is a duplicate of the section desks. Send everyone to one URL. */
export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const dest = CATEGORY_TO_SECTION[(slug || "").toLowerCase()] || "/news";
  return <Navigate to={dest} replace />;
}
