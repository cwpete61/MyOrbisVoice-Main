-- CreateEnum
CREATE TYPE "WebinarVideoProvider" AS ENUM ('YOUTUBE', 'VIMEO');

-- AlterTable
ALTER TABLE "Webinar" ADD COLUMN     "ctaLabel" TEXT,
ADD COLUMN     "ctaLabelEs" TEXT,
ADD COLUMN     "ctaUrl" TEXT,
ADD COLUMN     "resourceUrl" TEXT,
ADD COLUMN     "videoProvider" "WebinarVideoProvider";

