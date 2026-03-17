-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "billingCycleEndsAt" TIMESTAMP(3),
ADD COLUMN     "billingCycleStartsAt" TIMESTAMP(3),
ADD COLUMN     "planOverride" "SubscriptionPlan",
ADD COLUMN     "planOverrideExpiresAt" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialStartsAt" TIMESTAMP(3);
