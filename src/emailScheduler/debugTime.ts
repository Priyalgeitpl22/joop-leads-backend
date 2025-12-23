import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function debugTime() {
  console.log("\n🕐 TIME DEBUG\n");
  
  // Current time
  console.log("=== Current Time ===");
  console.log(`Server new Date():     ${new Date().toISOString()}`);
  console.log(`Server local string:   ${new Date().toString()}`);
  
  // Check campaign and runtime
  const campaigns = await prisma.campaign.findMany({
    where: { status: { in: ["SCHEDULED", "ACTIVE"] } },
    include: { runtime: true },
  });

  console.log(`\n=== Found ${campaigns.length} SCHEDULED/ACTIVE campaign(s) ===\n`);

  for (const c of campaigns) {
    console.log(`Campaign: ${c.name} (${c.id})`);
    console.log(`  Status: ${c.status}`);
    console.log(`  Timezone: ${c.timezone}`);
    console.log(`  scheduledAt (raw): ${c.scheduledAt}`);
    console.log(`  scheduledAt (ISO): ${c.scheduledAt?.toISOString()}`);
    
    if (c.runtime) {
      console.log(`  Runtime.nextRunAt (raw): ${c.runtime.nextRunAt}`);
      console.log(`  Runtime.nextRunAt (ISO): ${c.runtime.nextRunAt.toISOString()}`);
      
      const now = new Date();
      const isDue = c.runtime.nextRunAt <= now;
      console.log(`  Is Due? (nextRunAt <= now): ${isDue}`);
      console.log(`    - now:       ${now.toISOString()}`);
      console.log(`    - nextRunAt: ${c.runtime.nextRunAt.toISOString()}`);
      
      if (!isDue) {
        const diffMs = c.runtime.nextRunAt.getTime() - now.getTime();
        const diffMins = Math.round(diffMs / 60000);
        console.log(`    - Due in: ${diffMins} minutes`);
      }
    } else {
      console.log(`  ⚠️  No CampaignRuntime found!`);
    }
    console.log("");
  }

  await prisma.$disconnect();
}

debugTime().catch(console.error);

