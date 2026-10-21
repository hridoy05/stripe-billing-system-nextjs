-- CreateTable
CREATE TABLE "stripe_customers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "default_payment_method_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stripe_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "setup_intent_id" TEXT,
    "consent_version" TEXT NOT NULL,
    "consent_text" TEXT NOT NULL,
    "allow_off_session" BOOLEAN NOT NULL,
    "accepted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "payment_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_payment_methods" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "setup_intent_id" TEXT,
    "consent_id" TEXT,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "last4" TEXT,
    "exp_month" INTEGER,
    "exp_year" INTEGER,
    "billing_name" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "saved_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_customers_user_id_key" ON "stripe_customers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_customers_stripe_customer_id_key" ON "stripe_customers"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_consents_setup_intent_id_key" ON "payment_consents"("setup_intent_id");

-- CreateIndex
CREATE INDEX "payment_consents_user_id_idx" ON "payment_consents"("user_id");

-- CreateIndex
CREATE INDEX "payment_consents_customer_id_idx" ON "payment_consents"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_payment_methods_setup_intent_id_key" ON "saved_payment_methods"("setup_intent_id");

-- CreateIndex
CREATE INDEX "saved_payment_methods_customer_id_idx" ON "saved_payment_methods"("customer_id");

-- AddForeignKey
ALTER TABLE "payment_consents" ADD CONSTRAINT "payment_consents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "stripe_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_payment_methods" ADD CONSTRAINT "saved_payment_methods_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "stripe_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_payment_methods" ADD CONSTRAINT "saved_payment_methods_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "payment_consents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
