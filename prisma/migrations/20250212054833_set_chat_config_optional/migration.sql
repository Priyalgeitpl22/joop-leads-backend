-- AlterTable
ALTER TABLE "ChatConfig" ALTER COLUMN "allowFileUpload" DROP NOT NULL,
ALTER COLUMN "allowEmojis" DROP NOT NULL,
ALTER COLUMN "position" DROP NOT NULL,
ALTER COLUMN "iconColor" DROP NOT NULL,
ALTER COLUMN "chatWindowColor" DROP NOT NULL,
ALTER COLUMN "fontColor" DROP NOT NULL,
ALTER COLUMN "availability" DROP NOT NULL,
ALTER COLUMN "socketServer" DROP NOT NULL;
