-- CreateIndex
CREATE INDEX "app_quotations_createdBy_idx" ON "app_quotations"("createdBy");

-- CreateIndex
CREATE INDEX "app_quotations_status_idx" ON "app_quotations"("status");

-- CreateIndex
CREATE INDEX "app_quotations_createdAt_idx" ON "app_quotations"("createdAt");

-- CreateIndex
CREATE INDEX "app_quotations_quotationNumber_idx" ON "app_quotations"("quotationNumber");

-- CreateIndex
CREATE INDEX "external_shipments_registeredAt_idx" ON "external_shipments"("registeredAt");

-- CreateIndex
CREATE INDEX "external_shipments_arrivalAt_idx" ON "external_shipments"("arrivalAt");

-- CreateIndex
CREATE INDEX "external_shipments_transitEntryAt_idx" ON "external_shipments"("transitEntryAt");

-- CreateIndex
CREATE INDEX "external_shipments_category_idx" ON "external_shipments"("category");

-- CreateIndex
CREATE INDEX "external_shipments_currencyCode_idx" ON "external_shipments"("currencyCode");
