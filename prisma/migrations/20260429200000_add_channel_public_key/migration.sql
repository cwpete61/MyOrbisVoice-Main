ALTER TABLE "ChannelConfig" ADD COLUMN IF NOT EXISTS "publicKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelConfig_publicKey_key" ON "ChannelConfig"("publicKey");
