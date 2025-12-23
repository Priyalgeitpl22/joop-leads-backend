import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function debug() {
  console.log("\n🔍 SCHEDULER DEBUG\n");
  console.log(`Current time: ${new Date().toISOString()}`);

  // Check CampaignRuntime records
  console.log("\n--- CampaignRuntime Records ---");
  const runtimes = await prisma.campaignRuntime.findMany({
    include: { campaign: true },
  });

  if (runtimes.length === 0) {
    console.log("❌ NO CampaignRuntime records found!");
    console.log("   → This means no campaigns are scheduled to run.");
    console.log("   → Make sure to call createCampaignRuntime when scheduling a campaign.");
  } else {
    runtimes.forEach((rt) => {
      const isDue = rt.nextRunAt <= new Date();
      console.log(`\n  Campaign: ${rt.campaign?.name} (${rt.campaignId})`);
      console.log(`    Status: ${rt.campaign?.status}`);
      console.log(`    nextRunAt: ${rt.nextRunAt.toISOString()}`);
      console.log(`    Due now: ${isDue ? "✅ YES" : "❌ NO"}`);
      console.log(`    dayKey: ${rt.dayKey}`);
      console.log(`    sentToday: ${rt.sentToday}`);
      console.log(`    lockedAt: ${rt.lockedAt?.toISOString() ?? "null"}`);
    });
  }

  // Check Campaigns without runtime
  console.log("\n--- Campaigns Status ---");
  const campaigns = await prisma.campaign.findMany({
    include: { runtime: true },
    where: { status: { in: ["SCHEDULED", "ACTIVE"] } },
  });

  campaigns.forEach((c) => {
    console.log(`\n  ${c.name} (${c.id})`);
    console.log(`    Status: ${c.status}`);
    console.log(`    scheduledAt: ${c.scheduledAt?.toISOString() ?? "null"}`);
    console.log(`    Has Runtime: ${c.runtime ? "✅ YES" : "❌ NO"}`);
    if (!c.runtime) {
      console.log(`    ⚠️  PROBLEM: Campaign is ${c.status} but has no CampaignRuntime!`);
    }
  });

  // Check EmailSend records
  console.log("\n--- Recent EmailSend Records ---");
  const sends = await prisma.emailSend.findMany({
    orderBy: { queuedAt: "desc" },
    take: 5,
  });

  if (sends.length === 0) {
    console.log("No EmailSend records found.");
  } else {
    sends.forEach((s) => {
      console.log(`  ${s.id}: status=${s.status}, queuedAt=${s.queuedAt.toISOString()}`);
    });
  }

  await prisma.$disconnect();
  process.exit(0);
}

debug().catch(console.error);

