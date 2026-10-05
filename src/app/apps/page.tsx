import AppsDirectory, { type CatalogApp } from "@/components/AppsDirectory";
import catalog from "@/data/apps.json";

export const metadata = { title: "Apps · Maxdots" };

export default async function Page({ searchParams }: PageProps<"/apps">) {
  const { search } = await searchParams;
  const initialQuery = typeof search === "string" ? search : "";
  return <AppsDirectory key={initialQuery} apps={catalog.apps as CatalogApp[]} initialQuery={initialQuery} />;
}
