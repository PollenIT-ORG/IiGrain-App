import { Navigate } from "react-router-dom";
import { homePath } from "../lib/access";

/** Sends everyone to the first page of the panel. */
export default function Home() {
  return <Navigate to={homePath()} replace />;
}
