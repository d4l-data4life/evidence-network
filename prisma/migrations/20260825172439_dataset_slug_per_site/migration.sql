-- Dataset slugs are unique per site (not globally): URLs are /datasets/{siteSlug}/{datasetSlug}.
DROP INDEX "Dataset_slug_key";
CREATE UNIQUE INDEX "Dataset_siteId_slug_key" ON "Dataset"("siteId", "slug");
